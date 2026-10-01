/**
 * D-052 (V2-T75): the icon-only button — split out of `Button` on purpose (a `Button` always has
 * visible text now). `aria-label` is a REQUIRED prop, not optional (D-024: "o tipo torna o estado
 * inválido irrepresentável" — identity § 8's "áreas interativas precisam de nome acessível" is
 * enforced at compile time, not by a runtime check nobody remembers to call). The icon is centered
 * by this component's own flex layout (`IconButton.module.css`), never left to the icon's own
 * markup — the V2-T63 aceite's "`+` de Favorites fora do centro" was exactly a button with no
 * centering rule of its own.
 *
 * @example
 * <IconButton variant="ghost" size="sm" aria-label="New project" onClick={openNewProject}>
 *   <PlusIcon />
 * </IconButton>
 */
import type { ComponentChildren, JSX, RefObject, TargetedMouseEvent } from 'preact';
import styles from './IconButton.module.css';
import { cx, mergeClassName } from '../css-class.js';
import type { ButtonVariant } from '../Button/Button.js';
import type { Size } from '../props.js';

export interface IconButtonProps {
  readonly id?: string;
  readonly variant?: ButtonVariant;
  readonly size?: Size;
  readonly disabled?: boolean;
  readonly hidden?: boolean;
  readonly className?: string;
  readonly onClick?: (event: TargetedMouseEvent<HTMLButtonElement>) => void;
  readonly 'aria-label': string;
  readonly children: ComponentChildren;
  /** V2-T64: a plain DOM ref to the underlying `<button>` — never Preact's own `ref` prop (which
   * this project has no `forwardRef` for without `preact/compat`, D-051: no compatibility layer).
   * Needed by a caller that has to MEASURE this button (`Popover`'s own anchor positioning — the
   * tab strip's "+" button is the first one). Optional: most callers never need the node itself. */
  readonly buttonRef?: RefObject<HTMLButtonElement | null>;
}

export function IconButton(props: IconButtonProps): JSX.Element {
  const className = mergeClassName(
    cx(styles, 'iconButton', props.variant ?? 'ghost', props.size ?? 'md'),
    props.className,
  );
  return (
    <button
      // Conditional spread, not `ref={props.buttonRef}` directly — `buttonRef` is an OPTIONAL prop
      // (`RefObject<...> | undefined`), and this project's `exactOptionalPropertyTypes` (D-024's
      // own strictness) treats "present, valued `undefined`" as a different shape than "absent" —
      // Preact's own `ref` JSX attribute type only accepts the latter.
      {...(props.buttonRef !== undefined ? { ref: props.buttonRef } : {})}
      id={props.id}
      type="button"
      class={className}
      disabled={props.disabled}
      hidden={props.hidden}
      aria-label={props['aria-label']}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}
