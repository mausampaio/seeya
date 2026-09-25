/**
 * Whether a keydown event is the sidebar's toggle shortcut, `Ctrl+B` (`Cmd+B` on macOS) —
 * maintainer acceptance, 2026-09-25. Measured against this project's own bundled xterm.js
 * (`node_modules/@xterm/xterm/lib/xterm.mjs`'s own `_keyDown`): a terminal with DOM focus forwards
 * `Ctrl+B` to the pty as STX (0x02) unconditionally, UNLESS `Terminal#attachCustomKeyEventHandler`
 * returns `false` first — and that hook is per-terminal and binary, so it cannot tell "the shell
 * running inside this tab wants its own prefix key" (e.g. tmux, which uses this exact chord) from
 * "nothing in this tab cares". Stealing `Ctrl+B` globally would silently break tmux's prefix for
 * anyone running it inside a seeya tab, so this function only recognizes the CHORD; the caller
 * (`electron/sidebar-collapse-view.ts#wireSidebarCollapse`) additionally requires that no terminal
 * tab currently has focus before acting on it — the same scoping VS Code gives its own `Ctrl+B`
 * sidebar toggle next to an embedded terminal, and exactly what the task's own "funciona com o
 * foco em qualquer lugar da janela exceto quando o terminal da aba precisa da tecla" asks for.
 *
 * @example
 * isSidebarToggleShortcut({ key: 'b', ctrlKey: true, metaKey: false, altKey: false })  // true
 * isSidebarToggleShortcut({ key: 'B', ctrlKey: true, metaKey: false, altKey: false })  // true
 * isSidebarToggleShortcut({ key: 'b', ctrlKey: false, metaKey: false, altKey: false }) // false
 * isSidebarToggleShortcut({ key: 'b', ctrlKey: true, metaKey: false, altKey: true })   // false
 */
export interface SidebarToggleShortcutEvent {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
}

export function isSidebarToggleShortcut(event: SidebarToggleShortcutEvent): boolean {
  const chordHeld = (event.ctrlKey || event.metaKey) && !event.altKey;
  return chordHeld && event.key.toLowerCase() === 'b';
}
