/**
 * "O terminal segue o tema" (`docs/INTERFACE.md` princípio 1) — live, for every open tab at once,
 * from OUTSIDE this feature (`renderer/legacy/theme-view.ts` calls `setActiveTerminalTheme`
 * whenever the window's effective theme changes). Replaces `renderer/legacy/tabs-view.ts
 * #setActiveTerminalTheme`, apagado by this task. Module-level, not component state, for the same
 * reason `active-tab-registry.ts`/`page-tab-bridge.ts` are: a `@xterm/xterm` `Terminal` instance is
 * an imperative object a `TerminalPane` owns in its own `useRef`, never something worth lifting
 * into Preact state — this registry is just the live list of "which instances currently exist",
 * so a theme change can reach every one of them without `TerminalPane` importing `theme-view.ts`
 * back (which would be circular: `theme-view.ts` → here → nothing, keeps it one-directional).
 */
import type { Terminal } from '@xterm/xterm';
import { FALLBACK_TERMINAL_THEME, type TerminalTheme } from '../../../state/terminal-theme.js';

interface RegisteredTerminal {
  readonly terminal: Terminal;
  /** Sets the pane's own background colour, so the padding around the cell grid never shows a
   * different shade than the terminal itself (`TerminalPane`'s own docstring). */
  readonly setBackground: (color: string) => void;
}

/** Defaults to the dark theme — this app's original, only theme before V2-T62 — so a tab mounted
 * before the theme round trip resolves still renders something coherent; `renderer.tsx#main`
 * always resolves the real theme before anyone can open a tab in practice. */
let activeTheme: TerminalTheme = FALLBACK_TERMINAL_THEME;

const registered = new Map<string, RegisteredTerminal>();

export function currentActiveTerminalTheme(): TerminalTheme {
  return activeTheme;
}

/** Called by `TerminalPane` on mount — applies the CURRENT theme immediately, so a tab opened
 * after a theme change never briefly shows the old one. */
export function registerTerminalForTheme(
  id: string,
  terminal: Terminal,
  setBackground: (color: string) => void,
): void {
  registered.set(id, { terminal, setBackground });
  terminal.options.theme = activeTheme;
  setBackground(activeTheme.background);
}

/** Called by `TerminalPane` on unmount. */
export function unregisterTerminalForTheme(id: string): void {
  registered.delete(id);
}

/** Called by `renderer/legacy/theme-view.ts` whenever the window's effective theme changes —
 * updates every tab mounted so far AND becomes the theme every tab mounted AFTER this point reads
 * (`registerTerminalForTheme` above). */
export function setActiveTerminalTheme(theme: TerminalTheme): void {
  activeTheme = theme;
  for (const { terminal, setBackground } of registered.values()) {
    terminal.options.theme = theme;
    setBackground(theme.background);
  }
}
