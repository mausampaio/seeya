/**
 * A small overlay anchored next to a trigger element (D-052, V2-T64 — the first caller is the tab
 * strip's own New tab popover, `docs/INTERFACE.md` § 2). Built on a real `<dialog>` opened with
 * `.showModal()`, never a hand-rolled absolutely-positioned `<div>`: a native modal dialog already
 * gives this component, for free and consistent with every other dialog in this window, the three
 * behaviours the spec asks for — **Esc closes it**, and **closing it returns focus to the active
 * tab's terminal** (`renderer/legacy/dialog-focus-return.ts#wireDialogFocusReturn`, which finds
 * every `<dialog>` already in the document at startup; this one qualifies because the tab strip
 * mounts synchronously as part of `<App/>`, same as `DialogsShell`'s own dialogs). What a native
 * dialog does NOT give for free is the "anchored near a button" placement — `showModal()`'s own
 * default centres it, which this component overrides by measuring `anchor` right after opening
 * and setting `top`/`left` explicitly (`Popover.module.css`'s own `position: fixed; margin: 0`
 * is what lets that override win over the UA's own centring).
 *
 * Open/close stays driven by the `open` prop (never imperative `getElementById`/`.showModal()`
 * calls at the use site, D-052 item 2) — the one imperative call this component itself makes is
 * `.showModal()`/`.close()` on its OWN `ref`, mirroring exactly how `Dialog` (`renderer/components/
 * Dialog/`) already treats a real `<dialog>` as the source of truth for open/closed. A click
 * outside the popover's own box (the native `::backdrop`, confirmed to fire with
 * `event.target === the dialog itself`) closes it too, the common "popover" convention `docs/
 * INTERFACE.md` doesn't spell out but every person using one already expects.
 *
 * @example
 * const anchorRef = useRef<HTMLButtonElement>(null);
 * <button ref={anchorRef} onClick={() => setOpen(true)}>+</button>
 * <Popover id="new-tab-popover" open={open} anchorRef={anchorRef} onRequestClose={() => setOpen(false)}>
 *   <p>Popover content</p>
 * </Popover>
 */
import { useEffect, useRef } from 'preact/hooks';
import type { ComponentChildren, JSX, RefObject, TargetedEvent } from 'preact';
import styles from './Popover.module.css';
import { cx, mergeClassName } from '../css-class.js';

export interface PopoverProps {
  readonly id: string;
  readonly open: boolean;
  /** The element the popover anchors itself under — measured once, each time `open` turns
   * `true`. */
  readonly anchorRef: RefObject<HTMLElement | null>;
  /** Called whenever the popover closes for a reason this component didn't initiate from a
   * caller's own state change — Esc, a backdrop click, or `.close()` — so the caller's own `open`
   * state stays truthful (mirrors the native `close` event every other `<dialog>` in this window
   * already relies on, `Dialog`'s own docstring). */
  readonly onRequestClose: () => void;
  readonly className?: string;
  readonly children: ComponentChildren;
}

const VIEWPORT_MARGIN_PX = 8;
/** Identity § 6.1's own 4px grid — the gap between the trigger and the popover's own top edge. */
const ANCHOR_GAP_PX = 4;

/** Clamps `value` into `[min, max]` — `max` can legitimately be smaller than `min` when the
 * popover is wider than the viewport itself; `Math.max` ahead of `Math.min` keeps `min` winning
 * in that corner case rather than producing a negative-width clamp. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(max, min));
}

/** Positions `dialog` (already shown — `getBoundingClientRect` on a closed `<dialog>` is always
 * zero) just under `anchor`, clamped so it never renders off-screen on either axis. */
function positionNear(dialog: HTMLDialogElement, anchor: HTMLElement): void {
  const anchorRect = anchor.getBoundingClientRect();
  const dialogRect = dialog.getBoundingClientRect();
  const left = clamp(
    anchorRect.left,
    VIEWPORT_MARGIN_PX,
    window.innerWidth - dialogRect.width - VIEWPORT_MARGIN_PX,
  );
  const top = clamp(
    anchorRect.bottom + ANCHOR_GAP_PX,
    VIEWPORT_MARGIN_PX,
    window.innerHeight - dialogRect.height - VIEWPORT_MARGIN_PX,
  );
  dialog.style.left = `${left}px`;
  dialog.style.top = `${top}px`;
}

export function Popover(props: PopoverProps): JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }
    if (!props.open) {
      if (dialog.open) {
        dialog.close();
      }
      return;
    }
    if (!dialog.open) {
      dialog.showModal();
    }
    const anchor = props.anchorRef.current;
    if (anchor !== null) {
      positionNear(dialog, anchor);
    }
  }, [props.open]);

  function handleBackdropClick(event: TargetedEvent<HTMLDialogElement, MouseEvent>): void {
    // A click that lands on the dialog's OWN element (never a descendant — content fills the
    // dialog's padding box) is a click on the `::backdrop`, the standard way to detect one
    // (`::backdrop` itself is not a real event target). `.close()` fires the native `close`
    // event, which calls `onRequestClose` below — never called twice here on purpose.
    if (event.target === event.currentTarget) {
      event.currentTarget.close();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      id={props.id}
      class={mergeClassName(cx(styles, 'popover'), props.className)}
      onClick={handleBackdropClick}
      onClose={() => props.onRequestClose()}
    >
      {props.children}
    </dialog>
  );
}
