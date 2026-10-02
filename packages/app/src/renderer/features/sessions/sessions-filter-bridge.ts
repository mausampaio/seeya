/**
 * V2-T77 (`docs/INTERFACE.md` § 5a): the Projects tab's "Show all in Sessions" — opens the Sessions
 * tab already filtered to one project. Same bridge shape as `tabs/tab-select-bridge.ts`/
 * `projects/new-project-dialog-bridge.ts`: `useSessions.ts` registers the real setter once, on
 * mount (`<Sessions/>` mounts once for the life of the window, even while its tab is hidden), and
 * the Projects tab calls this without importing the Sessions component — no import cycle, and
 * neither tab owns the other's state.
 *
 * Resets every other filter and the search along with it: "all of this project's sessions" must
 * not be hidden by a leftover State/Directory filter or query from an earlier visit.
 */
import { openOrFocusPageTab } from '../tabs/page-tab-bridge.js';

type ProjectFilterSetter = (projectId: string) => void;

let setter: ProjectFilterSetter | null = null;

/** Called once, by `useSessions.ts`, on mount. */
export function registerSessionsProjectFilterSetter(fn: ProjectFilterSetter): void {
  setter = fn;
}

/**
 * @example
 * showProjectSessionsInSessionsTab('auth-hardening'); // Sessions tab, filtered to that project
 */
export function showProjectSessionsInSessionsTab(projectId: string): void {
  setter?.(projectId);
  openOrFocusPageTab('sessions');
}
