/**
 * Opens/focuses a page tab from OUTSIDE this feature (V2-T64, replaces `renderer/legacy/
 * page-tab-strip.ts#openOrFocusPageTab`, apagado by this task) — `renderer/features/sidebar/
 * useSidebar.ts`'s own Today card/"All projects"/"Sessions" actions call this; `useTabStrip.ts`
 * is the only module that ever calls `registerPageTabOpener`, once, on mount (the tab strip and
 * the sidebar both mount synchronously as part of the same `<App/>` render, so by the time a
 * person can click anything the real implementation is already registered — the same "mounts once
 * for the life of the window" guarantee `active-tab-registry.ts` relies on).
 */
import type { PageTabKind } from '../../../tabs/page-tab.js';

type PageTabOpener = (kind: PageTabKind) => void;

let opener: PageTabOpener | null = null;

/** Called once, by `useTabStrip.ts`, on mount. */
export function registerPageTabOpener(fn: PageTabOpener): void {
  opener = fn;
}

/**
 * @example
 * openOrFocusPageTab('projects'); // opens (or focuses) the Projects tab
 */
export function openOrFocusPageTab(kind: PageTabKind): void {
  opener?.(kind);
}
