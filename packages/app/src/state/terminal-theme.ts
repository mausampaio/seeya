/**
 * The embedded terminal's colours (V2-T6 follow-up, maintainer's request 2026-09-17). Until a
 * settings screen exists for fonts and colours, one fixed theme per identity mode: a dark
 * blue-grey background instead of xterm.js's default pure black — pure black was measured by the
 * maintainer as tiring to read for a full day; the slight blue tint is the same direction most
 * dark editor themes take (VS Code's Dark+ sits at #1e1e1e, this one adds a hint of blue).
 * Foreground and selection are chosen to keep the harness TUIs' own colours readable on top of it.
 * Pure constant: no I/O, no DOM — `electron/renderer.ts` applies it in `new Terminal({...})` AND on
 * the pane element, so the two never disagree.
 */
export interface TerminalTheme {
  readonly background: string;
  readonly foreground: string;
  readonly cursor: string;
  readonly selectionBackground: string;
}

export const TERMINAL_THEME_DARK: TerminalTheme = {
  background: '#1b1f27',
  foreground: '#d6dae0',
  cursor: '#d6dae0',
  selectionBackground: '#3a4a63',
};

/**
 * V2-T62 (D-051): "o terminal segue o tema" (`docs/INTERFACE.md` princípio 1) — the light
 * counterpart of `TERMINAL_THEME_DARK` above, built from the SAME light-theme tokens
 * `electron/tokens.css` declares (`--seeya-surface`/`--seeya-text`/`--seeya-brand-soft`,
 * `design/IDENTIDADE_VISUAL.md` § 5.1), so the terminal pane never looks like a foreign dark
 * rectangle dropped into an otherwise light window.
 */
export const TERMINAL_THEME_LIGHT: TerminalTheme = {
  background: '#ffffff',
  foreground: '#121214',
  cursor: '#121214',
  selectionBackground: '#eceaff',
};

/** Picks the terminal theme that matches the window's own resolved theme
 * (`theme/resolve-theme.ts#resolveEffectiveTheme`) — the one decision point so a caller never has
 * to duplicate the light/dark branch itself. */
export function resolveTerminalTheme(effectiveTheme: 'light' | 'dark'): TerminalTheme {
  return effectiveTheme === 'dark' ? TERMINAL_THEME_DARK : TERMINAL_THEME_LIGHT;
}
