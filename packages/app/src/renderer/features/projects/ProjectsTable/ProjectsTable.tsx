/**
 * V2-T67 (`docs/INTERFACE.md` § 4): "Tabela: estrela ..., nome, lock ..., sessões, repositórios,
 * última atividade ... Ação da linha segue o lock." One `<table>`, headers in `<thead>`, one
 * `TableRow` per project in `<tbody>` (`renderer/components/TableRow/`, brought to the D-052
 * pattern by this task — its own first production caller).
 *
 * PO review round 1 — column layout: `table-layout: fixed` with an explicit `width` on every
 * `<th>` except Name (which gets whatever is left over) is what makes `Text`'s own `truncate`
 * prop (`display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap`)
 * actually truncate against a REAL constrained width instead of the table just growing taller
 * with wrapped lines — `table-layout: fixed` takes its column widths from the `<thead>` row's own
 * `<th>`s, so setting them there is enough; no per-cell width is needed in `<tbody>`. Name/Lock/
 * Last activity all get `truncate` + a `title` with the untruncated text (only when it would
 * actually differ, same convention `IgnoredProjectsSection.tsx` uses) — Name is the one most
 * likely to actually overflow (a project id/name has no length limit this component enforces),
 * Lock and Last activity are defensive (their own formats are bounded in practice, but neither is
 * a reason to let them silently wrap if a future format ever grows). Sessions/Repositories are
 * bare counts — `.numericCell` right-aligns them without needing `truncate` (they never overflow).
 * The action column's own width comes from the SAME mechanism, plus a `min-width` on the button
 * itself so "Open"/"Read only…"/"Go to tab" all measure the same, right-aligned within the column
 * (`.actionCell`) instead of each hugging its own label's width.
 */
import type { ComponentChildren, JSX } from 'preact';
import styles from './ProjectsTable.module.css';
import { cx } from '../../../components/css-class.js';
import { Text } from '../../../components/Text/index.js';
import { TableRow } from '../../../components/TableRow/index.js';
import { IconButton } from '../../../components/IconButton/index.js';
import { Button } from '../../../components/Button/index.js';
import { StarIcon } from '../../../components/Icon/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import {
  formatProjectRowLockText,
  formatSessionLastActivityText,
  resolveProjectRowAction,
  type ProjectPanelRow,
} from '../../../../state/projects-panel.js';

export interface ProjectsTableProps {
  readonly rows: readonly ProjectPanelRow[];
  readonly onToggleFavorite: (projectId: string, favorite: boolean) => void;
  readonly onRowAction: (row: ProjectPanelRow) => void;
  readonly isRowActionPending: (row: ProjectPanelRow) => boolean;
}

/** Narrowed to exactly the five header labels this table actually shows — all plain strings in
 * `MESSAGES`, never one of that object's own formatter FUNCTIONS (`keyof typeof MESSAGES` alone
 * would admit those too, and `MESSAGES[key]` would then type as a union TypeScript would refuse to
 * render as JSX children). Favorite/Action are deliberately headerless (this file's own `COLUMNS`
 * comment on `favorite` has why). */
type ProjectsTableHeaderKey = Extract<
  keyof typeof MESSAGES,
  | 'projectsTableHeaderName'
  | 'projectsTableHeaderLock'
  | 'projectsTableHeaderSessions'
  | 'projectsTableHeaderRepositories'
  | 'projectsTableHeaderLastActivity'
>;

/** One entry per column, in order — `width`/`align` drive the `<th>` that fixes the whole
 * column's size (`table-layout: fixed`, this file's own top docstring); `undefined` width means
 * "whatever is left over" (Name is the only one). */
const COLUMNS: readonly {
  readonly key: string;
  readonly headerKey?: ProjectsTableHeaderKey;
  readonly width?: string;
  readonly align?: 'right';
}[] = [
  // PO review round 1: no visible header text — `MESSAGES.projectsTableHeaderFavorite` overflowed
  // into the Name column at this width ("FavoriteName", touching, no gap); a bare star icon column
  // reads fine unlabeled, the same precedent the Action column (also headerless) already sets, and
  // every star button still carries its own per-row `aria-label` regardless.
  { key: 'favorite', width: '32px' },
  { key: 'name', headerKey: 'projectsTableHeaderName' },
  // PO review round 1, fifth pass: every width below is the SMALLEST that still shows its own
  // longest REALISTIC value in full — measured with a CDP `Runtime.evaluate` against the real
  // bundle's own `getBoundingClientRect()`/`Range` geometry (`<scratchpad>/v2t67/inspect-layout2.mjs`,
  // not committed), never a screenshot ruler again: the third/fourth pass's own screenshot-pixel
  // measurements were taken off a PHYSICAL-pixel capture at this machine's 1.25x display scale and
  // then written here as if they were already logical CSS px, over-allocating every fixed column
  // by ~25% and starving Name down to under 100px — the defect a DOM measurement can't make again,
  // since `getBoundingClientRect()` always answers in the same logical px this `width` is set in.
  // Giving any one of these columns a single px more than its own measured minimum (+ a few px of
  // margin) is a px Name doesn't get, and a short, ordinary project name ("Payments webhooks",
  // 135px of actual text; "Billing reconciliation", 132px) is exactly the case the PO's own report
  // named as wrapping for no reason; truncation is still correct (and expected) for a genuinely
  // long name, `02-search-active.png`'s own fixture proves that case separately.
  { key: 'lock', headerKey: 'projectsTableHeaderLock', width: '217px' },
  {
    key: 'sessions',
    headerKey: 'projectsTableHeaderSessions',
    width: '78px',
    align: 'right',
  },
  {
    key: 'repositories',
    headerKey: 'projectsTableHeaderRepositories',
    width: '97px',
    align: 'right',
  },
  // `toLocaleString()` (`formatSessionLastActivityText`) renders a full date AND time
  // ("02/10/2026, 00:16:44", 21 characters in the pt-BR locale this was measured against, 147px of
  // actual text at this column's own font) — 174px is this column's measured minimum plus margin.
  { key: 'lastActivity', headerKey: 'projectsTableHeaderLastActivity', width: '174px' },
  // Paired with `.actionButton`'s own fixed (not minimum) width below — a real capture at
  // 115px/min-width:95px showed the three action labels at three DIFFERENT rendered widths
  // ("Go to tab" and "Read only…" are both naturally wider than the 95px floor, so `min-width`
  // never equalized them; only "Open", the shortest, ever sat at the floor). A `min-width` can
  // only ever raise a shorter label up to it, never pull a longer one back down — only a true
  // `width` (a ceiling AND a floor) makes every label render at the identical size this column
  // needs to actually read as a column.
  { key: 'action', width: '151px', align: 'right' },
];

