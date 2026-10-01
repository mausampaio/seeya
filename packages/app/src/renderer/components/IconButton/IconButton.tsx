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
import { Spinner } from '../Spinner/index.js';
import type { ButtonVariant } from '../Button/Button.js';
import type { Size } from '../props.js';

/** `size`'s own spinner diameter — `Button.tsx`'s own identical table, repeated here (never
 * imported from there) because the two components' `Size` steps mean different pixel targets: an
 * `IconButton` IS its icon, an `IconButton`'s `sm`/`md`/`lg` are 24/32/40px square boxes, nothing
 * like `Button`'s own padding-driven sizes. */
const SPINNER_SIZE_BY_SIZE: Record<Size, number> = {
  sm: 14,
  md: 16,
  lg: 18,
};

export interface IconButtonProps {
  readonly id?: string;
  readonly variant?: ButtonVariant;
  readonly size?: Size;
  readonly disabled?: boolean;
  /** D-052, maintainer's own complement (V2-T65-estado-na-tela item 2) — same contract as
   * `Button.tsx`'s own `loading` (its docstring has the full reasoning). An `IconButton`'s own box
   * is ALREADY a fixed `width`/`height` per `size` (`IconButton.module.css`), so unlike `Button`
   * there is no separate reserved slot to add here: the spinner simply replaces the icon in the
   * SAME box, which is already as width-stable as a prop can get. */
  readonly loading?: boolean;
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
      disabled={props.disabled === true || props.loading === true}
      aria-busy={props.loading === true ? 'true' : undefined}
      hidden={props.hidden}
      aria-label={props['aria-label']}
      onClick={props.onClick}
    >
      {props.loading === true ? (
        <Spinner size={SPINNER_SIZE_BY_SIZE[props.size ?? 'md']} />
      ) : (
        props.children
      )}
    </button>
  );
}
