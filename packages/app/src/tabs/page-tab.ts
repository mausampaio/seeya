/**
 * "Abas de página" (V2-T63, `docs/INTERFACE.md` § 2) — the tab strip's OTHER kind of tab, next to
 * a terminal's `Tab` (`tabs/tab-model.ts`): a page tab has no pty, no pid, no process to exit —
 * it shows a fixed region of the window (Today, Projects, Sessions) inside the same tab strip and
 * content area a terminal tab uses. Deliberately its own, much smaller type rather than folded
 * into `Tab` — a page never spawns, never exits, and never matches a discovered session by pid
 * (D-024: those fields would all have to become optional on `Tab` for no page tab to ever use).
 *
 * This module is pure (kind + label only); `electron/page-tab-strip.ts` is the DOM mechanism that
 * opens/focuses/closes a page tab's own pane, reusing the terminal tab strip's own pane-visibility
 * bookkeeping (`electron/tabs-view.ts`).
 */
export type PageTabKind = 'today' | 'projects' | 'sessions';

/** Every page-tab id in the shared tab strip is `page-<kind>` — one place, so
 * `electron/page-tab-strip.ts`/`electron/tabs-view.ts` never spell the prefix out twice. */
export function pageTabId(kind: PageTabKind): string {
  return `page-${kind}`;
}

/** The three kinds, in the fixed order they're offered (never reordered by use — a stable order
 * reads easier than a "most recently opened" one for a set this small). */
export const PAGE_TAB_KINDS: readonly PageTabKind[] = ['today', 'projects', 'sessions'];
