// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/preact';
import { useRef } from 'preact/hooks';
import {
  TYPEAHEAD_RESET_GAP_MS,
  useRovingFocus,
} from '../../../../../packages/app/src/renderer/hooks/useRovingFocus.js';

afterEach(cleanup);

function Harness(props: { readonly homeEnd?: boolean; readonly typeahead?: boolean }) {
  const listRef = useRef<HTMLUListElement>(null);
  const { onKeyDown } = useRovingFocus({
    listRef,
    itemSelector: 'button',
    ...(props.homeEnd !== undefined ? { homeEnd: props.homeEnd } : {}),
    ...(props.typeahead !== undefined ? { typeahead: props.typeahead } : {}),
  });
  return (
    <ul ref={listRef} onKeyDown={onKeyDown}>
      <li>
        <button>Alpha</button>
      </li>
      <li>
        <button>Beta</button>
      </li>
      <li>
        <button>Bravo</button>
      </li>
    </ul>
  );
}

/** A keydown whose `timeStamp` the test controls — the typeahead gap is measured on it. */
function keyAt(target: Element, key: string, timeStamp: number): void {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  Object.defineProperty(event, 'timeStamp', { value: timeStamp });
  target.dispatchEvent(event);
}

describe('useRovingFocus (V2-T81)', () => {
  it('defaults: arrows wrap; Home/End and typeahead do nothing unless asked for', () => {
    const { container, getAllByRole } = render(<Harness />);
    const list = container.querySelector('ul') as HTMLUListElement;
    const buttons = getAllByRole('button');
    buttons[0]?.focus();
    keyAt(list, 'End', 1);
    keyAt(list, 'b', 2);
    expect(document.activeElement).toBe(buttons[0]);
    keyAt(list, 'ArrowUp', 3);
    expect(document.activeElement).toBe(buttons[2]);
  });

  it('typeahead resets after a pause longer than TYPEAHEAD_RESET_GAP_MS', () => {
    const { container, getAllByRole } = render(<Harness typeahead />);
    const list = container.querySelector('ul') as HTMLUListElement;
    const buttons = getAllByRole('button');
    buttons[0]?.focus();
    keyAt(list, 'b', 1000);
    expect(document.activeElement).toBe(buttons[1]);
    // quick "r": prefix "br" -> Bravo
    keyAt(list, 'r', 1000 + TYPEAHEAD_RESET_GAP_MS);
    expect(document.activeElement).toBe(buttons[2]);
    // a long pause, then "r" alone: a fresh buffer "r" matches nothing, focus stays
    keyAt(list, 'r', 1000 + TYPEAHEAD_RESET_GAP_MS * 3);
    expect(document.activeElement).toBe(buttons[2]);
  });

  it('a navigation key clears the typeahead buffer', () => {
    const { container, getAllByRole } = render(<Harness typeahead />);
    const list = container.querySelector('ul') as HTMLUListElement;
    const buttons = getAllByRole('button');
    buttons[0]?.focus();
    keyAt(list, 'b', 1);
    keyAt(list, 'ArrowUp', 2); // -> Alpha, buffer cleared
    keyAt(list, 'r', 3); // fresh "r": no match, focus stays on Alpha
    expect(document.activeElement).toBe(buttons[0]);
  });
});
