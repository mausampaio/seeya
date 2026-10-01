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
import { Spinner } from '../Spinner/index.js';

const SPINNER_SIZE_PX = 14;

export interface SwitchProps {
  readonly id: string;
  readonly label: ComponentChildren;
  readonly checked: boolean;
  readonly disabled?: boolean;
  /** D-052, maintainer's own complement (V2-T65-estado-na-tela item 2) — same contract as
   * `Button.tsx`'s own `loading` (its docstring has the full reasoning, including why the slot is
   * reserved on both `true` AND `false` rather than only while actually loading). Forces the
   * switch disabled regardless of `disabled`/`disabledReason` — a switch mid-command and a switch
   * that's simply unavailable are different facts (D-024), so `loading` never reads
   * `disabledReason` underneath it. */
  readonly loading?: boolean;
  /** docs/INTERFACE.md § 8's own "indisponível com o motivo" — shown under the label, only while
   * `disabled` (D-024: pairing them in props would let a caller pass a reason for an enabled
   * switch, a combination nothing in this design ever means). */
  readonly disabledReason?: string | undefined;
  readonly className?: string;
  readonly onChange?: (checked: boolean) => void;
}

export function Switch(props: SwitchProps): JSX.Element {
  const loading = props.loading === true;
  const disabled = props.disabled === true || loading;
  return (
    <div class={mergeClassName(cx(styles, 'field'), props.className)}>
      <label class={cx(styles, 'row')} for={props.id} aria-busy={loading ? 'true' : undefined}>
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
        {props.loading !== undefined && (
          // Always mounted once this prop is in play, only `visibility` toggles — same "never
          // resize at the exact moment loading starts" reasoning as `Button.tsx`'s own slot.
          <span
            class={cx(styles, 'spinnerSlot', !loading && 'spinnerSlotHidden')}
            aria-hidden="true"
          >
            <Spinner size={SPINNER_SIZE_PX} />
          </span>
        )}
      </label>
      {!loading && disabled && props.disabledReason !== undefined && (
        <Text as="p" variant="caption" tone="secondary" className={cx(styles, 'reason')}>
          {props.disabledReason}
        </Text>
      )}
    </div>
  );
}
