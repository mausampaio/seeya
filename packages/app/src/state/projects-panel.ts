/**
 * The "Projects" section's own view model (V2-T30 item 1) — combines `sidebar/project-sessions.ts`'s
 * grouping with each project's lock status (`@seeya-ai/engine/application/project-lock.js
 * #ProjectLockStatus`, the same read `seeya project show` uses) into what `electron/
 * project-panel-view.ts` renders. Pure: every port read (`listProjects`, `readAdoptions`,
 * `describeProjectLockStatus` per project) already happened by the time this runs — same "already
 * fetched, this module only decides what to show" split `sidebar/sidebar-data.ts` and
 * `state/status-panel.ts` already draw.
 */
import { formatLockHolderDescription } from '@seeya-ai/engine/core/project-lock-message.js';
import type { PathPlatformHint } from '@seeya-ai/engine/core/cwd-normalization.js';
import type { AdoptionRecord, ProjectManifest, SessionState } from '@seeya-ai/engine/core/types.js';
import type { ProjectLockStatus } from '@seeya-ai/engine/application/project-lock.js';
import {
  groupSessionsByProject,
  resolveAdoptEligibility,
  type AdoptEligibility,
} from '../sidebar/project-sessions.js';
import type { SidebarRow } from '../sidebar/sidebar-data.js';

export interface ProjectWithDirectory {
  readonly manifest: ProjectManifest;
  readonly dir: string;
}

export interface ProjectPanelSessionRow {
  readonly sessionId: string;
  readonly name: string;
  readonly cwd: string;
  readonly state: SessionState;
  readonly matchedTabId: string | null;
}

export interface ProjectPanelRow {
  readonly projectId: string;
  readonly name: string;
  /** Plain English, ready to render — "unlocked", "held by session X (pid N) since ...", or
   * "stale — last held by ... (reclaimable)". Never a raw `ProjectLockStatus` handed to the DOM
   * layer, same "the state module decides what to say" split every other panel here follows. */
  readonly lockText: string;
  readonly sessions: readonly ProjectPanelSessionRow[];
}

export interface ProjectPanelOtherSessionRow extends ProjectPanelSessionRow {
  readonly adopt: AdoptEligibility;
}

export interface ProjectsPanelData {
  readonly projects: readonly ProjectPanelRow[];
  readonly otherSessions: readonly ProjectPanelOtherSessionRow[];
}

function toSessionRow(row: SidebarRow): ProjectPanelSessionRow {
  return {
    sessionId: row.sessionId,
    name: row.name,
    cwd: row.cwd,
    state: row.state,
    matchedTabId: row.matchedTabId,
  };
}

function formatLockText(status: ProjectLockStatus): string {
  switch (status.kind) {
    case 'unlocked':
      return 'unlocked';
    case 'heldByLiveSession':
      return `held by ${formatLockHolderDescription(status.lock)}`;
    case 'staleLock':
      return `stale — last held by ${formatLockHolderDescription(status.lock)} (reclaimable)`;
  }
}

/** `heldByLiveSession`/`staleLock`'s own `lock.sessionId`, when known (D-025: an unidentified
 * holder — an old `.seeya-lock` written before V2-T35 item 4 — matches no session here, never a
 * guess). Feeds `groupSessionsByProject`'s own "dona do lock" evidence. */
function lockSessionIdByProjectId(
  lockStatusByProjectId: ReadonlyMap<string, ProjectLockStatus>,
): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const [projectId, status] of lockStatusByProjectId) {
    const lock =
      status.kind === 'heldByLiveSession' || status.kind === 'staleLock' ? status.lock : null;
    if (lock?.sessionId !== undefined) {
      map.set(projectId, lock.sessionId);
    }
  }
  return map;
}

/**
 * @example
 * buildProjectsPanelData(
 *   sidebarRows,
 *   [{ manifest, dir: '/seeya/workspace/auth-hardening' }],
 *   adoptions,
 *   new Map([['auth-hardening', { kind: 'unlocked' }]]),
 *   'posix',
 * )
 */
export function buildProjectsPanelData(
  rows: readonly SidebarRow[],
  projects: readonly ProjectWithDirectory[],
  adoptions: readonly AdoptionRecord[],
  lockStatusByProjectId: ReadonlyMap<string, ProjectLockStatus>,
  platform: PathPlatformHint,
): ProjectsPanelData {
  const grouping = groupSessionsByProject(
    rows,
    projects.map((project) => ({ projectId: project.manifest.id, dir: project.dir })),
    adoptions,
    lockSessionIdByProjectId(lockStatusByProjectId),
    platform,
  );
  const projectRows = projects.map((project): ProjectPanelRow => ({
    projectId: project.manifest.id,
    name: project.manifest.name,
    lockText: formatLockText(
      lockStatusByProjectId.get(project.manifest.id) ?? { kind: 'unlocked' },
    ),
    sessions: (grouping.sessionsByProjectId.get(project.manifest.id) ?? []).map(toSessionRow),
  }));
  const otherSessions = grouping.otherSessions.map((row): ProjectPanelOtherSessionRow => ({
    ...toSessionRow(row),
    adopt: resolveAdoptEligibility(row, adoptions),
  }));
  return { projects: projectRows, otherSessions };
}
