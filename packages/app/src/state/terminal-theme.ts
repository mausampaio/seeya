/**
 * The embedded terminal's colours (V2-T6 follow-up, maintainer's request 2026-09-17). Until a
 * settings screen exists for fonts and colours, one fixed theme: a dark blue-grey background
 * instead of xterm.js's default pure black — pure black was measured by the maintainer as
 * tiring to read for a full day; the slight blue tint is the same direction most dark editor
 * themes take (VS Code's Dark+ sits at #1e1e1e, this one adds a hint of blue). Foreground and
 * selection are chosen to keep the harness TUIs' own colours readable on top of it. Pure
 * constant: no I/O, no DOM — `electron/renderer.ts` applies it in `new Terminal({...})` AND on
 * the pane element, so the two never disagree.
 */
export interface TerminalTheme {
  readonly background: string;
  readonly foreground: string;
  readonly cursor: string;
  readonly selectionBackground: string;
}

export const TERMINAL_THEME: TerminalTheme = {
  background: '#1b1f27',
  foreground: '#d6dae0',
  cursor: '#d6dae0',
  selectionBackground: '#3a4a63',
};
