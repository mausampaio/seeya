/**
 * The base checkbox (V2-T62, D-051 — `docs/INTERFACE.md` item 1's "caixa de marcar"). `value` is
 * carried through to the native `<input>` (not just `checked`/`onChange`) because at least one
 * existing screen (`electron/today-panel-view.ts`'s own session checkboxes, V2-T4) reads the
 * checked set straight off the DOM by `.value`, the same pattern this component preserves rather
 * than forcing a second, incompatible checkbox shape onto that screen before its own tarefa
 * (`docs/INTERFACE.md` item 5) redesigns it.
 *
 * @example
 * <Checkbox id="session-1" label="my-project" checked={false} value="session-1" onChange={toggle} />
 *
 * Relocated from `ui/` by D-052 (V2-T75) into this folder — still no production caller (confirmed
 * by grep before moving it) and still styled by `renderer/legacy/components.css`'s own
 * `.seeya-checkbox` global class, not a CSS module yet: that conversion, and the upgrade to a
 * real-rendered test, is left for the region task that first puts this component on screen.
 */
import type { ComponentChildren, JSX } from 'preact';

export interface CheckboxProps {
  readonly id: string;
  readonly label: ComponentChildren;
  readonly checked: boolean;
  readonly value?: string;
  readonly disabled?: boolean;
  readonly onChange?: (checked: boolean) => void;
}

export function Checkbox(props: CheckboxProps): JSX.Element {
  return (
    <label class="seeya-checkbox" for={props.id}>
      <input
        id={props.id}
        type="checkbox"
        class="seeya-checkbox-input"
        checked={props.checked}
        value={props.value}
        disabled={props.disabled}
        onChange={(event) => props.onChange?.((event.target as HTMLInputElement).checked)}
      />
      <span class="seeya-checkbox-label">{props.label}</span>
    </label>
  );
}
