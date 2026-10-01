/**
 * The base dialog (V2-T62, D-051 — `docs/INTERFACE.md` item 1's "diálogo (com a devolução de foco
 * que já existe)"). A thin wrapper around a real `<dialog>`, still styled by
 * `renderer/legacy/components.css`'s own `.seeya-dialog*` global classes (every OTHER dialog in
 * this window is `renderer/legacy/dialogs-shell.tsx`, a screen only `docs/INTERFACE.md` § 9
 * redesigns — this component's own chrome stays theirs on purpose, so those fourteen dialogs never
 * change appearance out from under that later task); `props.className` layers a CALLER's own CSS
 * module on top for anything the shared chrome doesn't express (e.g. Settings' own two-pane width,
 * `SettingsDialog.module.css`), same `mergeClassName`-style layering every other component here
 * uses.
 *
 * `title` is optional: a couple of dialogs in this window (e.g. the project-dialog family) show
 * their own `<h3>` with a separately-managed id instead of a static string here.
 *
 * **`open`/`onClose` (V2-T65, D-052 item 2 — "componente não toca o DOM à mão"):** optional, so
 * every pre-existing `<Dialog id="..." className="...">` in `dialogs-shell.tsx` keeps working
 * exactly as before (opened/closed imperatively, by id, from its own `*-view.ts`). A caller that
 * DOES pass `open` gets the reactive behaviour `Popover` (`renderer/components/Popover/`) already
 * established for a real `<dialog>`: a `useEffect` calls `.showModal()`/`.close()` on this
 * component's OWN ref in response to the prop, and the native `close` event (Esc included) calls
 * `onClose` back so the caller's own state stays truthful — never a SECOND, independent way for
 * the dialog to end up open/closed that the prop doesn't know about.
 *
 * @example
 * <Dialog id="fallback-dialog" title="Resume without a plan?">
 *   <p>...</p>
 * </Dialog>
 * <Dialog id="settings-dialog" open={open} onClose={() => setOpen(false)} className={cx(styles, 'dialog')}>
 *   <SettingsNav .../>
 * </Dialog>
 */
import { useEffect, useRef } from 'preact/hooks';
import type { ComponentChildren, JSX } from 'preact';
import { Text } from '../Text/index.js';

export interface DialogProps {
  readonly id: string;
  readonly title?: ComponentChildren;
  /** Reactive open/close (V2-T65) — omit for the legacy imperative `.showModal()`/`.close()`-by-id
   * pattern every dialog in `dialogs-shell.tsx` still uses. */
  readonly open?: boolean;
  /** Fires on the native `close` event (Esc, `.close()`, a `<form method="dialog">` submit) —
   * only meaningful alongside `open`; ignored otherwise. */
  readonly onClose?: () => void;
  readonly className?: string;
  readonly children?: ComponentChildren;
}

export function Dialog(props: DialogProps): JSX.Element {
  const className = ['seeya-dialog', props.className].filter(Boolean).join(' ');
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (props.open === undefined) {
      return;
    }
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }
    if (props.open) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [props.open]);

  return (
    <dialog
      ref={dialogRef}
      id={props.id}
      class={className}
      onClose={props.onClose !== undefined ? () => props.onClose?.() : undefined}
    >
      {/* `.seeya-dialog-title`'s own font-size/weight moved into `Text` (D-052 item 7) — the class
       * still carries the shared margin every dialog's title needs. */}
      {props.title !== undefined && (
        <Text as="h3" variant="heading-4" className="seeya-dialog-title">
          {props.title}
        </Text>
      )}
      {props.children}
    </dialog>
  );
}
