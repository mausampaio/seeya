/**
 * V2-T77 (`docs/INTERFACE.md` § 5a): the sessions a project's row in the Projects tab expands to
 * show — the project's own most recent sessions, never more than `PROJECT_SESSIONS_PREVIEW_LIMIT`,
 * with the full list one click away in the Sessions tab (`Show all in Sessions`).
 *
 * Ordered by last activity, newest first; a session with no known activity (D-025: `null`, never a
 * guessed instant) always sorts last. Every session a project's `open` starts has the SAME name
 * (the project directory's), so the order — and, in the row itself, the short id and the last
 * activity — is what tells them apart: this module invents no summary.
 */
import type { ProjectPanelSessionRow } from './projects-panel.js';

export const PROJECT_SESSIONS_PREVIEW_LIMIT = 5;

export interface ProjectSessionsPreview {
  readonly rows: readonly ProjectPanelSessionRow[];
  /** Every session the project has, shown or not — the link to the Sessions tab carries it. */
  readonly totalCount: number;
  readonly hiddenCount: number;
}

function compareByLastActivity(a: ProjectPanelSessionRow, b: ProjectPanelSessionRow): number {
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
 * buildProjectSessionsPreview(project.sessions).rows // at most 5, most recent first
 */
export function buildProjectSessionsPreview(
  sessions: readonly ProjectPanelSessionRow[],
  limit: number = PROJECT_SESSIONS_PREVIEW_LIMIT,
): ProjectSessionsPreview {
  const sorted = sessions.slice().sort(compareByLastActivity);
  const rows = sorted.slice(0, limit);
  return { rows, totalCount: sessions.length, hiddenCount: sessions.length - rows.length };
}
