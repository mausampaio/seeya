// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/preact';
import { Select } from '../../../../../packages/app/src/renderer/components/Select/index.js';
import styles from '../../../../../packages/app/src/renderer/components/Select/Select.module.css';
import { classesOf } from './_dom.js';

afterEach(cleanup);

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta', title: '/full/path/to/beta' },
  { value: 'c', label: 'Bravo' },
  { value: 'd', label: 'Delta' },
];

function renderSelect(
  extra: {
    readonly value?: string;
    readonly disabled?: boolean;
    readonly monospace?: boolean;
    readonly onChange?: (value: string) => void;
  } = {},
) {
  const view = render(
    <Select
      id="my-select"
      label="Resume in"
      value={extra.value ?? 'a'}
      options={OPTIONS}
      {...(extra.disabled !== undefined ? { disabled: extra.disabled } : {})}
      {...(extra.monospace !== undefined ? { monospace: extra.monospace } : {})}
      {...(extra.onChange !== undefined ? { onChange: extra.onChange } : {})}
    />,
  );
  const trigger = view.getByLabelText('Resume in') as HTMLButtonElement;
  const popover = view.container.querySelector('dialog') as HTMLDialogElement;
  const list = view.getByRole('listbox', { hidden: true });
  const options = () => Array.from(list.querySelectorAll<HTMLElement>('[role="option"]'));
  const open = () => fireEvent.click(trigger);
  const key = (name: string) => fireEvent.keyDown(list, { key: name });
  return { ...view, trigger, popover, list, options, open, key };
}

