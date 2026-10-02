/**
 * V2-T68 (`docs/INTERFACE.md` § 5): "Tabela: nome, id curto copiável ..., estado ..., diretório
 * ..., projeto (`No project` quando não há), última atividade ... Ação da linha segue o estado."
 * Same `table-layout: fixed` + per-`<th>` `width` discipline `ProjectsTable.tsx`'s own top
 * docstring explains (truncate actually truncates against a real constrained width, never grows
 * the table taller with wrapped lines).
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { PathPlatformHint } from '@seeya-ai/engine/core/cwd-normalization.js';
import { formatDirectoryPathForDisplay } from '../../../../sidebar/directory-label.js';
import styles from './SessionsTable.module.css';
import { cx } from '../../../components/css-class.js';
import { Text } from '../../../components/Text/index.js';
import { TableRow } from '../../../components/TableRow/index.js';
import { Button } from '../../../components/Button/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import { formatSessionLastActivityText } from '../../../../state/projects-panel.js';
import {
  resolveSessionRowAction,
  type SessionRowAction,
} from '../../../../state/sessions-table.js';
import type { SessionsPanelRow } from '../../../../state/sessions-panel.js';

type SessionsTableHeaderKey = Extract<
  keyof typeof MESSAGES,
  | 'sessionsTableHeaderName'
  | 'sessionsTableHeaderId'
  | 'sessionsTableHeaderState'
  | 'sessionsTableHeaderDirectory'
  | 'sessionsTableHeaderProject'
  | 'sessionsTableHeaderLastActivity'
>;

/** One entry per column, in order — same `width`/`align` discipline as `ProjectsTable.tsx`'s own
 * `COLUMNS`. **PO review round 2 (V2-T70's own visual proof found it):** the original set of
 * widths here was never pixel-measured and summed to 1054px — with `table-layout: fixed`, when a
 * table's explicit column widths sum to MORE than its container's own width, the browser grows
 * the TABLE itself past the container instead of shrinking those columns, and starves the one
 * column left without an explicit width (Name) down to a measured `0`, not just "narrow" —
 * confirmed with a real `getBoundingClientRect()` read against the built bundle at this window's
 * own default size (1200px, 260px sidebar, ~938px content width): `th0`'s own rendered width was
 * exactly `0`. These numbers are the same real-bundle-measurement discipline as
 * `ProjectsTable.tsx`'s own COLUMNS (not a screenshot ruler) — `id`/`directory`/`project` all keep
 * their own `truncate` + `title` backstop for a value longer than these mid-range widths, `state`
 * stays at its own PO-reviewed 160px (the one column whose longest realistic value, "no running
 * process", must never truncate), and `action` is the minimum that fits `Resume`+`Adopt…` side by
 * side (`.actionButton`'s own `min-width: 84px` × 2 + `gap: 8px` + this cell's own `12px` × 2
 * padding, `TableRow.module.css#.cell`). Sum: 800px, leaving Name ~140px at this window's default
 * size — truncating a long name is correct and expected (the same tradeoff `ProjectsTable.tsx`'s
 * own Name column already makes), never losing the column outright. */
// Exported for `tests/unit/app/renderer/features/sessions/SessionsTable.test.tsx`'s own column-
// width-budget guard — happy-dom (this test's own environment) never runs a real layout engine,
// so it cannot reproduce the `table-layout: fixed` overflow this file's own docstring just
// measured; the guard instead locks the one number that caused it (the sum of every EXPLICIT
// column width) under a ceiling, so a future width bump that revives the bug fails a fast unit
// test instead of waiting for the next real-window capture to notice.
export const COLUMNS: readonly {
  readonly key: string;
  readonly headerKey?: SessionsTableHeaderKey;
  readonly width?: string;
  readonly align?: 'right';
}[] = [
  { key: 'name', headerKey: 'sessionsTableHeaderName' },
  { key: 'id', headerKey: 'sessionsTableHeaderId', width: '80px' },
  { key: 'state', headerKey: 'sessionsTableHeaderState', width: '160px' },
  { key: 'directory', headerKey: 'sessionsTableHeaderDirectory', width: '130px' },
  { key: 'project', headerKey: 'sessionsTableHeaderProject', width: '100px' },
  { key: 'lastActivity', headerKey: 'sessionsTableHeaderLastActivity', width: '130px' },
  { key: 'action', width: '200px', align: 'right' },
];

