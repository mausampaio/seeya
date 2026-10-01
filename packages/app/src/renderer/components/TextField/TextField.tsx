/**
 * The base text field (V2-T62, D-051 — `docs/INTERFACE.md` item 1's "campo"). A `<label>` wrapping
 * an `<input>`, plus an optional mono `hint` (identity § "Settings": "o nome da chave fica como
 * dica, em mono") and an optional `error` line — both rendered only when present, never an empty
 * paragraph reserving space nobody asked for.
 *
 * @example
 * <TextField id="new-project-id-input" label="Project id" value={id} onInput={setId} />
 * <TextField id="x" label="End-of-day time" value={v} hint="endOfDayTime" onBlur={save} />
 *
 * Brought to the CSS-module/render-tested pattern by V2-T64 (D-052, Q-102 — relocated from `ui/`
 * by V2-T75 without a reshape, since it had no production caller yet; the New tab popover's own
 * `Directory`/`Other…` fields are its first callers). `onBlur` and `trailing` added by V2-T65 for
 * Settings (docs/INTERFACE.md § 8's own "salvar ao sair do campo" and the custom/default tag next
 * to each field) — label/hint/error moved onto `Text` the same task (D-052 item 7).
 */
import type { ComponentChildren, JSX } from 'preact';
import styles from './TextField.module.css';
import { cx, mergeClassName } from '../css-class.js';
import { Text } from '../Text/index.js';

export interface TextFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly placeholder?: string;
  readonly hint?: string;
  /** `| undefined` explicitly (not just `?:`) — `exactOptionalPropertyTypes`'s own distinction
   * between "omitted" and "present, valued `undefined`": a caller deriving this from a lookup
   * (`errorsByKey[row.key]`, `SettingsField.tsx`) passes the latter. */
  readonly error?: string | undefined;
  readonly disabled?: boolean;
  /** An optional node next to the label — Settings' own custom/default `Chip`
   * (`SettingsField.tsx`); nothing else uses this yet. */
  readonly trailing?: ComponentChildren;
  readonly className?: string;
  readonly onInput?: (value: string) => void;
  /** docs/INTERFACE.md § 8's own "cada campo salva ao sair dele" — reads the value straight off
   * the native `blur` event's own target, never a separately-tracked "last value" variable, so a
   * caller that sets `.value` and blurs programmatically (this task's own verification
   * instrumentation, `main/main.ts`) saves exactly like a person tabbing away would. */
  readonly onBlur?: (value: string) => void;
}

export function TextField(props: TextFieldProps): JSX.Element {
  return (
    <div class={mergeClassName(cx(styles, 'field'), props.className)}>
      <div class={cx(styles, 'labelRow')}>
        {/* `trailing` is a SIBLING of the `<label>`, never a child of it — a `Chip` nested inside
         * would pollute the input's own accessible name (a real `getByLabelText('End-of-day
         * time')` failed with `trailing` nested here: the computed name became "End-of-day time
         * custom", `SettingsField.test.tsx`'s own regression coverage). */}
        <label for={props.id}>
          <Text as="span" variant="body-sm" weight={500} tone="secondary">
            {props.label}
          </Text>
        </label>
        {props.trailing}
      </div>
      <input
        id={props.id}
        type="text"
        class={cx(styles, 'input')}
        value={props.value}
        placeholder={props.placeholder}
        disabled={props.disabled}
        onInput={(event) => props.onInput?.((event.target as HTMLInputElement).value)}
        onBlur={(event) => props.onBlur?.((event.target as HTMLInputElement).value)}
      />
      {props.hint !== undefined && (
        <Text as="p" variant="code" tone="tertiary" className={cx(styles, 'hint')}>
          {props.hint}
        </Text>
      )}
      {props.error !== undefined && (
        <Text as="p" variant="caption" className={cx(styles, 'error')}>
          {props.error}
        </Text>
      )}
    </div>
  );
}
