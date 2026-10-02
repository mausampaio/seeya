/**
 * The base table row (V2-T62, D-051 — `docs/INTERFACE.md` item 1's "linha de tabela", for the
 * Projects/Sessions tables, `docs/INTERFACE.md` §§ 4/5). One `<td>` per cell, and an optional
 * click (identity's "a ação segue o estado" — a row that offers `Go to tab` is clickable, one
 * without a running tab is not, decided by the CALLER passing `onClick` or not).
 *
 * @example
 * <TableRow cells={[name, lock, sessions]} onClick={() => goToTab(id)} />
 *
 * Brought to the CSS-module/render-tested pattern by V2-T67 (D-052, Q-102's own precedent) — first
 * production caller is the Projects tab's own table (`renderer/features/projects/ProjectsTable/`).
 * Replaces the `.seeya-table-row*` global classes (`renderer/legacy/components.css`, removed by
 * this task — confirmed by grep that nothing under `renderer/legacy/` ever used them, same as
 * every other component V2-T62 left for a later region task to finish).
 */
import type { ComponentChildren, JSX } from 'preact';
import styles from './TableRow.module.css';
import { cx, mergeClassName } from '../css-class.js';

export interface TableRowProps {
  readonly cells: readonly ComponentChildren[];
  readonly selected?: boolean;
  readonly onClick?: () => void;
  readonly className?: string;
}

export function TableRow(props: TableRowProps): JSX.Element {
  const className = mergeClassName(
    cx(
      styles,
      'row',
      props.selected === true && 'selected',
      props.onClick !== undefined && 'clickable',
    ),
    props.className,
  );
  return (
    <tr class={className} onClick={props.onClick}>
      {props.cells.map((cell, index) => (
        // A row's cells are positional and never reordered independently of the row itself, so
        // the index IS the cell's stable identity here — not a stand-in for a missing real key.
        <td key={index} class={cx(styles, 'cell')}>
          {cell}
        </td>
      ))}
    </tr>
  );
}
