/**
 * The base button (V2-T62/D-051; reshaped by D-052/V2-T75 into the shared prop vocabulary — the
 * maintainer's own complement, 2026-09-30 — and a real CSS module). `docs/INTERFACE.md` item 1's
 * "botão (primário, secondário, fantasma...)" — the icon-only form moved out to `IconButton`
 * (its own component now, not a union member here): a `Button` always has visible text.
 *
 * @example
 * <Button variant="primary" onClick={handleSave}>Save</Button>
 * <Button variant="secondary" size="sm">Cancel</Button>
 * <Button fullWidth>End day…</Button>
 */
import type { ComponentChildren, JSX, RefObject, TargetedMouseEvent } from 'preact';
import styles from './Button.module.css';
import { cx, mergeClassName } from '../css-class.js';
import { Text, type TextVariant } from '../Text/index.js';
import { Spinner } from '../Spinner/index.js';
import type { Size } from '../props.js';

/** `size`'s own spinner diameter — close to the text's own cap height at each step, never a fixed
 * number that would look oversized next to `sm` or cramped next to `lg`. */
const SPINNER_SIZE_BY_SIZE: Record<Size, number> = {
  sm: 14,
  md: 16,
  lg: 18,
};

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

/** D-052 item 7 (PO review, 2026-10-01): `size`'s own padding scale (`Button.module.css`) stays a
 * `Size`, but the TEXT itself now always comes from `Text` — this is the one place that decides
 * which identity variant each size means, so every `Button` in the app reads at an actual scale
 * step instead of the three one-off pixel values (13/14/16) this used to hardcode. */
const TEXT_VARIANT_BY_SIZE: Record<Size, TextVariant> = {
  sm: 'body-sm',
  md: 'body-md',
  lg: 'body-lg',
};

export interface ButtonProps {
  readonly id?: string;
  readonly variant?: ButtonVariant;
  readonly size?: Size;
  /** `docs/INTERFACE.md` § 1's own "End day…, largura total" — never a fixed width, always the
   * width of whatever the button sits inside. */
  readonly fullWidth?: boolean;
  readonly type?: 'button' | 'submit';
  readonly disabled?: boolean;
  /** D-052, maintainer's own complement (V2-T65-estado-na-tela item 2): "estado de trabalho vira
   * prop do componente, não lógica espalhada" — an in-flight action (Skip, Snooze, the daemon
   * button, …) sets this instead of each caller inventing its own disabled-plus-spinner markup.
   * **Omitted (the default), a `Button` behaves exactly as before this prop existed** — no reserved
   * spinner gutter, no width change, ever — only a caller that explicitly passes `true`/`false`
   * opts into the reserved slot below, so every pre-existing `Button` in this app is byte-for-byte
   * unaffected. `true`: disables the button, sets `aria-busy="true"`, and shows a `Spinner` to the
   * LEFT of the label in a slot that's already reserved the instant this prop is anything but
   * `undefined` — reserving it on BOTH `true` and `false` is what keeps the button's own width
   * stable across the loading transition itself ("mantém a largura, sem pular o layout"), the one
   * hard requirement here; the trade-off is a permanent small gutter for the handful of buttons
   * that opt in at all, which is cheaper than a width that jumps the instant someone clicks. */
  readonly loading?: boolean;
  /** D-052 (V2-T66, same shape as `Switch.tsx`'s own `disabledReason`) — `docs/INTERFACE.md` §
   * 3's own "desabilitado sem seleção, com o motivo" (Today's "Resume selected"): a line under the
   * button, shown only while `disabled` and NOT `loading` (D-024: a button mid-command and a
   * button that's simply unavailable are different facts, so a reason never shows next to a
   * spinner). Omitted, nothing renders — every pre-existing `Button` is unaffected. */
  readonly disabledReason?: string | undefined;
  readonly hidden?: boolean;
  readonly className?: string;
  /** V2-T64: a native tooltip for when the visible label is already a shortened form of a longer
   * fact (e.g. the New tab popover's own recent-directory shortcuts, `shortenDirectoryPath`) —
   * optional, most buttons have no need for a second, longer text. */
  readonly title?: string;
  readonly onClick?: (event: TargetedMouseEvent<HTMLButtonElement>) => void;
  readonly children: ComponentChildren;
  /** PO review (2026-10-01): a plain DOM ref to the underlying `<button>` — same reasoning as
   * `IconButton`'s own `buttonRef` (no `forwardRef` without `preact/compat`, D-051). The Snooze
   * trigger (`SidebarFooter`) needs this to anchor its own `Menu` (`Popover`'s own positioning). */
  readonly buttonRef?: RefObject<HTMLButtonElement | null>;
}

export function Button(props: ButtonProps): JSX.Element {
  const className = mergeClassName(
    cx(
      styles,
      'button',
      props.variant ?? 'primary',
      props.size ?? 'md',
      props.fullWidth === true && 'fullWidth',
    ),
    props.className,
  );
  const disabled = props.disabled === true || props.loading === true;
  const loading = props.loading === true;
  const button = (
    <button
      // Conditional spread, not `ref={props.buttonRef}` directly — see `IconButton.tsx`'s own
      // identical comment (`exactOptionalPropertyTypes` treats "present, valued `undefined`"
      // differently from "absent", and Preact's `ref` JSX attribute type only accepts the latter).
      {...(props.buttonRef !== undefined ? { ref: props.buttonRef } : {})}
      id={props.id}
      type={props.type ?? 'button'}
      class={className}
      disabled={disabled}
      aria-busy={props.loading === true ? 'true' : undefined}
      hidden={props.hidden}
      title={props.title}
      onClick={props.onClick}
    >
      {props.loading !== undefined && (
        // The `Spinner` is always MOUNTED once this prop is in play (never conditionally added),
        // just toggled between `visible`/`hidden` — a slot whose box only appears while loading
        // would itself change the button's width at the exact moment loading starts, the opposite
        // of what this prop exists for. `visibility` (not `display`) is what keeps the box's own
        // footprint in the layout while painting nothing.
        <span
          class={cx(styles, 'spinnerSlot', props.loading !== true && 'spinnerSlotHidden')}
          aria-hidden="true"
        >
          <Spinner size={SPINNER_SIZE_BY_SIZE[props.size ?? 'md']} />
        </span>
      )}
      <Text as="span" variant={TEXT_VARIANT_BY_SIZE[props.size ?? 'md']} weight={500}>
        {props.children}
      </Text>
    </button>
  );
  if (!disabled || loading || props.disabledReason === undefined) {
    return button;
  }
  // Only reached while disabled, NOT loading, with a reason to show (the docstring's own "a
  // button mid-command and a button that's simply unavailable are different facts") — a sibling
  // `Text`, never a child of `<button>` (a `<p>` inside a `<button>` is invalid HTML and would
  // also pollute the button's own accessible name, the same reasoning `TextField.tsx`'s own
  // `trailing` comment already gives for a different component).
  return (
    <>
      {button}
      <Text as="p" variant="caption" tone="secondary" className={cx(styles, 'disabledReason')}>
        {props.disabledReason}
      </Text>
    </>
  );
}
