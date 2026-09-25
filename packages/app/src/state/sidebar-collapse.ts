/**
 * Whether the lateral is collapsed (V2-T30 item 2) — a view preference, never configuration: it
 * doesn't go into `config.json` (a `Config` field would mean every OTHER machine/window sharing
 * that file inherits one window's own layout choice), so it lives in the renderer's own
 * `localStorage` instead, read back with a protected parse. Pure: the actual
 * `localStorage.getItem`/`setItem` calls are `electron/`'s job (DOM-dependent, untestable outside a
 * real renderer, same exemption every other `electron/` glue already has) — this module only
 * decides what a raw stored value MEANS.
 */
import { MESSAGES } from '../text/messages.js';

/** The one key this preference is stored under — kept here, not repeated at each call site. */
export const SIDEBAR_COLLAPSED_STORAGE_KEY = 'seeya.sidebarCollapsed';

/**
 * D-025: absence or a value that doesn't parse both mean "nothing decided yet", which reads as
 * "open" (the plan's own "sem valor, abre aberta") — never as a guess either way. `localStorage`
 * can also throw outright (a private window, blocked site data) — the caller wraps the READ in a
 * `try`/`catch` and passes `null` here on failure, so this function itself never has to guess what
 * an exception meant.
 *
 * @example
 * parseSidebarCollapsedPreference('true')  // true
 * parseSidebarCollapsedPreference(null)    // false — nothing stored yet, open by default
 * parseSidebarCollapsedPreference('oops')  // false — malformed, never trusted
 */
export function parseSidebarCollapsedPreference(raw: string | null): boolean {
  return raw === 'true';
}

/** The value to persist for `collapsed` — the other half of `parseSidebarCollapsedPreference`'s
 * round trip, kept here so both sides of the encoding live in one place. */
export function encodeSidebarCollapsedPreference(collapsed: boolean): string {
  return collapsed ? 'true' : 'false';
}

export interface SidebarToggleButtonLabel {
  readonly glyph: string;
  readonly tooltip: string;
}

/**
 * The toolbar's sidebar-toggle button's glyph and tooltip for a given state (maintainer
 * acceptance, 2026-09-25). Pulled out as a pure function so `electron/sidebar-collapse-view.ts`
 * carries no branching of its own (D-041) and so "does the label/tooltip update correctly per
 * state" is provable without a DOM — this package has no jsdom/happy-dom dependency, and
 * `electron/` is proven by the real-window screenshot instrumentation instead
 * (`vitest.config.ts`'s own `APP_ELECTRON_SOURCE` docstring), matching every other file in that
 * directory rather than adding a new test-only dependency for three lines of wiring.
 *
 * @example
 * sidebarToggleButtonLabel(false) // { glyph: '«', tooltip: 'Hide sidebar (Ctrl+B)' }
 * sidebarToggleButtonLabel(true)  // { glyph: '»', tooltip: 'Show sidebar (Ctrl+B)' }
 */
export function sidebarToggleButtonLabel(collapsed: boolean): SidebarToggleButtonLabel {
  return collapsed
    ? { glyph: MESSAGES.sidebarToggleButtonShow, tooltip: MESSAGES.sidebarToggleTooltipShow }
    : { glyph: MESSAGES.sidebarToggleButtonHide, tooltip: MESSAGES.sidebarToggleTooltipHide };
}
