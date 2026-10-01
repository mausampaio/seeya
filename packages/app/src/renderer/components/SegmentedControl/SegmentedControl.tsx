/**
 * The base segmented control (V2-T62, D-051 — `docs/INTERFACE.md` item 1's "controle segmentado"),
 * for a small, closed set of mutually exclusive choices shown side by side (e.g. the New tab
 * popover's own `claude`/`codex`/`Shell`/`Other…` selector, V2-T64). Built as a `role="radiogroup"`
 * of native buttons (never `<input type="radio">`, which would need a `<form>` and its own
 * name/value plumbing this component has no reason to own) — `aria-pressed` marks the selected
 * option, satisfying identity § 8's "estado sempre com texto ou ícone, nunca só cor" by
 * construction (a screen reader announces "pressed", not just a colour change).
 *
 * @example
 * <SegmentedControl ariaLabel="Filter" value="all"
 *   options={[{ value: 'all', label: 'All' }, { value: 'running', label: 'Running' }]}
 *   onChange={setFilter} />
 *
 * Brought to the CSS-module/render-tested pattern by V2-T64 (D-052, Q-102 — relocated from `ui/`
 * by V2-T75 without a reshape, since it had no production caller yet).
 */
import type { JSX } from 'preact';
import styles from './SegmentedControl.module.css';
import { cx } from '../css-class.js';

export interface SegmentedControlOption {
  readonly value: string;
  /** An id for the option's own `<button>` — lets a caller target one specific segment (e.g. the
   * New tab popover's own instrumentation, `main/main.ts`'s `SEEYA_APP_AUTO_OPEN_SHELL_TAB`)
   * without reaching for a brittle `nth-child` selector. Optional: most callers have no reason to
   * name an individual option. */
  readonly id?: string;
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
    <div class={cx(styles, 'group')} role="radiogroup" aria-label={props.ariaLabel}>
      {props.options.map((option) => {
        const selected = option.value === props.value;
        return (
          <button
            key={option.value}
            id={option.id}
            type="button"
            class={cx(styles, 'option', selected && 'selected')}
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
