/**
 * The embedded terminal's colours (`docs/INTERFACE.md` princípio 1, "o terminal segue o tema").
 *
 * PO review (2026-10-01, V2-T75 acceptance): this module used to hardcode two full hex palettes
 * (`TERMINAL_THEME_DARK`/`TERMINAL_THEME_LIGHT`), one of them a "dark blue-grey instead of pure
 * black" the maintainer picked by hand back in V2-T6, before `tokens.css`'s own design-token
 * system existed (V2-T62, D-051). Nothing kept that hex in sync with `--seeya-background` once
 * the token system landed, so the terminal pane drifted to a visibly different shade (`#1b1f27`)
 * than the window's own background (`--seeya-background`, `#18181d`/`#0d0d10` depending on which
 * dark token it actually was) — a real-screenshot-caught defect, not a hypothetical one.
 *
 * `buildTerminalThemeFromTokens` below replaces both hardcoded palettes: it builds a
 * `TerminalTheme` straight from CSS token VALUES the caller already resolved, so the terminal can
 * never again drift from its own chrome — there is no second palette left to fall out of sync.
 * This module stays pure (no I/O, no DOM) on purpose: `renderer/legacy/theme-view.ts`'s own
 * `getComputedStyle` call is the only DOM access in this whole feature, which is what keeps this
 * file trivially testable with made-up colour strings instead of a real window.
 */
export interface TerminalTheme {
  readonly background: string;
  readonly foreground: string;
  readonly cursor: string;
  readonly selectionBackground: string;
}

/** The four `tokens.css` custom properties a terminal theme is built from — "fundo = fundo da
 * aplicação, texto = texto primário" (PO review) is `background`/`text` below; `brandSoft` is the
 * same soft-highlight token every other "selected" surface in this window already uses
 * (`design/IDENTIDADE_VISUAL.md` § 3.4), not a new, terminal-only colour decision. */
export interface TerminalThemeTokens {
  readonly background: string;
  readonly text: string;
  readonly brandSoft: string;
}

/**
 * @example
 * buildTerminalThemeFromTokens({ background: '#18181d', text: '#f7f7f8', brandSoft: '#25214e' })
 * // -> { background: '#18181d', foreground: '#f7f7f8', cursor: '#f7f7f8', selectionBackground: '#25214e' }
 */
export function buildTerminalThemeFromTokens(tokens: TerminalThemeTokens): TerminalTheme {
  return {
    background: tokens.background,
    foreground: tokens.text,
    cursor: tokens.text,
    selectionBackground: tokens.brandSoft,
  };
}

/** Used only before the window's real theme round trip resolves — `terminal-theme-registry.ts`'s
 * own docstring: "so a tab mounted before the theme round trip resolves still renders something
 * coherent." A plain, reasonable dark fallback (the dark theme's own token values, inlined since
 * this constant exists specifically for the moment before `getComputedStyle` has anything live to
 * read) — never shown for more than the first paint in practice. */
export const FALLBACK_TERMINAL_THEME: TerminalTheme = {
  background: '#18181d',
  foreground: '#f7f7f8',
  cursor: '#f7f7f8',
  selectionBackground: '#25214e',
};
