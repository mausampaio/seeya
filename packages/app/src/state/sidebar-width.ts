/**
 * The sidebar's own width (PO acceptance of V2-T55, correction 2, 2026-09-25) — a view
 * preference, never configuration, same reasoning `state/sidebar-collapse.ts` already gives for
 * whether the sidebar is collapsed at all: it doesn't go into `config.json` (a `Config` field
 * would mean every OTHER machine/window sharing that file inherits one window's own layout
 * choice), so it lives in the renderer's own `localStorage` instead, read back with the identical
 * protected-parse discipline. Pure: the actual `localStorage.getItem`/`setItem` calls are
 * `electron/sidebar-resize-view.ts`'s job (DOM-dependent, untestable outside a real renderer,
 * same exemption every other `electron/` glue already has) — this module only decides what a raw
 * stored value MEANS, and what counts as a valid width at all.
 */

/** The one key this preference is stored under — kept here, not repeated at each call site. */
export const SIDEBAR_WIDTH_STORAGE_KEY = 'seeya.sidebarWidth';

/** Matches the sidebar's own CSS fallback (`index.css`'s own `#sidebar { width: var(--sidebar-width, 260px) }`). */
export const DEFAULT_SIDEBAR_WIDTH = 260;
/** Narrow enough to still read a session row without wrapping every word, wide enough that the
 * handle stays reachable. */
export const MIN_SIDEBAR_WIDTH = 180;
/** Wide enough for a long directory label to breathe, capped so the sidebar can never eat the
 * whole window on a small screen. */
export const MAX_SIDEBAR_WIDTH = 480;

/** The one place a raw width (from `localStorage`, or from a drag in progress) gets forced back
 * into range — never a width outside `[MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH]` reaches the DOM. */
export function clampSidebarWidth(width: number): number {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width));
}

/**
 * D-025: absence, a value that doesn't parse as a finite number, or `localStorage` throwing
 * outright (a private window, blocked site data — the caller wraps the READ and passes `null`
 * here on failure) all mean "nothing decided yet", which reads as the default width — never a
 * guessed one.
 *
 * @example
 * parseSidebarWidthPreference('320')  // 320
 * parseSidebarWidthPreference(null)   // 260 — nothing stored yet
 * parseSidebarWidthPreference('oops') // 260 — malformed, never trusted
 * parseSidebarWidthPreference('50')   // 180 — stored value existed but was out of range, clamped
 */
export function parseSidebarWidthPreference(raw: string | null): number {
  // `Number('')` is `0`, not `NaN` — an empty string has to be rejected explicitly, or it would
  // silently parse as a "valid" (if out-of-range) width instead of reading as "nothing stored".
  if (raw === null || raw.trim() === '') {
    return DEFAULT_SIDEBAR_WIDTH;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_SIDEBAR_WIDTH;
  }
  return clampSidebarWidth(parsed);
}

/** The value to persist for `width` — the other half of `parseSidebarWidthPreference`'s round
 * trip, kept here so both sides of the encoding live in one place. Always clamped, so a caller
 * can never accidentally persist an out-of-range width. */
export function encodeSidebarWidthPreference(width: number): string {
  return String(clampSidebarWidth(width));
}
