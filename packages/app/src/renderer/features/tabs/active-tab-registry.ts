/**
 * Which tab is currently showing (V2-T64, replaces `renderer/legacy/tabs-view.ts
 * #onActiveTabChanged`, apagado by this task) — a tiny module-level pub/sub, not component state,
 * because `renderer/features/sidebar/useSidebar.ts` needs to react to it from OUTSIDE this
 * feature's own component tree (its own NavItem/TodayCard highlight whichever page tab is active)
 * and Preact has no ambient "read another feature's hook state" mechanism. `useTabStrip.ts` is the
 * ONLY module that ever calls `setActiveTabId` — every other caller only ever listens.
 *
 * Mirrors the exact shape (and the exact "never calls a newly-registered listener with the
 * current value" behaviour) `tabs-view.ts`'s own `onActiveTabChanged`/`activeTabListeners` had, so
 * `useSidebar.ts` keeps working unchanged beyond its own import path.
 */
type ActiveTabListener = (id: string) => void;

const listeners: ActiveTabListener[] = [];

/** Called once, by `useTabStrip.ts`, whenever the active tab changes. */
export function setActiveTabId(id: string): void {
  for (const listener of listeners) {
    listener(id);
  }
}

export function onActiveTabChanged(listener: ActiveTabListener): void {
  listeners.push(listener);
}
