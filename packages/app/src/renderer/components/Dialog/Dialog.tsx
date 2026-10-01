/**
 * The base dialog (V2-T62, D-051 — `docs/INTERFACE.md` item 1's "diálogo (com a devolução de foco
 * que já existe)"). A thin wrapper around a real `<dialog>` — opening/closing stays imperative
 * (`.showModal()`/`.close()` on the element, by `id`), exactly like every dialog in this window
 * already works, so `electron/dialog-focus-return.ts#wireDialogFocusReturn` (which finds every
 * `<dialog>` with `document.querySelectorAll('dialog')` and returns focus to the active terminal on
 * its native `close` event) needs no change at all to keep covering a `Dialog` rendered by Preact —
 * it is still a real `<dialog>` element in the real DOM.
 *
 * `title` is optional: a couple of dialogs in this window (e.g. the project-dialog family) show
 * their own `<h3>` with a separately-managed id instead of a static string here.
 *
 * @example
 * <Dialog id="fallback-dialog" title="Resume without a plan?">
 *   <p>...</p>
 * </Dialog>
 *
 * Relocated from `ui/` by D-052 (V2-T75) into this folder — still styled by
 * `renderer/legacy/components.css`'s own `.seeya-dialog*` global classes, not a CSS module yet
 * (every dialog that uses this component today is `renderer/legacy/dialogs-shell.tsx`, a screen
 * this task doesn't redesign); that conversion is left for the task that redesigns confirmations
 * and dialogs (`docs/INTERFACE.md` § 9).
 */
import type { ComponentChildren, JSX } from 'preact';

export interface DialogProps {
  readonly id: string;
  readonly title?: ComponentChildren;
  readonly className?: string;
  readonly children?: ComponentChildren;
}

export function Dialog(props: DialogProps): JSX.Element {
  const className = ['seeya-dialog', props.className].filter(Boolean).join(' ');
  return (
    <dialog id={props.id} class={className}>
      {props.title !== undefined && <h3 class="seeya-dialog-title">{props.title}</h3>}
      {props.children}
    </dialog>
  );
}
