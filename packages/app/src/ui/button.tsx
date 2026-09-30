/**
 * The base button (V2-T62, D-051 — `docs/INTERFACE.md` item 1's "botão (primário, secondário,
 * fantasma, só ícone com `aria-label`)"). Three visual variants, plus an icon-only FORM that the
 * type system makes impossible to use without an accessible name (D-024: "o tipo torna o estado
 * inválido irrepresentável") — `iconOnly: true` without `aria-label` is a compile error, not a
 * runtime check nobody remembers to call.
 *
 * @example
 * <Button variant="primary" onClick={handleSave}>Save</Button>
 * <Button iconOnly aria-label="Collapse sidebar" onClick={toggle}>‹</Button>
 */
import type { ComponentChildren, JSX, TargetedMouseEvent } from 'preact';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonCommonProps {
  readonly id?: string;
  readonly variant?: ButtonVariant;
  readonly type?: 'button' | 'submit';
  readonly disabled?: boolean;
  readonly hidden?: boolean;
  readonly className?: string;
  readonly onClick?: (event: TargetedMouseEvent<HTMLButtonElement>) => void;
  readonly children?: ComponentChildren;
}

/** The icon-only form REQUIRES `aria-label` — there is no other form of this props type that
 * allows `iconOnly: true` without it (identity § 8: areas interativas precisam de nome acessível). */
export type ButtonProps =
  | (ButtonCommonProps & { readonly iconOnly: true; readonly 'aria-label': string })
  | (ButtonCommonProps & { readonly iconOnly?: false });

function buttonClassName(props: ButtonProps): string {
  const variant = props.variant ?? 'primary';
  const parts = [`seeya-button`, `seeya-button--${variant}`];
  if (props.iconOnly) {
    parts.push('seeya-button--icon');
  }
  if (props.className !== undefined) {
    parts.push(props.className);
  }
  return parts.join(' ');
}

export function Button(props: ButtonProps): JSX.Element {
  return (
    <button
      id={props.id}
      type={props.type ?? 'button'}
      class={buttonClassName(props)}
      disabled={props.disabled}
      hidden={props.hidden}
      aria-label={props.iconOnly ? props['aria-label'] : undefined}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}