describe('Select (V2-T81 — trigger + Popover listbox, not a native <select>)', () => {
  it('the trigger carries the label, the combobox role and the current option label', () => {
    const { trigger } = renderSelect({ value: 'b' });
    expect(trigger.getAttribute('role')).toBe('combobox');
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-controls')).toBe('my-select-listbox');
    expect(trigger.id).toBe('my-select');
    expect(trigger.textContent).toContain('Beta');
  });

  it('is closed until the trigger is clicked, then opens the popover and sets aria-expanded', () => {
    const { trigger, popover, open } = renderSelect();
    expect(popover.open).toBe(false);
    open();
    expect(popover.open).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('renders role=option items with aria-selected on the current one only', () => {
    const { options, open } = renderSelect({ value: 'c' });
    open();
    expect(options().map((o) => o.getAttribute('aria-selected'))).toEqual([
      'false',
      'false',
      'true',
      'false',
    ]);
  });

  it('puts the option title on the item so a shortened label keeps its full text', () => {
    const { options } = renderSelect();
    expect(options()[1]?.getAttribute('title')).toBe('/full/path/to/beta');
    expect(options()[0]?.getAttribute('title')).toBeNull();
  });

  it('opening focuses the current option', () => {
    const { options, open } = renderSelect({ value: 'c' });
    open();
    expect(document.activeElement).toBe(options()[2]);
  });

  it('clicking an option calls onChange and closes the list', () => {
    const onChange = vi.fn();
    const { options, open, popover, trigger } = renderSelect({ onChange });
    open();
    fireEvent.click(options()[3] as HTMLElement);
    expect(onChange).toHaveBeenCalledWith('d');
    expect(popover.open).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('choosing the option that is already current closes without calling onChange', () => {
    const onChange = vi.fn();
    const { options, open, popover } = renderSelect({ onChange });
    open();
    fireEvent.click(options()[0] as HTMLElement);
    expect(onChange).not.toHaveBeenCalled();
    expect(popover.open).toBe(false);
  });

  it('ArrowDown/ArrowUp move focus, wrapping at both ends', () => {
    const { options, open, key } = renderSelect({ value: 'a' });
    open();
    key('ArrowUp');
    expect(document.activeElement).toBe(options()[3]);
    key('ArrowDown');
    expect(document.activeElement).toBe(options()[0]);
    key('ArrowDown');
    expect(document.activeElement).toBe(options()[1]);
  });

  it('Home and End jump to the first and last option', () => {
    const { options, open, key } = renderSelect({ value: 'b' });
    open();
    key('End');
    expect(document.activeElement).toBe(options()[3]);
    key('Home');
    expect(document.activeElement).toBe(options()[0]);
  });

  it('Enter chooses the focused option', () => {
    const onChange = vi.fn();
    const { open, key } = renderSelect({ onChange });
    open();
    key('ArrowDown');
    key('Enter');
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('Space chooses the focused option', () => {
    const onChange = vi.fn();
    const { open, key } = renderSelect({ onChange });
    open();
    key('End');
    key(' ');
    expect(onChange).toHaveBeenCalledWith('d');
  });

  it('Tab closes the list without choosing anything', () => {
    const onChange = vi.fn();
    const { open, key, popover } = renderSelect({ onChange });
    open();
    key('ArrowDown');
    key('Tab');
    expect(popover.open).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('Esc (the native dialog close) closes the list, flips aria-expanded and refocuses the trigger', async () => {
    const { open, popover, trigger } = renderSelect();
    open();
    await act(() => popover.close()); // what Esc does natively
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('a click outside the list (the popover backdrop) closes it', () => {
    const { open, popover } = renderSelect();
    open();
    fireEvent.click(popover);
    expect(popover.open).toBe(false);
  });

  it('typeahead jumps to the first option starting with the typed letter', () => {
    const { options, open, key } = renderSelect({ value: 'a' });
    open();
    key('d');
    expect(document.activeElement).toBe(options()[3]);
  });

  it('typeahead accumulates a prefix typed in quick succession ("br" skips Beta for Bravo)', () => {
    const { options, open, key } = renderSelect({ value: 'a' });
    open();
    key('b');
    expect(document.activeElement).toBe(options()[1]);
    key('r');
    expect(document.activeElement).toBe(options()[2]);
  });

  it('typing the same letter again cycles through the options starting with it', () => {
    const { options, open, key } = renderSelect({ value: 'a' });
    open();
    key('b');
    expect(document.activeElement).toBe(options()[1]);
    key('b');
    expect(document.activeElement).toBe(options()[2]);
    key('b');
    expect(document.activeElement).toBe(options()[1]);
  });

  it('typeahead with no match leaves focus where it was', () => {
    const { options, open, key } = renderSelect({ value: 'b' });
    open();
    key('z');
    expect(document.activeElement).toBe(options()[1]);
  });

  it('the typeahead buffer starts empty on every open (no leftover prefix from last time)', async () => {
    const { options, open, key, popover } = renderSelect({ value: 'a' });
    open();
    key('b');
    await act(() => popover.close());
    open();
    key('r'); // a stale "b" would make this "br" -> Bravo; fresh, "r" matches nothing
    expect(document.activeElement).not.toBe(options()[2]);
  });

  it('ArrowDown/ArrowUp on the trigger open the list', () => {
    const { trigger, popover } = renderSelect();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(popover.open).toBe(true);
  });

  it('disabled: the trigger is disabled and a click never opens the list', () => {
    const { trigger, popover } = renderSelect({ disabled: true });
    expect(trigger.disabled).toBe(true);
    fireEvent.click(trigger);
    expect(popover.open).toBe(false);
  });

  it('monospace is opt-in — absent by default', () => {
    const { trigger } = renderSelect();
    expect(classesOf(trigger)).not.toContain(styles.monospace);
  });

  it('applies the monospace class when asked (paths read better in mono)', () => {
    const { trigger } = renderSelect({ monospace: true });
    expect(classesOf(trigger)).toContain(styles.monospace);
  });

  it('fullWidth is opt-in on both the field and the trigger', () => {
    const plain = renderSelect();
    expect(classesOf(plain.trigger)).not.toContain(styles.fullWidth);
    cleanup();
    const full = render(<Select id="wide" label="Wide" value="a" options={OPTIONS} fullWidth />);
    expect(classesOf(full.getByLabelText('Wide'))).toContain(styles.fullWidth);
  });

  it('the list is labelled by the same label text', () => {
    const { list } = renderSelect();
    expect(list.getAttribute('aria-label')).toBe('Resume in options');
  });
});
