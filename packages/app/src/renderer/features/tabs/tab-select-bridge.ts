/**
 * Switches to an already-open tab by id, from OUTSIDE this feature (V2-T67) — same shape as
 * `page-tab-bridge.ts`/`focus-bridge.ts`, this module's own direct precedent: a tiny pub/sub so a
 * sibling feature (the Projects tab's own "Go to tab" row action, `renderer/features/projects/`)
 * can select a tab without either feature importing the other's component tree. `useTabStrip.ts`
 * is the only module that ever calls `registerTabSelector`, once, on mount — by the time a person
 * can click a row, the real implementation is already registered (the tab strip and every page
 * tab mount synchronously as part of the same `<App/>` render).
 *
 * Unlike `openOrFocusPageTab` (which only ever targets one of the three fixed page tabs),
 * `selectTab` takes any tab id — a terminal tab included, which is the whole point: "Go to tab"
 * names the EXACT tab a project's own session is already open in (`ProjectRowLock`'s own
 * `openHere.tabId`, `state/projects-panel.ts`), never just "switch to some page".
 */
type TabSelector = (id: string) => void;

let selector: TabSelector | null = null;

/** Called once, by `useTabStrip.ts`, on mount. */
export function registerTabSelector(fn: TabSelector): void {
  selector = fn;
}

/**
 * @example
 * selectTab('tab-3'); // switches to that already-open tab
 */
export function selectTab(id: string): void {
  selector?.(id);
}