/** The short id, copyable (`docs/INTERFACE.md` § 5's own "id curto copiável; copiar dá retorno
 * visível") — same clipboard call `renderer/legacy/session-row-view.ts`'s now-deleted
 * `renderCopyableId` used, as a real component with its own state instead of mutating a DOM node's
 * `title` by hand. **No auto-revert** (D-019 bans `setTimeout` in this renderer, `TabStrip.tsx`'s
 * own docstring already measured "no renderer exemption") — once copied, the label simply stays
 * `Copied!` for this row's own lifetime, same end state the deleted legacy version left behind (it
 * only ever changed the `title`, never reverted either).
 *
 * PO review round 1: no more `[id]` brackets (`variant="code"`'s own monospace already sets it
 * apart from the surrounding `body-sm` cells, the brackets were redundant) and no hover underline
 * on the `Copied!` state — a capture taken right after the instrumentation's own synthetic click
 * left the pointer resting on the button, so the (correct, hover-only) underline rule painted in
 * every capture of this state; simplest fix is not having one at all for this small, already-
 * visually-distinct button. */
function SessionIdCopyButton(props: {
  readonly sessionId: string;
  readonly displaySessionId: string;
}): JSX.Element {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      class={cx(styles, 'idCopyButton')}
      // `main/main.ts`'s own `SEEYA_APP_VERIFY_SESSIONS_TAB_STATES_DIR` instrumentation (V2-T68)
      // targets this attribute to click a SPECIFIC row's own copy button (the full `sessionId` is
      // stable across a push; the visible `displaySessionId` is batch-scoped and could change).
      data-session-id={props.sessionId}
      title={
        copied
          ? MESSAGES.otherSessionsSessionCopyIdCopied
          : MESSAGES.otherSessionsSessionCopyIdTitle
      }
      onClick={() => {
        // `navigator.clipboard` can be `undefined` in a stricter Electron security context — the
        // optional chain short-circuits, same as a denied permission below: neither is an error
        // the person needs to see, the id text is already right there.
        void navigator.clipboard
          ?.writeText(props.displaySessionId)
          .then(() => setCopied(true))
          .catch(() => {});
      }}
    >
      <Text as="span" variant="code" truncate>
        {copied ? MESSAGES.otherSessionsSessionCopyIdCopied : props.displaySessionId}
      </Text>
    </button>
  );
}

/** `docs/INTERFACE.md` § 5's own four action shapes: `Go to tab` (always alone), `Resume`+`Adopt…`
 * side by side (`standalone`, two independent facts about the same row, never alternatives — this
 * module's own `SessionRowAction` docstring in `state/sessions-table.ts` has the full reasoning),
 * or nothing at all (`runningElsewhere`/`projectResumePending`). */
