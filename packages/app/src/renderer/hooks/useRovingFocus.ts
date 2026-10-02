/**
 * Keyboard navigation shared by every popover list in the design system (V2-T81, D-052) — `Menu`
 * (the Snooze actions) and `Select` (a value chooser) are two WAI-ARIA patterns with different
 * roles (`menuitem` vs `option`) but the SAME focus mechanics: the items are real focusable
 * elements inside a modal `<dialog>` (`Popover`), and arrow keys move focus between them. Written
 * once here so the two never drift apart.
 *
 * Defaults reproduce exactly what `Menu` always did (ArrowUp/ArrowDown, wrapping at both ends);
 * `homeEnd` and `typeahead` are opt-in, so adopting this hook never changes a caller's behaviour.
 *
 * Typeahead keeps a prefix buffer ("t", "te", ...) and focuses the first item whose text starts
 * with it. **No timer** (D-019 forbids `setTimeout` in `renderer/`): the buffer is cleared when
 * the gap between two keystrokes, measured with the event's own `timeStamp`, exceeds
 * `TYPEAHEAD_RESET_GAP_MS`, when any navigation key is pressed, or on `reset()` (call it each time
 * the list opens). Typing the same single letter repeatedly cycles through the items starting with
 * it, the usual native-select behaviour.
 *
 * @example
 * const { onKeyDown } = useRovingFocus({ listRef, itemSelector: '[role="option"]', typeahead: true });
 * <ul ref={listRef} onKeyDown={onKeyDown}>...</ul>
 */
import { useRef } from 'preact/hooks';
import type { RefObject } from 'preact';

/** Longest pause (ms, between two key events' own `timeStamp`) that still extends the current
 * typeahead buffer — the same order of magnitude native selects use. */
export const TYPEAHEAD_RESET_GAP_MS = 800;

export interface RovingFocusOptions {
  readonly listRef: RefObject<HTMLElement | null>;
  readonly itemSelector: string;
  readonly homeEnd?: boolean;
  readonly typeahead?: boolean;
}

export interface RovingFocus {
  readonly onKeyDown: (event: KeyboardEvent) => void;
  /** Clears the typeahead buffer — call whenever the list (re)opens. */
  readonly reset: () => void;
  /** The focusable items, in DOM order. */
  readonly items: () => HTMLElement[];
}

const NAVIGATION_KEYS: readonly string[] = ['ArrowDown', 'ArrowUp', 'Home', 'End'];

function isTypeaheadKey(event: KeyboardEvent): boolean {
  return (
    event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey
  );
}

function itemText(item: HTMLElement): string {
  return (item.textContent ?? '').trim().toLowerCase();
}

/** First index (searching from `from`, wrapping) whose text starts with `prefix`, or -1. */
function findPrefixIndex(items: readonly HTMLElement[], prefix: string, from: number): number {
  for (let offset = 0; offset < items.length; offset += 1) {
    const index = (from + offset) % items.length;
    const item = items[index];
    if (item !== undefined && itemText(item).startsWith(prefix)) {
      return index;
    }
  }
  return -1;
}

export function useRovingFocus(options: RovingFocusOptions): RovingFocus {
  const typed = useRef({ buffer: '', lastKeyAt: 0 });

  const items = (): HTMLElement[] =>
    Array.from(options.listRef.current?.querySelectorAll<HTMLElement>(options.itemSelector) ?? []);

  const reset = (): void => {
    typed.current = { buffer: '', lastKeyAt: 0 };
  };

  function focusAt(list: readonly HTMLElement[], index: number): void {
    list[(index + list.length) % list.length]?.focus();
  }

  function typeaheadTarget(list: readonly HTMLElement[], event: KeyboardEvent): number {
    const current = list.indexOf(document.activeElement as HTMLElement);
    const withinGap = event.timeStamp - typed.current.lastKeyAt <= TYPEAHEAD_RESET_GAP_MS;
    const key = event.key.toLowerCase();
    const buffer = withinGap ? typed.current.buffer + key : key;
    typed.current = { buffer, lastKeyAt: event.timeStamp };
    // A repeated single letter ("aa") cycles forward from the NEXT item; a growing prefix refines
    // the search from the current item itself.
    const repeated = buffer.length > 1 && buffer.split('').every((char) => char === key);
    if (repeated) {
      return findPrefixIndex(list, key, current + 1);
    }
    return findPrefixIndex(list, buffer, Math.max(current, 0));
  }

  function navigate(list: readonly HTMLElement[], key: string): void {
    const current = list.indexOf(document.activeElement as HTMLElement);
    if (key === 'Home') {
      focusAt(list, 0);
    } else if (key === 'End') {
      focusAt(list, list.length - 1);
    } else {
      focusAt(list, current + (key === 'ArrowDown' ? 1 : -1));
    }
  }

  function onKeyDown(event: KeyboardEvent): void {
    const list = items();
    if (list.length === 0) {
      return;
    }
    const isHomeEnd = event.key === 'Home' || event.key === 'End';
    if (NAVIGATION_KEYS.includes(event.key) && (!isHomeEnd || options.homeEnd === true)) {
      event.preventDefault();
      reset();
      navigate(list, event.key);
      return;
    }
    if (options.typeahead === true && isTypeaheadKey(event)) {
      const target = typeaheadTarget(list, event);
      if (target >= 0) {
        event.preventDefault();
        focusAt(list, target);
      }
    }
  }

  return { onKeyDown, reset, items };
}
