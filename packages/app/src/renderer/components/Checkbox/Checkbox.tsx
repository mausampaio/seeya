/**
 * The base checkbox (V2-T62, D-051 — `docs/INTERFACE.md` item 1's "caixa de marcar"). `value` is
 * carried through to the native `<input>` (not just `checked`/`onChange`) because at least one
 * existing screen (`renderer/legacy/today-panel-view.ts`'s own session checkboxes, V2-T4) read the
 * checked set straight off the DOM by `.value` — this component preserves that same shape so
 * Today's own session cards (V2-T66, its first real caller) can keep reading selection the same
 * way if it ever needs to, even though `useToday.ts` itself tracks selection as hook state instead.
 *
 * `label` wraps whatever content a caller passes — a plain string, or (Today's own session cards)
 * an entire multi-line block of name/id/directory/plan text — inside a native `<label>`, so
 * clicking ANYWHERE on that content toggles the box, never just the box itself. `align-items:
 * flex-start` (not `center`, the V2-T62 default) is what makes that read correctly once the label
 * content spans more than one line.
 *
 * @example
 * <Checkbox id="session-1" label="my-project" checked={false} value="session-1" onChange={toggle} />
 *
 * Brought to the CSS-module/render-tested pattern by V2-T66 (D-052, Q-102) — first production
 * caller is Today's own `SessionCard` (`docs/INTERFACE.md` § 3).
 */
import type { ComponentChildren, JSX } from 'preact';
import styles from './Checkbox.module.css';
import { cx, mergeClassName } from '../css-class.js';

export interface CheckboxProps {
  readonly id: string;
  readonly label: ComponentChildren;
  readonly checked: boolean;
  readonly value?: string;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly onChange?: (checked: boolean) => void;
}

export function Checkbox(props: CheckboxProps): JSX.Element {
  return (
    <label class={mergeClassName(cx(styles, 'checkbox'), props.className)} for={props.id}>
      <input
        id={props.id}
        type="checkbox"
        class={cx(styles, 'input')}
        checked={props.checked}
        value={props.value}
        disabled={props.disabled}
        onChange={(event) => props.onChange?.((event.target as HTMLInputElement).checked)}
      />
      <span class={cx(styles, 'label')}>{props.label}</span>
    </label>
  );
}
