import { describe, expect, it } from 'vitest';
import type { VNode } from 'preact';
import { TableRow } from '../../../../../packages/app/src/renderer/components/TableRow/TableRow.js';
import { propsOf } from './_vnode.js';

interface RowProps {
  readonly class: string;
  readonly onClick?: () => void;
  readonly children: readonly VNode<unknown>[];
}
interface CellProps {
  readonly children: unknown;
}

describe('TableRow (V2-T62, D-051)', () => {
  it('renders one td per cell, in order', () => {
    const vnode = TableRow({ cells: ['my-project', 'Unlocked', '2'] });
    expect(vnode.type).toBe('tr');
    const cells = propsOf<RowProps>(vnode).children;
    expect(cells).toHaveLength(3);
    expect(cells.every((cell) => cell.type === 'td')).toBe(true);
    expect(cells.map((cell) => propsOf<CellProps>(cell).children)).toEqual([
      'my-project',
      'Unlocked',
      '2',
    ]);
  });

  it('is clickable only when onClick is given, and marks selected', () => {
    const onClick = () => {};
    const clickable = propsOf<RowProps>(TableRow({ cells: ['x'], onClick, selected: true }));
    expect(clickable.onClick).toBe(onClick);
    expect(clickable.class).toContain('seeya-table-row--selected');

    const notClickable = propsOf<RowProps>(TableRow({ cells: ['x'] }));
    expect(notClickable.onClick).toBeUndefined();
    expect(notClickable.class).not.toContain('selected');
  });
});
