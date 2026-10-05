/**
 * The three pieces of state the ambient refresh tick (`ambient-refresh.ts`) writes and the IPC
 * handlers (`today-ipc.ts`, `daemon-ipc.ts`) read (V2-T51: they were closed-over `let`s inside
 * `wireIpc` in `main/main.ts`; one mutable object keeps the same "only this window's wiring
 * touches it" scope now that the handlers live in separate modules). Each field keeps the comment
 * it had as a variable.
 */
import { type SidebarRow } from '../sidebar/sidebar-data.js';
import { type AutostartCacheEntry } from '../state/autostart-cache.js';
import { type TodayPanelInputs } from '../state/today-panel.js';

export interface AmbientState {
  // Same "closed-over, only this function touches it" reasoning as `tabs` above —
  // `state/autostart-cache.ts`'s own docstring has the caching rule and the measurement behind it.
  autostartCache: AutostartCacheEntry | null;
  // V2-T9 item 4: the sidebar's own rows from the MOST RECENT refresh tick (below) — "Today"'s
  // own getTodayPanel handler reuses this instead of a second SessionProvider.list() call, per
  // the plan entry's own "a partir da descoberta de sessões que ele já faz a cada ciclo". Empty
  // until the first tick runs, which is fine (D-025): no session is "running now" before this
  // window has ever discovered any.
  latestSidebarRows: readonly SidebarRow[];
  // V2-T18 item 2: the "Today" panel's own lookup/cwd-history from the last time getTodayPanel
  // below actually built them (window startup, or after resumeSelected/endDayRun refetch it) —
  // the refresh tick reuses these AS-IS, layering in only a fresh liveSessionIds
  // (refreshTodayPanelLiveness's own docstring), instead of repeating findPendingBriefing/
  // readCwdHistory's own storage scans every REFRESH_INTERVAL_MS. `null` until the first
  // getTodayPanel call resolves, which is fine (D-025): the tick below just skips that push.
  latestTodayPanelInputs: TodayPanelInputs | null;
}

export function createAmbientState(): AmbientState {
  return { latestSidebarRows: [], latestTodayPanelInputs: null, autostartCache: null };
}
