/**
 * D-052 (V2-T75): the lateral's own Today card/Favorites/Recent/"All projects"/"Sessions" data and
 * actions — replaces `renderer/legacy/sidebar-favorites-view.tsx` (superseded by this feature,
 * deleted by this task). Independent of `renderer/legacy/projects-list-view.tsx`/
 * `today-panel-view.ts` on purpose (their own first-paint idiom, unchanged by this task: each
 * region fetches its own copy once at startup, then keeps itself current from the matching push)
 * — this hook needs BOTH `ProjectsPanelData` and `TodayPanelData` together, so it keeps its own
 * subscriptions to each rather than reaching into another view module's private state.
 *
 * `activeTabId` still comes from `renderer/legacy/tabs-view.ts#onActiveTabChanged` — the single
 * place tab visibility changes, unchanged by this task — and opening a page tab still goes through
 * `renderer/legacy/page-tab-strip.ts#openOrFocusPageTab`, the mechanism the V2-T66/67/68 region
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
import { onActiveTabChanged } from '../../legacy/tabs-view.js';
import { openOrFocusPageTab } from '../../legacy/page-tab-strip.js';
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
  const projects = useIpcSubscription<ProjectsPanelData>(
    (listener) => api.onProjectsUpdate(listener),
    AWAITING_FIRST_PROJECTS_PANEL,
  );
  const today = useIpcSubscription<TodayPanelData>(
    (listener) => api.onTodayUpdate(listener),
    NO_BRIEFING_TODAY,
  );
  const activeTabId = useActiveTabId();

  // First-paint fetch for both — each return value is discarded on purpose
  // (`main/project-ipc.ts`'s own docstring: `getProjectsPanel`/`getTodayPanel` exist so the FIRST
  // render doesn't wait for the ambient refresh tick); this hook's state is set only by the
  // `onProjectsUpdate`/`onTodayUpdate` pushes above, so every consumer (this hook, the legacy
  // Projects tab, the legacy Today tab) always agrees on one value, never two slightly different
  // reads racing each other. Runs once, same reasoning as `useIpcSubscription`.
  useEffect(() => {
    void api.getProjectsPanel();
    void api.getTodayPanel();
  }, [api]);

  return {
    todayCard: buildTodayCardSummary(today),
    favorites: buildFavoriteProjectRows(projects.projects),
    recent: buildRecentProjectRows(projects.projects),
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
