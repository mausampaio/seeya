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
import type { Size } from '../props.js';

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
  return (
    <button
      // Conditional spread, not `ref={props.buttonRef}` directly — see `IconButton.tsx`'s own
      // identical comment (`exactOptionalPropertyTypes` treats "present, valued `undefined`"
      // differently from "absent", and Preact's `ref` JSX attribute type only accepts the latter).
      {...(props.buttonRef !== undefined ? { ref: props.buttonRef } : {})}
      id={props.id}
      type={props.type ?? 'button'}
      class={className}
      disabled={props.disabled}
      hidden={props.hidden}
      title={props.title}
      onClick={props.onClick}
    >
      <Text as="span" variant={TEXT_VARIANT_BY_SIZE[props.size ?? 'md']} weight={500}>
        {props.children}
      </Text>
    </button>
  );
}
