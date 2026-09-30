/**
 * The base text field (V2-T62, D-051 — `docs/INTERFACE.md` item 1's "campo"). A `<label>` wrapping
 * an `<input>`, plus an optional mono `hint` (identity § "Settings": "o nome da chave fica como
 * dica, em mono") and an optional `error` line — both rendered only when present, never an empty
 * paragraph reserving space nobody asked for.
 *
 * @example
 * <TextField id="new-project-id-input" label="Project id" value={id} onInput={setId} />
 *
 * Relocated from `ui/` by D-052 (V2-T75) — still no production caller (confirmed by grep before
 * moving it) and still styled by `renderer/legacy/components.css`'s own `.seeya-field*` global
 * classes, not a CSS module yet; left for the region task that first puts it on screen.
 */
import type { JSX } from 'preact';

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
    <div class="seeya-field">
      <label class="seeya-field-label" for={props.id}>
        {props.label}
      </label>
      <input
        id={props.id}
        type="text"
        class="seeya-field-input"
        value={props.value}
        placeholder={props.placeholder}
        disabled={props.disabled}
        onInput={(event) => props.onInput?.((event.target as HTMLInputElement).value)}
      />
      {props.hint !== undefined && <p class="seeya-field-hint">{props.hint}</p>}
      {props.error !== undefined && <p class="seeya-field-error">{props.error}</p>}
    </div>
  );
}
