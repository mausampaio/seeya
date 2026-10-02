/**
 * V2-T67 (`docs/INTERFACE.md` § 4): "Tabela: estrela ..., nome, lock ..., sessões, repositórios,
 * última atividade ... Ação da linha segue o lock." One `<table>`, headers in `<thead>`, one
 * `TableRow` per project in `<tbody>` (`renderer/components/TableRow/`, brought to the D-052
 * pattern by this task — its own first production caller).
 *
 * @example
 * <ProjectsTable rows={rows} onToggleFavorite={onToggleFavorite} onRowAction={onRowAction}
 *   isRowActionPending={isRowActionPending} />
 */
import type { JSX } from 'preact';
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

const HEADER_KEYS = [
  'projectsTableHeaderFavorite',
  'projectsTableHeaderName',
  'projectsTableHeaderLock',
  'projectsTableHeaderSessions',
  'projectsTableHeaderRepositories',
  'projectsTableHeaderLastActivity',
] as const;

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
    <Button
      size="sm"
      variant={action.kind === 'readOnly' ? 'secondary' : 'primary'}
      loading={loading}
      onClick={() => props.onRowAction(props.row)}
    >
      {label}
    </Button>
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

function buildRowCells(
  row: ProjectPanelRow,
  pending: boolean,
  onToggleFavorite: ProjectsTableProps['onToggleFavorite'],
  onRowAction: ProjectsTableProps['onRowAction'],
): readonly JSX.Element[] {
  return [
    <FavoriteStarButton row={row} onToggleFavorite={onToggleFavorite} />,
    <Text as="span" variant="body-sm" weight={500}>
      {row.name}
    </Text>,
    <Text as="span" variant="body-sm" tone="secondary">
      {formatProjectRowLockText(row.lock)}
    </Text>,
    <Text as="span" variant="body-sm">
      {row.sessions.length}
    </Text>,
    <Text as="span" variant="body-sm">
      {row.repositoryCount}
    </Text>,
    <Text as="span" variant="body-sm" tone="secondary">
      {formatSessionLastActivityText(row.lastActivity)}
    </Text>,
    <ActionButton row={row} pending={pending} onRowAction={onRowAction} />,
  ];
}

export function ProjectsTable(props: ProjectsTableProps): JSX.Element {
  return (
    <table class={cx(styles, 'table')}>
      <thead>
        <tr>
          {HEADER_KEYS.map((key) => (
            <th key={key} class={cx(styles, 'headerCell')}>
              <Text as="span" variant="caption" tone="tertiary">
                {MESSAGES[key]}
              </Text>
            </th>
          ))}
          <th class={cx(styles, 'headerCell')} />
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
