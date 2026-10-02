/**
 * The Projects tab's own data and actions (V2-T67, `docs/INTERFACE.md` § 4) — replaces
 * `renderer/legacy/projects-list-view.tsx`'s own imperative rendering of `#projects-list`
 * entirely (apagado by this task; `renderer/legacy/projects-panel-cache.ts` keeps only the data
 * cache `adopt-flow-view.ts` still needs — an OTHER, untouched legacy module; the directory modal
 * that used to be its other reader was deleted by V2-T68).
 *
 * **Why `pending` only ever applies to the `open`/`readOnly` actions, never `goToTab`.**
 * `api.openProject` resolves only once the launched harness tab CLOSES
 * (`CHANNELS.openProject`'s own docstring) — that can be hours away, so "loading until the
 * promise settles" would leave the button spinning for the entire session, which is not what
 * "pending" means here. What actually matters finishes much sooner: either the person declines
 * the read-only confirmation (the promise settles quickly, with no tab ever opening) or a tab
 * DOES open (`CHANNELS.resumeTabOpened`'s own `label`, set to the project id by
 * `ProjectOpenTabLauncher`, `main/project-ipc.ts`) — and the instant a tab opens, this project's
 * OWN row flips to `openHere` on the next `projectsUpdate` push anyway, rendering a `Go to tab`
 * button instead of the one that was loading. `pending` is cleared by WHICHEVER of those two
 * signals arrives first; a stale pending flag left behind for a row that already changed shape
 * is simply never read again (`projectRowLoading` below only applies it to a non-`goToTab`
 * action).
 */
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { getSeeyaApi } from '../../ipc/client.js';
import { useIpcSubscription } from '../../hooks/useIpcSubscription.js';
import type { ProjectsPanelData, ProjectPanelRow } from '../../../state/projects-panel.js';
import { resolveProjectRowAction } from '../../../state/projects-panel.js';
import { buildProjectsTableRows, type ProjectsTableFilter } from '../../../state/projects-table.js';
// Imported from the concrete file, never `../tabs/index.js` — that barrel also re-exports
// `TabStrip`, and `TabStrip.tsx` itself renders `<Projects/>` (`features/tabs/TabStrip.tsx`'s own
// docstring): routing through the barrel would close a dependency-cruiser-forbidden cycle
// (`tabs/index → TabStrip → projects/index → Projects → useProjects → tabs/index`,
// `.dependency-cruiser.cjs`'s own `no-circular-dependency` rule). `tab-select-bridge.ts` itself
// never imports `TabStrip`, so this direct import closes no cycle at all.
import { selectTab } from '../tabs/tab-select-bridge.js';
import { openNewProjectDialog } from './new-project-dialog-bridge.js';
import { showProjectSessionsInSessionsTab } from '../sessions/sessions-filter-bridge.js';
import {
  useProjectSessionResume,
  type ProjectSessionResumeResult,
} from '../../hooks/useProjectSessionResume.js';
import type { ProjectSessionsPanelProps } from './ProjectsTable/ProjectSessionsPanel.js';

const AWAITING_FIRST_PROJECTS_PANEL: ProjectsPanelData = {
  projects: [],
  otherSessionsByDirectory: [],
  ignoredProjects: [],
};

export interface ProjectsControls {
  readonly panel: ProjectsPanelData;
  readonly filter: ProjectsTableFilter;
  readonly setFilter: (filter: ProjectsTableFilter) => void;
  readonly query: string;
  readonly setQuery: (query: string) => void;
  readonly rows: readonly ProjectPanelRow[];
  readonly onToggleFavorite: (projectId: string, favorite: boolean) => void;
  /** Dispatches the row's own action (`Go to tab`/`Open`/`Read only…`, D-041: the row never
   * decides this itself, `state/projects-panel.ts#resolveProjectRowAction` already did). */
  readonly onRowAction: (row: ProjectPanelRow) => void;
  /** Whether `row`'s own action button should show `loading` — this hook's own top docstring has
   * the full reasoning for why `goToTab` never does. */
  readonly isRowActionPending: (row: ProjectPanelRow) => boolean;
  readonly openNewProject: () => void;
  /** V2-T77 (`docs/INTERFACE.md` § 5a): which project rows are expanded to show their sessions,
   * and the toggle. Plain view state — nothing persisted, a reopened window starts collapsed. */
  readonly expandedProjectIds: ReadonlySet<string>;
  readonly onToggleExpanded: (projectId: string) => void;
  /** What every expanded row's session list needs (`ProjectSessionsPanel`). */
  readonly sessionsPanel: Omit<ProjectSessionsPanelProps, 'project'>;
  /** The last project-session `Resume` started from this tab — never silent. */
  readonly resumeResult: ProjectSessionResumeResult | null;
  readonly dismissResumeResult: () => void;
}

