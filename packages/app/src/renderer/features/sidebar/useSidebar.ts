/**
 * D-052 (V2-T75): the lateral's own Today card/Favorites/Recent/"All projects"/"Sessions" data and
 * actions — replaces `renderer/legacy/sidebar-favorites-view.tsx` (superseded by this feature,
 * deleted by this task). Independent of `renderer/legacy/projects-list-view.tsx`/
 * `today-panel-view.ts` on purpose (their own first-paint idiom, unchanged by this task: each
 * region fetches its own copy once at startup, then keeps itself current from the matching push)
 * — this hook needs BOTH `ProjectsPanelData` and `TodayPanelData` together, so it keeps its own
 * subscriptions to each rather than reaching into another view module's private state.
 *
 * `activeTabId` comes from `renderer/features/tabs#onActiveTabChanged` (V2-T64: moved out of the
 * now-deleted `renderer/legacy/tabs-view.ts`, same mechanism) — the single place tab visibility
 * changes — and opening a page tab goes through `renderer/features/tabs#openOrFocusPageTab` (moved
 * out of the deleted `renderer/legacy/page-tab-strip.ts`), the mechanism the V2-T66/67/68 region
 * tasks will keep reusing.
 */
import { useEffect, useState } from 'preact/hooks';
import { getSeeyaApi } from '../../ipc/client.js';
import { useIpcSubscription } from '../../hooks/useIpcSubscription.js';
import type { ProjectsPanelData } from '../../../state/projects-panel.js';
import type { TodayPanelData } from '../../../state/today-panel.js';
import {
  buildFavoriteProjectRows,
  buildRecentProjectRows,
  countRunningSessions,
  type FavoriteProjectRow,
  type RecentProjectRow,
} from '../../../state/sidebar-summary.js';
import { buildTodayCardSummary, type TodayCardSummary } from '../../../state/today-panel.js';
import { onActiveTabChanged, openOrFocusPageTab } from '../tabs/index.js';
import { pageTabId, type PageTabKind } from '../../../tabs/page-tab.js';

const NO_BRIEFING_TODAY: TodayPanelData = { kind: 'noBriefing', message: '' };

export interface SidebarData {
  readonly todayCard: TodayCardSummary;
  readonly favorites: readonly FavoriteProjectRow[];
  readonly recent: readonly RecentProjectRow[];
  readonly allProjectsCount: number;
  readonly runningSessionsCount: number;
  readonly activeTabId: string | null;
  readonly openToday: () => void;
  readonly openProjects: () => void;
  readonly openSessions: () => void;
  readonly openProject: (projectId: string) => void;
  readonly toggleFavorite: (projectId: string, favorite: boolean) => void;
}

function useActiveTabId(): string | null {
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  // `onActiveTabChanged` (legacy, in-renderer pub/sub) has no unsubscribe of its own — see its own
  // docstring. Harmless here: `<Sidebar/>` mounts once for the life of the window, so this
  // listener is never registered twice.
  useEffect(() => {
    onActiveTabChanged(setActiveTabId);
  }, []);
  return activeTabId;
}

/** Before the first `getProjectsPanel`/`onProjectsUpdate` value arrives (D-025: no data yet is
 * not "zero projects", but every derived count/list below treats it the same way a real empty
 * panel would — the sidebar shows "Nothing recent yet."/0 for a heartbeat, never a guess). */
const AWAITING_FIRST_PROJECTS_PANEL: ProjectsPanelData = {
  projects: [],
  otherSessionsByDirectory: [],
  ignoredProjects: [],
};

export function useSidebar(): SidebarData {
  const api = getSeeyaApi();
  // Wrapped in an arrow function, not passed as a bare `api.onProjectsUpdate` reference —
  // `@typescript-eslint/unbound-method` flags a detached method reference on principle (it can't
  // see that `SeeyaApi`'s own implementation, `main/preload.ts`, never touches `this`); this is
  // the same fix at every call site in this file rather than reshaping the whole interface.
  // V2-T75 PO review (2026-10-01, round 3), production defect: `getProjectsPanel`/`getTodayPanel`
  // used to be called here and their return value thrown away, so this hook's state depended
  // ENTIRELY on the ambient refresh loop's own push — which loses its first tick to the exact race
  // `CHANNELS.getProjectsPanel`'s own docstring describes, leaving the real window showing "No
  // favorites yet"/"All projects 0" for up to two refresh intervals after every open. Passing the
  // invoke as `fetchInitial` seeds state from its answer as soon as it resolves instead
  // (`useIpcSubscription`'s own docstring); the push above still drives every update after that —
  // this fixes WHEN the first real value lands, never which value wins once both are in.
  const projects = useIpcSubscription<ProjectsPanelData>(
    (listener) => api.onProjectsUpdate(listener),
    AWAITING_FIRST_PROJECTS_PANEL,
    () => api.getProjectsPanel(),
  );
  const today = useIpcSubscription<TodayPanelData>(
    (listener) => api.onTodayUpdate(listener),
    NO_BRIEFING_TODAY,
    () => api.getTodayPanel(),
  );
  const activeTabId = useActiveTabId();

  return {
    todayCard: buildTodayCardSummary(today),
    favorites: buildFavoriteProjectRows(projects.projects, activeTabId),
    recent: buildRecentProjectRows(projects.projects, activeTabId),
    allProjectsCount: projects.projects.length,
    runningSessionsCount: countRunningSessions(
      projects.projects,
      projects.otherSessionsByDirectory,
    ),
    activeTabId,
    openToday: () => openOrFocusPageTab('today'),
    openProjects: () => openOrFocusPageTab('projects'),
    openSessions: () => openOrFocusPageTab('sessions'),
    openProject: (projectId) => void api.openProject({ projectId }),
    toggleFavorite: (projectId, favorite) =>
      void api.toggleFavoriteProject({ projectId, favorite }),
  };
}

/** Whether `kind`'s own page tab is the one currently showing — `NavItem`/`TodayCard`'s own
 * `active` prop. */
export function isPageTabActive(activeTabId: string | null, kind: PageTabKind): boolean {
  return activeTabId === pageTabId(kind);
}
