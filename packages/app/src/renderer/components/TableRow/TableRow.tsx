/**
 * The base table row (V2-T62, D-051 — `docs/INTERFACE.md` item 1's "linha de tabela", for the
 * Projects/Sessions tables a later tarefa adds, `docs/INTERFACE.md` §§ 4/5). One `<td>` per cell,
 * and an optional click (identity's "a ação segue o estado" — a row that offers `Go to tab` is
 * clickable, one without a running tab is not, decided by the CALLER passing `onClick` or not).
 *
 * @example
 * <TableRow cells={[name, lock, sessions]} onClick={() => goToTab(id)} />
 *
 * Relocated from `ui/` by D-052 (V2-T75) — still no production caller (confirmed by grep before
 * moving it) and still styled by `renderer/legacy/components.css`'s own `.seeya-table-row*` global
 * classes, not a CSS module yet; left for the Projects/Sessions region tasks that first put it on
 * screen.
 */
import type { ComponentChildren, JSX } from 'preact';

export interface TableRowProps {
  readonly cells: readonly ComponentChildren[];
  readonly selected?: boolean;
  readonly onClick?: () => void;
}

export function TableRow(props: TableRowProps): JSX.Element {
  const className = ['seeya-table-row', props.selected === true ? 'seeya-table-row--selected' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <tr class={className} onClick={props.onClick}>
      {props.cells.map((cell, index) => (
        // A row's cells are positional and never reordered independently of the row itself, so
        // the index IS the cell's stable identity here — not a stand-in for a missing real key.
        <td key={index} class="seeya-table-row-cell">
          {cell}
        </td>
      ))}
    </tr>
  );
}