function ActionButton(props: {
  readonly row: ProjectPanelRow;
  readonly pending: boolean;
  readonly onRowAction: (row: ProjectPanelRow) => void;
}): JSX.Element {
  const action = resolveProjectRowAction(props.row.lock);
  const label =
    action.kind === 'goToTab'
      ? MESSAGES.projectsActionGoToTab
      : action.kind === 'open'
        ? MESSAGES.projectsActionOpen
        : MESSAGES.projectsActionReadOnly;
  // `goToTab` is always synchronous (a plain tab switch, `useProjects.ts#onRowAction`) — this
  // component never shows a spinner for it, independent of whatever `pending` the caller passes,
  // the same invariant `useProjects.ts#isRowActionPending`'s own docstring already states.
  const loading = action.kind !== 'goToTab' && props.pending;
  return (
    <div class={cx(styles, 'actionCell')}>
      <Button
        size="sm"
        variant={action.kind === 'readOnly' ? 'secondary' : 'primary'}
        loading={loading}
        className={cx(styles, 'actionButton')}
        onClick={() => props.onRowAction(props.row)}
      >
        {label}
      </Button>
    </div>
  );
}

function FavoriteStarButton(props: {
  readonly row: ProjectPanelRow;
  readonly onToggleFavorite: (projectId: string, favorite: boolean) => void;
}): JSX.Element {
  const { row } = props;
  return (
    <IconButton
      size="sm"
      aria-label={MESSAGES.sidebarFavoriteStarLabel(row.favorite, row.name)}
      onClick={() => props.onToggleFavorite(row.projectId, !row.favorite)}
    >
      <StarIcon filled={row.favorite} />
    </IconButton>
  );
}

/** Sessions/Repositories — bare counts, never long enough to need `truncate`; `.numericCell`
 * right-aligns them within their own fixed-width column. */
function NumericCell(props: { readonly value: number }): JSX.Element {
  return (
    <Text as="span" variant="body-sm" className={cx(styles, 'numericCell')}>
      {props.value}
    </Text>
  );
}

/** Last activity — PO review round 1: a project with no known activity shows a dash in secondary
 * tone, with a `title` explaining why, instead of the raw "unknown" word that read as an error
 * (D-025: still never a guessed date). A dated project reuses `formatSessionLastActivityText` —
 * the SAME formatting every other list of sessions in this window already shows, never a third
 * date format invented here. */
function LastActivityCell(props: { readonly lastActivity: Date | null }): JSX.Element {
  if (props.lastActivity === null) {
    return (
      <Text
        as="span"
        variant="body-sm"
        tone="secondary"
        title={MESSAGES.projectsLastActivityUnknownTitle}
      >
        {MESSAGES.projectsLastActivityUnknown}
      </Text>
    );
  }
  const text = formatSessionLastActivityText(props.lastActivity);
  return (
    <Text as="span" variant="body-sm" tone="secondary" truncate title={text}>
      {text}
    </Text>
  );
}

function buildRowCells(
  row: ProjectPanelRow,
  pending: boolean,
  onToggleFavorite: ProjectsTableProps['onToggleFavorite'],
  onRowAction: ProjectsTableProps['onRowAction'],
): readonly ComponentChildren[] {
  const lockText = formatProjectRowLockText(row.lock);
  return [
    <FavoriteStarButton row={row} onToggleFavorite={onToggleFavorite} />,
    <Text as="span" variant="body-sm" weight={500} truncate title={row.name}>
      {row.name}
    </Text>,
    <Text as="span" variant="body-sm" tone="secondary" truncate title={lockText}>
      {lockText}
    </Text>,
    <NumericCell value={row.sessions.length} />,
    <NumericCell value={row.repositoryCount} />,
    <LastActivityCell lastActivity={row.lastActivity} />,
    <ActionButton row={row} pending={pending} onRowAction={onRowAction} />,
  ];
}

export function ProjectsTable(props: ProjectsTableProps): JSX.Element {
  return (
    <table class={cx(styles, 'table')}>
      <thead>
        <tr>
          {COLUMNS.map((column) => (
            <th
              key={column.key}
              class={cx(styles, 'headerCell', column.align === 'right' && 'alignRight')}
              style={column.width !== undefined ? { width: column.width } : undefined}
            >
              {column.headerKey !== undefined && (
                <Text as="span" variant="caption" tone="tertiary" truncate>
                  {MESSAGES[column.headerKey]}
                </Text>
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {props.rows.map((row) => (
          <TableRow
            key={row.projectId}
            cells={buildRowCells(
              row,
              props.isRowActionPending(row),
              props.onToggleFavorite,
              props.onRowAction,
            )}
          />
        ))}
      </tbody>
    </table>
  );
}
