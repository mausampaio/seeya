/**
 * The ONE place that returns keyboard focus to the active tab's terminal when any `<dialog>`
 * closes (PO acceptance of V2-T55, correction 3, 2026-09-25) — every dialog in `index.html` gets
 * this for free, instead of a focus-restore patch repeated per dialog. A native `<dialog>` fires
 * its own `close` event on EVERY closing path (`.close()`, Escape, a `method="dialog"` form
 * submit) — one listener per dialog, attached once at startup here, is enough to cover all of
 * them without each dialog's own view module remembering to call anything back.
 *
 * The actual "focus the terminal" action is supplied by `renderer.ts` (the only module holding
 * `openTabs`/which tab is currently shown) via `registerActiveTerminalFocuser`, called once at
 * startup — this module never imports `renderer.ts` itself: `renderer.ts` already imports the
 * chain that reaches this file (`project-panel-view.ts` → here), so importing back would be
 * circular. No tab open at all: the registered focuser is a no-op by default, so focus is simply
 * left wherever it already was (D-025 — nothing to focus, never guessed).
 */
let focusActiveTerminal: () => void = () => {};

/** Called once, at startup, by `renderer.ts#main`. */
export function registerActiveTerminalFocuser(focuser: () => void): void {
  focusActiveTerminal = focuser;
}

/**
 * Wired once, at startup. Every `<dialog>` already in the document when this runs gets the
 * listener — `index.html` declares every dialog statically, none are created later.
 *
 * @example
 * wireDialogFocusReturn(); // closing any dialog now focuses the active tab's terminal
 */
export function wireDialogFocusReturn(): void {
  for (const dialog of document.querySelectorAll('dialog')) {
    dialog.addEventListener('close', () => focusActiveTerminal());
  }
}
