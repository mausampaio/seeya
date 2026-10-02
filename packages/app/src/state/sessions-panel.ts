/**
 * V2-T68 (`docs/INTERFACE.md` § 5): the Sessions tab's own flat row — every session the window
 * already knows about, project or not, in one shape, derived from `ProjectsPanelData`
 * (`state/projects-panel.ts#buildProjectsPanelData`) rather than a second session discovery of its
 * own (AGENTS.md: "nunca uma segunda descoberta de sessões no ciclo"). `ProjectsPanelData` already
 * carries every fact this tab needs twice over — once per project (`ProjectPanelRow.sessions`) and
 * once for sessions with no project (`otherSessionsByDirectory`) — this module only flattens the
 * two into one list, adding `projectId`/`projectName` (`null` for a session with no project, D-025)
 * so a single table can show both kinds of row side by side.
 */
import type { AdoptEligibility } from '../sidebar/project-sessions.js';
import type {
  ProjectPanelOtherSessionRow,
  ProjectPanelRow,
  ProjectPanelSessionRow,
  ProjectsPanelData,
} from './projects-panel.js';

export interface SessionsPanelRow extends ProjectPanelSessionRow {
  readonly projectId: string | null;
  readonly projectName: string | null;
  /** V2-T84: the session's project is archived — its project-flow `Resume` is off, with the
   * reason (`state/sessions-table.ts#resolveSessionRowAction`). `false` for a session with no
   * project (nothing to be archived). */
  readonly projectArchived: boolean;
  /** `null` exactly when `projectId` is not `null` — a session that belongs to a project is never
   * offered "Adopt…" at all (`docs/INTERFACE.md` § 5's own "Adopt… — sem projeto e elegível"), so
   * there is no eligibility to compute for it in the first place (D-025: never a guessed
   * `{ kind: 'available' }` for a row this fact doesn't apply to). */
  readonly adopt: AdoptEligibility | null;
}

function toProjectSessionRow(
  project: ProjectPanelRow,
  session: ProjectPanelSessionRow,
): SessionsPanelRow {
  return {
    ...session,
    projectId: project.projectId,
    projectName: project.name,
    projectArchived: project.lifecycle.kind === 'archived',
    adopt: null,
  };
}

function toOtherSessionRow(session: ProjectPanelOtherSessionRow): SessionsPanelRow {
  return {
    ...session,
    projectId: null,
    projectName: null,
    projectArchived: false,
    adopt: session.adopt,
  };
}

/**
 * @example
 * flattenSessionsPanelRows(panel) // every project's own sessions, then every "other" session
 */
export function flattenSessionsPanelRows(panel: ProjectsPanelData): readonly SessionsPanelRow[] {
  const projectRows = panel.projects.flatMap((project) =>
    project.sessions.map((session) => toProjectSessionRow(project, session)),
  );
  const otherRows = panel.otherSessionsByDirectory.flatMap((group) =>
    group.sessions.map(toOtherSessionRow),
  );
  return [...projectRows, ...otherRows];
}
