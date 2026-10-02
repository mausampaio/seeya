/**
 * D-052 (V2-T68, `docs/INTERFACE.md` § 5): the Sessions tab's own data and actions. Derives every
 * row from `ProjectsPanelData` (`onProjectsUpdate`/`getProjectsPanel`, the same push the Projects
 * tab and the lateral already read) — never a second session discovery of its own
 * (AGENTS.md: "nunca uma segunda descoberta de sessões no ciclo").
 *
 * **The id direct-search check is against every row this window already knows about
 * (`allRows`), never the filtered/searched table on screen.** A session hidden by the State/
 * Project/Directory filters still counts as "already known" — those three filters narrow what's
 * shown, they say nothing about whether a session EXISTS. Only when no known row's `sessionId`
 * starts with the query AND the query itself looks like an id/prefix
 * (`core/session-id-shape.ts#looksLikeSessionIdReference`) does this hook fall back to the direct,
 * unwindowed lookup (`CHANNELS.findSessionById`, V2-T55) — `docs/INTERFACE.md` § 5's own "por id
 * que não esteja na lista, mantém a busca direta".
 *
 * **No debounce on the direct lookup** — `D-019` bans `setTimeout` outright in this renderer
 * (`TabStrip.tsx`'s own docstring already measured "no renderer exemption"), so this effect simply
 * re-runs on every keystroke once the query stops matching anything local and starts looking
 * id-shaped; a person pasting a full id fires it once, a person typing one character at a time
 * fires it a few more times — each call is a cheap, on-demand transcript scan (V2-T55's own
 * "nunca na 10s cycle"), never a cost paid by the ambient refresh loop.
 */
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import type { PathPlatformHint } from '@seeya-ai/engine/core/cwd-normalization.js';
import { looksLikeSessionIdReference } from '@seeya-ai/engine/core/session-id-shape.js';
import { getSeeyaApi } from '../../ipc/client.js';
import { useIpcSubscription } from '../../hooks/useIpcSubscription.js';
import { countRunningSessions } from '../../../state/sidebar-summary.js';
import type {
  ProjectPanelOtherSessionRow,
  ProjectsPanelData,
} from '../../../state/projects-panel.js';
import { flattenSessionsPanelRows, type SessionsPanelRow } from '../../../state/sessions-panel.js';
import {
  buildSessionsDirectoryFilterOptions,
  buildSessionsProjectFilterOptions,
  buildSessionsTableRows,
  DEFAULT_SESSIONS_TABLE_FILTERS,
  resolveSessionRowAction,
  type SessionsDirectoryFilterOption,
  type SessionsProjectFilterOption,
  type SessionsTableFilters,
} from '../../../state/sessions-table.js';
import { selectTab } from '../tabs/tab-select-bridge.js';
import { openAdoptionDialog } from '../adoption/adoption-dialog-bridge.js';
import { registerSessionsProjectFilterSetter } from './sessions-filter-bridge.js';
import {
  useProjectSessionResume,
  type ProjectSessionResumeResult,
} from '../../hooks/useProjectSessionResume.js';

const AWAITING_FIRST_PROJECTS_PANEL: ProjectsPanelData = {
  projects: [],
  otherSessionsByDirectory: [],
  ignoredProjects: [],
};

/** Same `platform === 'win32' ? 'win32' : 'posix'` mapping `useToday.ts`/`composition/index.ts`
 * already use. */
function toPlatformHint(platform: NodeJS.Platform): PathPlatformHint {
  return platform === 'win32' ? 'win32' : 'posix';
}

/** The direct id lookup's own four states (D-024, never flattened) — `docs/INTERFACE.md` § 5's
 * own "busca por id ambígua... nunca escolhe" and "busca por id sem resultado". */
export type DirectIdSearchState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'found'; readonly query: string; readonly row: SessionsPanelRow }
  | {
      readonly kind: 'ambiguous';
      readonly query: string;
      readonly rows: readonly SessionsPanelRow[];
    }
  | { readonly kind: 'notFound'; readonly query: string };

