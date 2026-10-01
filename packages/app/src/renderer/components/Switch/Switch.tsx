/**
 * The base switch (V2-T62, D-051 — `docs/INTERFACE.md` item 1's "interruptor"), for a setting that
 * takes effect immediately (e.g. Settings' own "Start with the system", `docs/INTERFACE.md` § 8) —
 * as opposed to `Checkbox`, which is for SELECTING an item in a list. Built on a native
 * `<input type="checkbox" role="switch">` (the same accessibility tree a real switch needs, per
 * the ARIA switch pattern) rather than a `<div>` with click handlers, so keyboard and screen-reader
 * behaviour come for free.
 *
 * @example
 * <Switch id="autostart" label="Start with the system" checked={enabled} onChange={setEnabled} />
 * <Switch id="x" label="Y" checked={false} disabled disabledReason="Managed by the CLI." />
 *
 * Brought to the CSS-module/render-tested pattern by V2-T65 (D-052, Q-102) — first production
 * caller is Settings' own General section (`docs/INTERFACE.md` § 8's own autostart switch).
 *
 * **Label variant (PO review, V2-T65):** `body-sm`/`weight={500}`/`tone="secondary"` — the SAME
 * triple `TextField`'s own label and the standalone "Theme" label (`GeneralSection.tsx`) already
 * use, so every field label in Settings reads at one consistent size. "Start with the system"
 * used to render at `body-md` (16px), visibly larger than "Theme" (14px) right above it — the PO's
 * own screenshot review caught this as the one field-label size that didn't match.
 */
import type { ComponentChildren, JSX } from 'preact';
import styles from './Switch.module.css';
import { cx, mergeClassName } from '../css-class.js';
import { Text } from '../Text/index.js';

export interface SwitchProps {
  readonly id: string;
  readonly label: ComponentChildren;
  readonly checked: boolean;
  readonly disabled?: boolean;
  /** docs/INTERFACE.md § 8's own "indisponível com o motivo" — shown under the label, only while
   * `disabled` (D-024: pairing them in props would let a caller pass a reason for an enabled
   * switch, a combination nothing in this design ever means). */
  readonly disabledReason?: string | undefined;
  readonly className?: string;
  readonly onChange?: (checked: boolean) => void;
}

export function Switch(props: SwitchProps): JSX.Element {
  const disabled = props.disabled === true;
  return (
    <div class={mergeClassName(cx(styles, 'field'), props.className)}>
      <label class={cx(styles, 'row')} for={props.id}>
        <input
          id={props.id}
          type="checkbox"
          role="switch"
          class={cx(styles, 'input')}
          checked={props.checked}
          disabled={disabled}
          onChange={(event) => props.onChange?.((event.target as HTMLInputElement).checked)}
        />
        <Text as="span" variant="body-sm" weight={500} tone="secondary">
          {props.label}
        </Text>
      </label>
      {disabled && props.disabledReason !== undefined && (
        <Text as="p" variant="caption" tone="secondary" className={cx(styles, 'reason')}>
          {props.disabledReason}
        </Text>
      )}
    </div>
  );
}
