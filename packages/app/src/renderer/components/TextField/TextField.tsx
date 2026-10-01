/**
 * The base text field (V2-T62, D-051 — `docs/INTERFACE.md` item 1's "campo"). A `<label>` wrapping
 * an `<input>`, plus an optional mono `hint` (identity § "Settings": "o nome da chave fica como
 * dica, em mono") and an optional `error` line — both rendered only when present, never an empty
 * paragraph reserving space nobody asked for.
 *
 * @example
 * <TextField id="new-project-id-input" label="Project id" value={id} onInput={setId} />
 *
 * Brought to the CSS-module/render-tested pattern by V2-T64 (D-052, Q-102 — relocated from `ui/`
 * by V2-T75 without a reshape, since it had no production caller yet; the New tab popover's own
 * `Directory`/`Other…` fields are its first callers).
 */
import type { JSX } from 'preact';
import styles from './TextField.module.css';
import { cx } from '../css-class.js';

export interface TextFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly placeholder?: string;
  readonly hint?: string;
  readonly error?: string;
  readonly disabled?: boolean;
  readonly onInput?: (value: string) => void;
}

export function TextField(props: TextFieldProps): JSX.Element {
  return (
    <div class={cx(styles, 'field')}>
      <label class={cx(styles, 'label')} for={props.id}>
        {props.label}
      </label>
      <input
        id={props.id}
        type="text"
        class={cx(styles, 'input')}
        value={props.value}
        placeholder={props.placeholder}
        disabled={props.disabled}
        onInput={(event) => props.onInput?.((event.target as HTMLInputElement).value)}
      />
      {props.hint !== undefined && <p class={cx(styles, 'hint')}>{props.hint}</p>}
      {props.error !== undefined && <p class={cx(styles, 'error')}>{props.error}</p>}
    </div>
  );
}