/** `CHANNELS.findSessionById`'s own row shape (`ProjectPanelOtherSessionRow`) never carries a
 * project — this lookup is a raw transcript/registry search, outside the ambient discovery that
 * `sidebar/project-sessions.ts#groupSessionsByProject` groups by `cwd`/fork/lock, so a hit here is
 * always shown as having no project, even on the rare chance its `cwd` happens to match one
 * (D-025: only evidence this window actually computed counts). */
function toSessionsPanelRow(session: ProjectPanelOtherSessionRow): SessionsPanelRow {
  return { ...session, projectId: null, projectName: null, adopt: session.adopt };
}

export interface SessionsControls {
  readonly totalCount: number;
  readonly runningCount: number;
  readonly query: string;
  readonly setQuery: (query: string) => void;
  readonly filters: SessionsTableFilters;
  readonly setStateFilter: (state: SessionsTableFilters['state']) => void;
  readonly setProjectFilter: (project: SessionsTableFilters['project']) => void;
  readonly setDirectoryFilter: (directory: SessionsTableFilters['directory']) => void;
  readonly projectOptions: readonly SessionsProjectFilterOption[];
  readonly directoryOptions: readonly SessionsDirectoryFilterOption[];
  readonly directSearch: DirectIdSearchState;
  /** Rows to render right now — the direct lookup's own result while one is relevant, the locally
   * filtered/searched list otherwise (D-041: `Sessions.tsx` never re-derives this choice). */
  readonly rows: readonly SessionsPanelRow[];
  readonly hasAnySession: boolean;
  readonly homeDir: string;
  readonly platformHint: PathPlatformHint;
  readonly onRowAction: (row: SessionsPanelRow) => void;
  readonly isResumePending: (row: SessionsPanelRow) => boolean;
  readonly onAdopt: (row: SessionsPanelRow) => void;
  /** V2-T77: what happened to the last project-session `Resume` started from this tab — never
   * silent (`useProjectSessionResume.ts`'s own top docstring). */
  readonly resumeResult: ProjectSessionResumeResult | null;
  readonly dismissResumeResult: () => void;
}

