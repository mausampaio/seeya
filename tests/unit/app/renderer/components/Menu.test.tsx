// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { useRef } from 'preact/hooks';
import { Menu } from '../../../../../packages/app/src/renderer/components/Menu/index.js';

afterEach(cleanup);

const ITEMS = [
  { value: '15', label: '+15m' },
  { value: '30', label: '+30m' },
  { value: '60', label: '+1h' },
];

function Harness(props: { readonly onSelect: (value: string) => void }) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={anchorRef}>Snooze</button>
      <Menu
        id="test-menu"
        open
        anchorRef={anchorRef}
        ariaLabel="Snooze"
        items={ITEMS}
        onSelect={props.onSelect}
        onRequestClose={() => {}}
      />
    </>
  );
}

describe('Menu (D-052, V2-T75, PO review 2026-10-01 — the Snooze menu)', () => {
  it('renders one menuitem per item, with role="menu" on the list', () => {
    const { getByRole, getAllByRole } = render(<Harness onSelect={() => {}} />);
    expect(getByRole('menu')).not.toBeNull();
    expect(getAllByRole('menuitem')).toHaveLength(3);
  });

  it('clicking an item calls onSelect with its value', () => {
    const onSelect = vi.fn();
    const { getByRole } = render(<Harness onSelect={onSelect} />);
    fireEvent.click(getByRole('menuitem', { name: '+30m' }));
    expect(onSelect).toHaveBeenCalledWith('30');
  });

  it('ArrowDown/ArrowUp move focus between items, wrapping at both ends', () => {
    const { getByRole, getAllByRole } = render(<Harness onSelect={() => {}} />);
    const menu = getByRole('menu');
    const items = getAllByRole('menuitem');
    items[0]?.focus();
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[2]);
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[2]);
  });
});
