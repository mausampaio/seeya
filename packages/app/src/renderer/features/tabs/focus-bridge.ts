/**
 * Focuses whichever tab's terminal is currently active, from OUTSIDE this feature (V2-T64,
 * replaces `renderer/legacy/tabs-view.ts#focusActiveTabTerminal`, apagado by this task) —
 * `renderer.tsx#main` passes this to `renderer/legacy/dialog-focus-return.ts
 * #registerActiveTerminalFocuser`, the mechanism that returns keyboard focus to the terminal
 * whenever any `<dialog>` in the window closes (PO acceptance of V2-T55, correction 3). No tab
 * open at all: a no-op, same "leave focus wherever it already was" (D-025) the legacy function
 * had before any real focuser is registered.
 */
let focuser: () => void = () => {};

/** Called once, by `useTabStrip.ts`, on mount. */
export function registerActiveTabFocuser(fn: () => void): void {
  focuser = fn;
}

export function focusActiveTabTerminal(): void {
  focuser();
}
