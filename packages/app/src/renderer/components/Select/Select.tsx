/**
 * The base select (V2-T62, D-051 — `docs/INTERFACE.md` item 1's "seleção"). A `<label>` wrapping a
 * `<select>`, one `<option>` per entry — the same shape `electron/renderer.ts#renderResumeInSelect`
 * already builds by hand for "Resume in" (V2-T9), now a reusable component.
 *
 * @example
 * <Select id="theme-select" label="Theme" value={theme} onChange={setTheme}
 *   options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }]} />
 *
 * Relocated from `ui/` by D-052 (V2-T75) — still no production caller (confirmed by grep before
 * moving it) and still styled by `renderer/legacy/components.css`'s own `.seeya-field*` global
 * classes, not a CSS module yet; left for the region task that first puts it on screen (Settings'
 * own Theme control, `docs/INTERFACE.md` § 8).
 */
import type { JSX } from 'preact';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

export interface SelectProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly options: readonly SelectOption[];
  readonly disabled?: boolean;
  readonly onChange?: (value: string) => void;
}

export function Select(props: SelectProps): JSX.Element {
  return (
    <div class="seeya-field">
      <label class="seeya-field-label" for={props.id}>
        {props.label}
      </label>
      <select
        id={props.id}
        class="seeya-field-select"
        value={props.value}
        disabled={props.disabled}
        onChange={(event) => props.onChange?.((event.target as HTMLSelectElement).value)}
      >
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
