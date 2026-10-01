/**
 * The base select (V2-T62, D-051 — `docs/INTERFACE.md` item 1's "seleção"). A `<label>` wrapping a
 * `<select>`, one `<option>` per entry — the same shape `renderer/legacy/today-panel-view.ts
 * #renderResumeInSelect` already built by hand for "Resume in" (V2-T9), now a reusable component.
 *
 * @example
 * <Select id="theme-select" label="Theme" value={theme} onChange={setTheme}
 *   options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }]} />
 *
 * Brought to the CSS-module/render-tested pattern by V2-T66 (D-052, Q-102) — first production
 * caller is Today's own `CwdChangeNotice` (`docs/INTERFACE.md` § 3's own "Resume in" selector).
 * `monospace`, new: the "Resume in" options are filesystem paths, which read better in the same
 * mono family `SessionCard`'s own directory line already uses — optional, so Settings' own future
 * "Theme" select (plain words, not paths) is unaffected.
 */
import type { JSX } from 'preact';
import styles from './Select.module.css';
import { cx, mergeClassName } from '../css-class.js';
import { Text } from '../Text/index.js';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
  /** The full, unabbreviated text for this option — set only where `label` is itself already
   * shortened for display (V2-T66 PO review, item 2: a "Resume in" option's `label` is a `cwd`
   * abbreviated to `~`/end-truncated; `title` keeps the real path a hover can still reveal, same
   * discipline `sidebar/directory-label.ts` already documents for a row's own `title`). */
  readonly title?: string;
}

export interface SelectProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly options: readonly SelectOption[];
  readonly disabled?: boolean;
  /** `docs/INTERFACE.md` § 3's own "Resume in" selector — its own options are directory paths,
   * read better in the mono family `SessionCard`'s own directory line already uses. Off by
   * default (most selects in this app show plain words, not paths). */
  readonly monospace?: boolean;
  readonly className?: string;
  readonly onChange?: (value: string) => void;
}

export function Select(props: SelectProps): JSX.Element {
  return (
    <div class={mergeClassName(cx(styles, 'field'), props.className)}>
      <label class={cx(styles, 'labelRow')} for={props.id}>
        <Text as="span" variant="body-sm" weight={500} tone="secondary">
          {props.label}
        </Text>
      </label>
      <select
        id={props.id}
        class={cx(styles, 'select', props.monospace === true && 'monospace')}
        value={props.value}
        disabled={props.disabled}
        onChange={(event) => props.onChange?.((event.target as HTMLSelectElement).value)}
      >
        {props.options.map((option) => (
          <option key={option.value} value={option.value} title={option.title}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
