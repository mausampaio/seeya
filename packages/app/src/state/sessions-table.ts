/**
 * V2-T68 (`docs/INTERFACE.md` § 5): the Sessions tab's own search/filter/sort/row-action — pure,
 * over `SessionsPanelRow[]` (`state/sessions-panel.ts`), the same "state/ decides, the component
 * only renders" split `state/projects-table.ts` already follows for the Projects tab.
 */
import {
  normalizeCwdForComparison,
  type PathPlatformHint,
} from '@seeya-ai/engine/core/cwd-normalization.js';
import type { AdoptEligibility } from '../sidebar/project-sessions.js';
import type { SessionsPanelRow } from './sessions-panel.js';

/** `docs/INTERFACE.md` § 5's own three state filters — a closed set, never a free string (D-024,
 * same discipline `ProjectsTableFilter` already follows). "Running" is `alive`/`idle` — `unknown`
 * means "no pid to check", never "running" (D-016/D-025), the same rule
 * `state/projects-table.ts#hasRunningSession` already applies per project. */
export type SessionsStateFilter = 'all' | 'running' | 'notRunning';

/** `'any'`/`'none'`, or a real `projectId` — never a bare `string | null`, so "no project chosen
 * yet" and "the 'No project' filter is chosen" stay two different, spellable states (D-024).
 * `string & {}` (not plain `string`) keeps the two literals as editor-visible options without
 * `@typescript-eslint/no-redundant-type-constituents` collapsing the union down to `string` —
 * the intersection with an empty object type is a no-op for `string` itself but stops the linter
 * from treating the literals as "already covered". */
export type SessionsProjectFilter = 'any' | 'none' | (string & {});

/** The directory filter's own value is the row's `cwd` normalized for comparison
 * (`core/cwd-normalization.ts`, the same key `sidebar/project-sessions.ts#groupOtherSessionsByDirectory`
 * already groups by) — two sessions whose `cwd` differ only by separator/case/trailing slash filter
 * as the same directory, never as two. `'any'` means no directory filter at all; see
 * `SessionsProjectFilter`'s own docstring for why this is `string & {}`, not plain `string`. */
export type SessionsDirectoryFilter = 'any' | (string & {});

export interface SessionsTableFilters {
  readonly state: SessionsStateFilter;
  readonly project: SessionsProjectFilter;
  readonly directory: SessionsDirectoryFilter;
}

export const DEFAULT_SESSIONS_TABLE_FILTERS: SessionsTableFilters = {
  state: 'all',
  project: 'any',
  directory: 'any',
};

function isRunning(row: SessionsPanelRow): boolean {
  return row.state === 'alive' || row.state === 'idle';
}

function matchesStateFilter(row: SessionsPanelRow, filter: SessionsStateFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'running':
      return isRunning(row);
    case 'notRunning':
      return !isRunning(row);
  }
}

function matchesProjectFilter(row: SessionsPanelRow, filter: SessionsProjectFilter): boolean {
  switch (filter) {
    case 'any':
      return true;
    case 'none':
      return row.projectId === null;
    default:
      return row.projectId === filter;
  }
}

function matchesDirectoryFilter(
  row: SessionsPanelRow,
  filter: SessionsDirectoryFilter,
  platform: PathPlatformHint,
): boolean {
  return filter === 'any' || normalizeCwdForComparison(row.cwd, platform) === filter;
}

/** By name (substring, case-insensitive) OR by id (prefix of the FULL `sessionId`, which
 * `displaySessionId` is always itself a prefix of — matching the full id covers both) —
 * `docs/INTERFACE.md` § 5's own "Busca por nome ou id". An empty (or all-whitespace) query matches
 * everything, never an empty list. */
function matchesQuery(row: SessionsPanelRow, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (trimmed === '') {
    return true;
  }
  return (
    row.name.toLowerCase().includes(trimmed) || row.sessionId.toLowerCase().startsWith(trimmed)
  );
}

/** `docs/INTERFACE.md` § 5's own "Ordenação padrão: última atividade mais recente primeiro" —
 * `null` never compares as if it were an instant (D-025), it is simply always last. Same shape as
 * `state/projects-table.ts#compareByLastActivity`, repeated here (not imported) because the two
 * modules decide this for structurally different row types, not because the rule itself differs. */
function compareByLastActivity(a: SessionsPanelRow, b: SessionsPanelRow): number {
  if (a.lastActivity === null && b.lastActivity === null) {
    return 0;
  }
  if (a.lastActivity === null) {
    return 1;
  }
  if (b.lastActivity === null) {
    return -1;
  }
  return b.lastActivity.getTime() - a.lastActivity.getTime();
}

/**
 * @example
 * buildSessionsTableRows(rows, DEFAULT_SESSIONS_TABLE_FILTERS, 'auth', 'posix')
 * // every row whose name contains "auth", most recently active first
 */
export function buildSessionsTableRows(
  rows: readonly SessionsPanelRow[],
  filters: SessionsTableFilters,
  query: string,
  platform: PathPlatformHint,
): readonly SessionsPanelRow[] {
  return rows
    .filter(
      (row) =>
        matchesStateFilter(row, filters.state) &&
        matchesProjectFilter(row, filters.project) &&
        matchesDirectoryFilter(row, filters.directory, platform) &&
        matchesQuery(row, query),
    )
    .slice()
    .sort(compareByLastActivity);
}