export function useSessions(): SessionsControls {
  const api = getSeeyaApi();
  const panel = useIpcSubscription<ProjectsPanelData>(
    (listener) => api.onProjectsUpdate(listener),
    AWAITING_FIRST_PROJECTS_PANEL,
    () => api.getProjectsPanel(),
  );
  const [homeDir, setHomeDir] = useState('');
  useEffect(() => {
    void api.getHomeDir().then(setHomeDir);
  }, [api]);
  const platformHint = toPlatformHint(api.platform);

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SessionsTableFilters>(DEFAULT_SESSIONS_TABLE_FILTERS);
  const projectResume = useProjectSessionResume();
  const [pendingResumeIds, setPendingResumeIds] = useState<ReadonlySet<string>>(() => new Set());

  // V2-T77: the Projects tab's "Show all in Sessions" lands here — see `sessions-filter-bridge.ts`.
  useEffect(() => {
    registerSessionsProjectFilterSetter((projectId) => {
      setQuery('');
      setFilters({ ...DEFAULT_SESSIONS_TABLE_FILTERS, project: projectId });
    });
  }, []);

  const allRows = useMemo(() => flattenSessionsPanelRows(panel), [panel]);
  const localRows = useMemo(
    () => buildSessionsTableRows(allRows, filters, query, platformHint),
    [allRows, filters, query, platformHint],
  );
  const projectOptions = useMemo(() => buildSessionsProjectFilterOptions(allRows), [allRows]);
  const directoryOptions = useMemo(
    () => buildSessionsDirectoryFilterOptions(allRows, platformHint),
    [allRows, platformHint],
  );

  const trimmedQuery = query.trim();
  const matchesSomeKnownRow = useMemo(
    () => allRows.some((row) => row.sessionId.toLowerCase().startsWith(trimmedQuery.toLowerCase())),
    [allRows, trimmedQuery],
  );
  const shouldSearchDirectly =
    trimmedQuery !== '' && !matchesSomeKnownRow && looksLikeSessionIdReference(trimmedQuery);

  const [directSearch, setDirectSearch] = useState<DirectIdSearchState>({ kind: 'idle' });
  useEffect(() => {
    if (!shouldSearchDirectly) {
      setDirectSearch({ kind: 'idle' });
      return;
    }
    let active = true;
    setDirectSearch({ kind: 'loading' });
    void api.findSessionById({ idOrPrefix: trimmedQuery }).then((response) => {
      if (!active) {
        return;
      }
      if (response.kind === 'notFound') {
        setDirectSearch({ kind: 'notFound', query: trimmedQuery });
      } else if (response.kind === 'found') {
        setDirectSearch({
          kind: 'found',
          query: trimmedQuery,
          row: toSessionsPanelRow(response.session),
        });
      } else {
        setDirectSearch({
          kind: 'ambiguous',
          query: trimmedQuery,
          rows: response.candidates.map(toSessionsPanelRow),
        });
      }
    });
    return () => {
      active = false;
    };
  }, [api, shouldSearchDirectly, trimmedQuery]);

  const rows = useMemo(() => {
    switch (directSearch.kind) {
      case 'found':
        return [directSearch.row];
      case 'ambiguous':
        return directSearch.rows;
      case 'loading':
      case 'notFound':
        return [];
      case 'idle':
        return localRows;
    }
  }, [directSearch, localRows]);

  const clearPendingResume = useCallback((sessionId: string) => {
    setPendingResumeIds((previous) => {
      if (!previous.has(sessionId)) {
        return previous;
      }
      const next = new Set(previous);
      next.delete(sessionId);
      return next;
    });
  }, []);

  const onResume = useCallback(
    (row: SessionsPanelRow) => {
      setPendingResumeIds((previous) => new Set(previous).add(row.sessionId));
      void api.resumeSession({ sessionId: row.sessionId, cwd: row.cwd, name: row.name }).then(
        () => clearPendingResume(row.sessionId),
        () => clearPendingResume(row.sessionId),
      );
    },
    [api, clearPendingResume],
  );

  const onRowAction = useCallback(
    (row: SessionsPanelRow) => {
      const action = resolveSessionRowAction(row);
      if (action.kind === 'goToTab') {
        selectTab(action.tabId);
        return;
      }
      if (action.kind === 'standalone') {
        onResume(row);
        return;
      }
      if (action.kind === 'projectResume') {
        // V2-T77: a session that belongs to a project resumes through the project's own `open`
        // flow (lock, hooks, `CLAUDE.md`, the same questions), never the simple resume above.
        projectResume.resume(action.projectId, row.sessionId);
      }
      // `runningElsewhere` offers nothing clickable — this row action is only ever reached from
      // the table's own buttons, which don't render for it.
    },
    [onResume, projectResume],
  );

  const isResumePending = useCallback(
    (row: SessionsPanelRow) =>
      pendingResumeIds.has(row.sessionId) || projectResume.isPending(row.sessionId),
    [pendingResumeIds, projectResume],
  );

  const onAdopt = useCallback((row: SessionsPanelRow) => {
    openAdoptionDialog({
      sessionId: row.sessionId,
      name: row.name,
      displaySessionId: row.displaySessionId,
      cwd: row.cwd,
      state: row.state,
      stateLabel: row.stateLabel,
    });
  }, []);

  return {
    totalCount: allRows.length,
    runningCount: countRunningSessions(panel.projects, panel.otherSessionsByDirectory),
    query,
    setQuery,
    filters,
    setStateFilter: (state) => setFilters((previous) => ({ ...previous, state })),
    setProjectFilter: (project) => setFilters((previous) => ({ ...previous, project })),
    setDirectoryFilter: (directory) => setFilters((previous) => ({ ...previous, directory })),
    projectOptions,
    directoryOptions,
    directSearch,
    rows,
    hasAnySession: allRows.length > 0,
    homeDir,
    platformHint,
    onRowAction,
    isResumePending,
    onAdopt,
    resumeResult: projectResume.result,
    dismissResumeResult: projectResume.dismissResult,
  };
}
