/**
 * V2-T67 (`docs/INTERFACE.md` § 4): the Projects tab's own search/filter/sort — pure, over the
 * `ProjectPanelRow[]` `state/projects-panel.ts#buildProjectsPanelData` already produces, the same
 * "state/ decides, the component only renders" split every other panel here follows.
 */
import type { ProjectPanelRow } from './projects-panel.js';

/** `docs/INTERFACE.md` § 4's own three filters — a closed set, never a free string (D-024). */
export type ProjectsTableFilter = 'all' | 'running' | 'locked';

/** A project counts as "running" when at least one of its OWN sessions has a live process
 * (`alive`/`idle` — `unknown` means "no pid to check", never "running", D-016/D-025), the same
 * rule `state/sidebar-summary.ts#countRunningSessions` already applies. */
function hasRunningSession(row: ProjectPanelRow): boolean {
  return row.sessions.some((session) => session.state === 'alive' || session.state === 'idle');
}

function matchesFilter(row: ProjectPanelRow, filter: ProjectsTableFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'running':
      return hasRunningSession(row);
    case 'locked':
      return row.lock.kind === 'lockedByOther';
  }
}

/** Case-insensitive substring match on the project's own name — an empty (or all-whitespace)
 * query matches everything, never an empty list. */
function matchesQuery(row: ProjectPanelRow, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  return trimmed === '' || row.name.toLowerCase().includes(trimmed);
}

/** `docs/INTERFACE.md` § 4's own "ordenação padrão: mais recente primeiro; projeto sem atividade
 * conhecida vai ao fim, nunca uma data inventada" — `null` never compares as if it were an
 * instant (D-025), it is simply always last, in whatever relative order the two `null` rows
 * already had (`Array#sort` is stable since ES2019, so that order is the input order, never
 * arbitrary). */
function compareByLastActivity(a: ProjectPanelRow, b: ProjectPanelRow): number {
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
 * buildProjectsTableRows(rows, 'running', 'auth')
 * // every row whose name contains "auth" AND has a running session, most recently active first
 */
export function buildProjectsTableRows(
  rows: readonly ProjectPanelRow[],
  filter: ProjectsTableFilter,
  query: string,
): readonly ProjectPanelRow[] {
  return rows
    .filter((row) => matchesFilter(row, filter) && matchesQuery(row, query))
    .slice()
    .sort(compareByLastActivity);
}