export interface SessionsProjectFilterOption {
  readonly value: string;
  readonly label: string;
}

/** One option per distinct project among `rows` — `docs/INTERFACE.md` § 5's own "projeto (`Any
 * project`, `No project`, cada projeto)"; `Any project`/`No project` are added by the caller
 * (`SessionsFilters.tsx`), this only ever lists the real ones, deduplicated and sorted by name for
 * a stable menu. */
export function buildSessionsProjectFilterOptions(
  rows: readonly SessionsPanelRow[],
): readonly SessionsProjectFilterOption[] {
  const byId = new Map<string, string>();
  for (const row of rows) {
    if (row.projectId !== null && row.projectName !== null) {
      byId.set(row.projectId, row.projectName);
    }
  }
  return [...byId.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export interface SessionsDirectoryFilterOption {
  readonly value: string;
  /** The first-seen, un-normalized spelling — display only, via `formatDirectoryPathForDisplay`
   * at the render layer (never compared again, same "display spelling vs. comparison key" split
   * `sidebar/project-sessions.ts#groupOtherSessionsByDirectory`'s own docstring already draws). */
  readonly dir: string;
}

/** One option per distinct (normalized) directory among `rows`, sorted by the display directory
 * for a stable menu — `docs/INTERFACE.md` § 5's own "diretório (`Any directory` + cada
 * diretório)". */
export function buildSessionsDirectoryFilterOptions(
  rows: readonly SessionsPanelRow[],
  platform: PathPlatformHint,
): readonly SessionsDirectoryFilterOption[] {
  const byKey = new Map<string, string>();
  for (const row of rows) {
    const key = normalizeCwdForComparison(row.cwd, platform);
    if (!byKey.has(key)) {
      byKey.set(key, row.cwd);
    }
  }
  return [...byKey.entries()]
    .map(([value, dir]) => ({ value, dir }))
    .sort((a, b) => a.dir.localeCompare(b.dir));
}

/**
 * `docs/INTERFACE.md` § 5's own four row actions, decided from the row's state alone (D-041: the
 * table never re-derives this, D-024: never flattened into a boolean/optional-field soup):
 *
 * - `goToTab` — the session is open in a tab of THIS window (`matchedTabId`).
 * - `runningElsewhere` — the spec is silent on a session that IS running (`alive`/`idle`) but has
 *   no tab here (started outside this window, or in another one) — registered as a question
 *   (`docs/QUESTOES.md`); the minimal, honest answer is no action at all: offering `Resume` would
 *   open a second copy of something already running, and there is no tab here to go to.
 * - `projectResume` — a session with no process that BELONGS to a project (V2-T77,
 *   `docs/INTERFACE.md` § 5a): `Resume` goes through the project's own `open` flow (lock, hooks,
 *   `CLAUDE.md`, questions), never the simple resume — and never offers `Adopt…`, the session is
 *   already in a project.
 * - `standalone` — no process, no project: `Resume` (always offered) and `Adopt…` (per
 *   `adopt`'s own eligibility) both apply, side by side — the two are independent facts about the
 *   same row, not alternatives.
 */
export type SessionRowAction =
  | { readonly kind: 'goToTab'; readonly tabId: string }
  | { readonly kind: 'runningElsewhere' }
  | { readonly kind: 'projectResume'; readonly projectId: string }
  /** V2-T84 (`docs/INTERFACE.md` § 4b): the same session, but its project is archived — `Resume`
   * is shown off with the reason, never a click that fails after the fact. */
  | { readonly kind: 'projectArchived'; readonly projectId: string }
  | { readonly kind: 'standalone'; readonly adopt: AdoptEligibility };

/**
 * V2-T77: what a session's PROCESS state alone allows — shared by the Sessions tab and by the
 * per-project session list in the Projects tab, so the two can never disagree about when a
 * `Resume` is offered. `resumable` means "no process at all": the caller decides which flow
 * (project `open` or the simple resume) a click goes through.
 */
export type SessionProcessAction =
  | { readonly kind: 'goToTab'; readonly tabId: string }
  | { readonly kind: 'runningElsewhere' }
  | { readonly kind: 'resumable' };

export function resolveSessionProcessAction(session: {
  readonly matchedTabId: string | null;
  readonly state: SessionsPanelRow['state'];
}): SessionProcessAction {
  if (session.matchedTabId !== null) {
    return { kind: 'goToTab', tabId: session.matchedTabId };
  }
  if (session.state === 'alive' || session.state === 'idle') {
    return { kind: 'runningElsewhere' };
  }
  return { kind: 'resumable' };
}

/**
 * @example
 * resolveSessionRowAction({ ...row, matchedTabId: 'tab-1' }) // { kind: 'goToTab', tabId: 'tab-1' }
 */
export function resolveSessionRowAction(row: SessionsPanelRow): SessionRowAction {
  const processAction = resolveSessionProcessAction(row);
  if (processAction.kind !== 'resumable') {
    return processAction;
  }
  if (row.projectId !== null) {
    return row.projectArchived
      ? { kind: 'projectArchived', projectId: row.projectId }
      : { kind: 'projectResume', projectId: row.projectId };
  }
  return { kind: 'standalone', adopt: row.adopt ?? { kind: 'available' } };
}
