/**
 * The base select (V2-T62, D-051 — `docs/INTERFACE.md` item 1's "seleção"; rebuilt by V2-T81 on
 * the same base as the Snooze menu). A trigger button showing the current option plus a list in a
 * `Popover` — NOT a native `<select>`: a native select's arrow and its open list are drawn by the
 * Chromium/OS widget, outside the reach of CSS (the maintainer's installer screenshot: arrow glued
 * to the border, a system-blue list with none of the tokens or fonts). Same public API as before,
 * so no caller changes.
 *
 * WAI-ARIA select-only combobox: the trigger is `role="combobox"` (`aria-haspopup="listbox"`,
 * `aria-expanded`, `aria-controls`), the list is `role="listbox"` of `role="option"` items with
 * `aria-selected`. Because the list lives in a modal `<dialog>` (`Popover`), focus moves INTO the
 * list on open (onto the current option) and roving focus is real DOM focus, never
 * `aria-activedescendant`. Keys: ArrowUp/Down, Home/End, typeahead (`useRovingFocus`), Enter/Space
 * choose, Esc closes (native dialog), Tab closes. Closing returns focus to the trigger
 * (`Popover`'s `returnFocusToAnchor`). The trigger also opens on ArrowUp/ArrowDown.
 *
 * @example
 * <Select id="theme-select" label="Theme" value={theme} onChange={setTheme}
 *   options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }]} />
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { JSX, TargetedEvent } from 'preact';
import styles from './Select.module.css';
import { cx, mergeClassName } from '../css-class.js';
import { Text } from '../Text/index.js';
import { Popover } from '../Popover/index.js';
import { CheckIcon, ChevronDownIcon } from '../Icon/index.js';
import { useRovingFocus } from '../../hooks/useRovingFocus.js';

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
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const { onKeyDown, reset, items } = useRovingFocus({
    listRef,
    itemSelector: '[role="option"]',
    homeEnd: true,
    typeahead: true,
  });
  const listId = `${props.id}-listbox`;
  const current = props.options.find((option) => option.value === props.value);

  // Opening moves focus onto the current option (or the first one) — the trigger cannot keep it,
  // the list sits in a modal dialog. `Popover`'s own effect (a child, so it runs first) has already
  // shown the dialog by now. The typeahead buffer starts empty on every open.
  useEffect(() => {
    if (!open) {
      return;
    }
    reset();
    const list = items();
    const selected = list.find((item) => item.getAttribute('aria-selected') === 'true');
    (selected ?? list[0])?.focus();
  }, [open]);

  function choose(value: string): void {
    if (value !== props.value) {
      props.onChange?.(value);
    }
    setOpen(false);
  }

  function handleTriggerKeyDown(event: TargetedEvent<HTMLButtonElement, KeyboardEvent>): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
    }
  }

  function handleListKeyDown(event: TargetedEvent<HTMLUListElement, KeyboardEvent>): void {
    if (event.key === 'Tab') {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const value = (document.activeElement as HTMLElement | null)?.dataset.value;
      if (value !== undefined) {
        choose(value);
      }
      return;
    }
    onKeyDown(event);
  }

  return (
    <div class={mergeClassName(cx(styles, 'field'), props.className)}>
      <label class={cx(styles, 'labelRow')} for={props.id}>
        <Text as="span" variant="body-sm" weight={500} tone="secondary">
          {props.label}
        </Text>
      </label>
      <button
        ref={triggerRef}
        id={props.id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        class={cx(styles, 'trigger', props.monospace === true && 'monospace')}
        disabled={props.disabled}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        onKeyDown={handleTriggerKeyDown}
      >
        <Text
          as="span"
          variant={props.monospace === true ? 'code' : 'body-sm'}
          truncate
          className={cx(styles, 'value')}
        >
          {current?.label ?? ''}
        </Text>
        <ChevronDownIcon size={14} />
      </button>
      <Popover
        id={`${props.id}-popover`}
        open={open}
        anchorRef={triggerRef}
        matchAnchorWidth
        returnFocusToAnchor
        className={cx(styles, 'popover')}
        onRequestClose={() => setOpen(false)}
      >
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={`${props.label} options`}
          class={cx(styles, 'list')}
          onKeyDown={handleListKeyDown}
        >
          {props.options.map((option) => {
            const selected = option.value === props.value;
            return (
              <li
                key={option.value}
                role="option"
                aria-selected={selected}
                tabIndex={-1}
                data-value={option.value}
                title={option.title}
                class={cx(styles, 'option', selected && 'optionSelected')}
                onClick={() => choose(option.value)}
              >
                <Text
                  as="span"
                  variant={props.monospace === true ? 'code' : 'body-sm'}
                  truncate
                  className={cx(styles, 'optionLabel')}
                >
                  {option.label}
                </Text>
                {selected && <CheckIcon size={14} />}
              </li>
            );
          })}
        </ul>
      </Popover>
    </div>
  );
}
