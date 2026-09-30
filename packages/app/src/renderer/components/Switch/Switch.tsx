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
 */
import type { ComponentChildren, JSX } from 'preact';

export interface SwitchProps {
  readonly id: string;
  readonly label: ComponentChildren;
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly onChange?: (checked: boolean) => void;
}

export function Switch(props: SwitchProps): JSX.Element {
  return (
    <label class="seeya-switch" for={props.id}>
      <input
        id={props.id}
        type="checkbox"
        role="switch"
        class="seeya-switch-input"
        checked={props.checked}
        disabled={props.disabled}
        onChange={(event) => props.onChange?.((event.target as HTMLInputElement).checked)}
      />
      <span class="seeya-switch-label">{props.label}</span>
    </label>
  );
}
