/**
 * The base segmented control (V2-T62, D-051 — `docs/INTERFACE.md` item 1's "controle segmentado"),
 * for a small, closed set of mutually exclusive choices shown side by side (e.g. Sessions' own
 * `All` · `Running` · `Not running` filter, `docs/INTERFACE.md` § 5 — a later tarefa). Built as a
 * `role="radiogroup"` of native buttons (never `<input type="radio">`, which would need a `<form>`
 * and its own name/value plumbing this component has no reason to own) — `aria-pressed` marks the
 * selected option, satisfying identity § 8's "estado sempre com texto ou ícone, nunca só cor" by
 * construction (a screen reader announces "pressed", not just a colour change).
 *
 * @example
 * <SegmentedControl ariaLabel="Filter" value="all"
 *   options={[{ value: 'all', label: 'All' }, { value: 'running', label: 'Running' }]}
 *   onChange={setFilter} />
 */
import type { JSX } from 'preact';

export interface SegmentedControlOption {
  readonly value: string;
  readonly label: string;
}

export interface SegmentedControlProps {
  readonly ariaLabel: string;
  readonly value: string;
  readonly options: readonly SegmentedControlOption[];
  readonly onChange?: (value: string) => void;
}

export function SegmentedControl(props: SegmentedControlProps): JSX.Element {
  return (
    <div class="seeya-segmented-control" role="radiogroup" aria-label={props.ariaLabel}>
      {props.options.map((option) => {
        const selected = option.value === props.value;
        return (
          <button
            key={option.value}
            type="button"
            class="seeya-segmented-control-option"
            role="radio"
            aria-checked={selected}
            aria-pressed={selected}
            onClick={() => props.onChange?.(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