function ActionCell(props: {
  readonly row: SessionsPanelRow;
  readonly action: SessionRowAction;
  readonly resumePending: boolean;
  readonly onRowAction: (row: SessionsPanelRow) => void;
  readonly onAdopt: (row: SessionsPanelRow) => void;
}): JSX.Element {
  const { row, action } = props;
  if (action.kind === 'goToTab') {
    return (
      <div class={cx(styles, 'actionCell')}>
        <Button
          size="sm"
          className={cx(styles, 'actionButton')}
          onClick={() => props.onRowAction(row)}
        >
          {MESSAGES.projectsActionGoToTab}
        </Button>
      </div>
    );
  }
  if (action.kind === 'runningElsewhere' || action.kind === 'projectResumePending') {
    // `projectResumePending`: retomar pelo fluxo do `open` é a V2-T77 (`docs/INTERFACE.md` § 5a) —
    // célula vazia de propósito, nunca um texto citando a tarefa. `runningElsewhere`: a sessão está
    // rodando mas não há aba desta janela para ir a ela (Q- registrada em `docs/QUESTOES.md`) —
    // nada clicável, nunca um `Resume` que abriria uma segunda cópia do que já está rodando.
    return <div class={cx(styles, 'actionCell')} />;
  }
  return (
    <div class={cx(styles, 'actionCell')}>
      <Button
        size="sm"
        variant="secondary"
        loading={props.resumePending}
        className={cx(styles, 'actionButton')}
        onClick={() => props.onRowAction(row)}
      >
        {MESSAGES.sessionsActionResume}
      </Button>
      {/* V2-T70's own `main/main.ts` verification instrumentation clicks the first
       * `[data-adopt-session-id] button` it finds — `Button.tsx`'s own `ButtonProps` is a closed
       * interface with no passthrough for an arbitrary `data-*` attribute (confirmed against a
       * real build: the attribute never reached the DOM when passed to `Button` directly), so the
       * marker lives on this wrapping `span` instead, same reasoning `SessionIdCopyButton`'s own
       * `data-session-id` already documents (a stable id survives the batch-scoped
       * `displaySessionId`). */}
      <span data-adopt-session-id={row.sessionId}>
        <Button
          size="sm"
          disabled={action.adopt.kind === 'unavailable'}
          className={cx(styles, 'actionButton')}
          // PO review round 1 (`docs/INTERFACE.md` § 5's own "dica no botão desabilitado"): `title`
          // ONLY, never `disabledReason` — that prop renders a sibling line of text IN the table
          // cell, doubling the row's height and pushing `lastActivity` out of its own column,
          // exactly the defect a real capture found. A tooltip is the dica the spec actually asks
          // for. Conditional spread, not `title={... : undefined}` — `Button.tsx`'s own
          // `title?: string` has no `| undefined` escape hatch, and this package's
          // `exactOptionalPropertyTypes` refuses a present-but-`undefined` value for it (same
          // reasoning `Button.tsx`'s own `buttonRef` conditional spread already documents).
          {...(action.adopt.kind === 'unavailable' ? { title: action.adopt.reason } : {})}
          onClick={() => props.onAdopt(row)}
        >
          {MESSAGES.adoptButton}
        </Button>
      </span>
    </div>
  );
}

function StateCell(props: { readonly row: SessionsPanelRow }): JSX.Element {
  return (
    <Text as="span" variant="body-sm" tone="secondary" truncate title={props.row.stateLabel}>
      {props.row.stateLabel}
    </Text>
  );
}

function ProjectCell(props: { readonly row: SessionsPanelRow }): JSX.Element {
  const text = props.row.projectName ?? MESSAGES.sessionsNoProject;
  return (
    <Text as="span" variant="body-sm" tone="secondary" truncate title={text}>
      {text}
    </Text>
  );
}

function DirectoryCell(props: {
  readonly row: SessionsPanelRow;
  readonly homeDir: string;
  readonly platformHint: PathPlatformHint;
}): JSX.Element {
  const text = formatDirectoryPathForDisplay(props.row.cwd, props.homeDir, props.platformHint);
  return (
    <Text as="span" variant="body-sm" tone="secondary" truncate title={props.row.cwd}>
      {text}
    </Text>
  );
}

function LastActivityCell(props: { readonly lastActivity: Date | null }): JSX.Element {
  if (props.lastActivity === null) {
    return (
      <Text
        as="span"
        variant="body-sm"
        tone="secondary"
        title={MESSAGES.sessionLastActivityUnknown}
      >
        {MESSAGES.sessionLastActivityUnknown}
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

export interface SessionsTableProps {
  readonly rows: readonly SessionsPanelRow[];
  readonly homeDir: string;
  readonly platformHint: PathPlatformHint;
  readonly isResumePending: (row: SessionsPanelRow) => boolean;
  readonly onRowAction: (row: SessionsPanelRow) => void;
  readonly onAdopt: (row: SessionsPanelRow) => void;
}

function buildRowCells(row: SessionsPanelRow, props: SessionsTableProps): readonly JSX.Element[] {
  return [
    <Text as="span" variant="body-sm" weight={500} truncate title={row.name}>
      {row.name}
    </Text>,
    <SessionIdCopyButton sessionId={row.sessionId} displaySessionId={row.displaySessionId} />,
    <StateCell row={row} />,
    <DirectoryCell row={row} homeDir={props.homeDir} platformHint={props.platformHint} />,
    <ProjectCell row={row} />,
    <LastActivityCell lastActivity={row.lastActivity} />,
    <ActionCell
      row={row}
      action={resolveSessionRowAction(row)}
      resumePending={props.isResumePending(row)}
      onRowAction={props.onRowAction}
      onAdopt={props.onAdopt}
    />,
  ];
}

export function SessionsTable(props: SessionsTableProps): JSX.Element {
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
          <TableRow key={row.sessionId} cells={buildRowCells(row, props)} />
        ))}
      </tbody>
    </table>
  );
}