export function useProjects(): ProjectsControls {
  const api = getSeeyaApi();
  const panel = useIpcSubscription<ProjectsPanelData>(
    (listener) => api.onProjectsUpdate(listener),
    AWAITING_FIRST_PROJECTS_PANEL,
    () => api.getProjectsPanel(),
  );
  const [filter, setFilter] = useState<ProjectsTableFilter>('all');
  const [query, setQuery] = useState('');
  const [pendingProjectIds, setPendingProjectIds] = useState<ReadonlySet<string>>(() => new Set());

  const clearPending = useCallback((projectId: string) => {
    setPendingProjectIds((previous) => {
      if (!previous.has(projectId)) {
        return previous;
      }
      const next = new Set(previous);
      next.delete(projectId);
      return next;
    });
  }, []);

  useEffect(() => {
    // `label` is the project id for a tab `ProjectOpenTabLauncher` spawned (`main/project-ipc.ts`
    // passes `label: request.projectId`) — see this module's own top docstring for why this is
    // the signal `pending` clears on, not the (much later) `openProject` promise settling.
    api.onResumeTabOpened((event) => clearPending(event.label));
  }, [api, clearPending]);

  const onToggleFavorite = useCallback(
    (projectId: string, favorite: boolean) => {
      void api.toggleFavoriteProject({ projectId, favorite });
    },
    [api],
  );

  const onRowAction = useCallback(
    (row: ProjectPanelRow) => {
      const action = resolveProjectRowAction(row.lock);
      if (action.kind === 'goToTab') {
        selectTab(action.tabId);
        return;
      }
      // `open` and `readOnly` both resolve to the exact same `openProject` IPC call — the
      // existing read-only confirmation dialog (`project-lock-confirm-dialog-view.ts`,
      // unchanged) is what tells the two apart on screen, this is only the ligação
      // `docs/INTERFACE.md` § 4 itself asks for.
      setPendingProjectIds((previous) => new Set(previous).add(row.projectId));
      // `.then(onSettled, onSettled)`, not `.finally()` — `.finally()` alone still leaves the
      // ORIGINAL rejection unhandled (an "unhandled promise rejection" console warning on every
      // declined/failed open); there is no result area in this tab to show that failure in
      // (`docs/INTERFACE.md` § 4 names none, Q-105), so this only ever clears the pending flag.
      void api.openProject({ projectId: row.projectId }).then(
        () => clearPending(row.projectId),
        () => clearPending(row.projectId),
      );
    },
    [api, clearPending],
  );

  const isRowActionPending = useCallback(
    (row: ProjectPanelRow) =>
      resolveProjectRowAction(row.lock).kind !== 'goToTab' && pendingProjectIds.has(row.projectId),
    [pendingProjectIds],
  );

  const rows = useMemo(
    () => buildProjectsTableRows(panel.projects, filter, query),
    [panel.projects, filter, query],
  );

  const [expandedProjectIds, setExpandedProjectIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const onToggleExpanded = useCallback((projectId: string) => {
    setExpandedProjectIds((previous) => {
      const next = new Set(previous);
      if (!next.delete(projectId)) {
        next.add(projectId);
      }
      return next;
    });
  }, []);
  const projectResume = useProjectSessionResume();
  const sessionsPanel = useMemo(
    () => ({
      isResumePending: projectResume.isPending,
      onResume: projectResume.resume,
      onGoToTab: selectTab,
      onShowAll: showProjectSessionsInSessionsTab,
    }),
    [projectResume.isPending, projectResume.resume],
  );

  return {
    panel,
    filter,
    setFilter,
    query,
    setQuery,
    rows,
    onToggleFavorite,
    onRowAction,
    isRowActionPending,
    openNewProject: openNewProjectDialog,
    expandedProjectIds,
    onToggleExpanded,
    sessionsPanel,
    resumeResult: projectResume.result,
    dismissResumeResult: projectResume.dismissResult,
  };
}
