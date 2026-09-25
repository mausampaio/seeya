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
import { formatSessionStateLabel } from '@seeya-ai/engine/core/session-state-label.js';
import type { PathPlatformHint } from '@seeya-ai/engine/core/cwd-normalization.js';
import type { AdoptionRecord, ProjectManifest, SessionState } from '@seeya-ai/engine/core/types.js';
import type { ProjectLockStatus } from '@seeya-ai/engine/application/project-lock.js';
import {
  groupOtherSessionsByDirectory,
  groupSessionsByProject,
  resolveAdoptEligibility,
  type AdoptEligibility,
} from '../sidebar/project-sessions.js';
import type { SidebarRow } from '../sidebar/sidebar-data.js';
import { MESSAGES } from '../text/messages.js';

export interface ProjectWithDirectory {
  readonly manifest: ProjectManifest;
  readonly dir: string;
}

export interface ProjectPanelSessionRow {
  readonly sessionId: string;
  /** V2-T55 item 5: the same short id `seeya sessions` already shows
   * (`@seeya-ai/engine/application/session-id-display.js`) — always shown alongside the name in
   * every session listing the window has, aberta or fechada, so the id a person can paste into
   * `seeya project adopt <id>` is always visible right next to the row it identifies. */
  readonly displaySessionId: string;
  readonly name: string;
  readonly cwd: string;
  readonly state: SessionState;
  /** V2-T52: the word a person reads for `state` (`core/session-state-label.ts`) — `state` itself
   * stays the raw enum for logic (`resolveAdoptEligibility`'s own `alive`/`idle` check), this is
   * the already-formatted text the DOM layer renders instead of `state` directly. */
  readonly stateLabel: string;
  /** `null` is absence of data (D-025), never rendered as a real instant by the view layer. */
  readonly lastActivity: Date | null;
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

/** V2-T55 item 2 — one row per directory in "Other sessions", not one per session (with many
 * Claude Code sessions on a machine, a flat list was the exact problem the maintainer hit on
 * Ubuntu). Clicking a directory opens the modal (`electron/other-sessions-dir-dialog-view.ts`)
 * listing `sessions` (item 3: name, short id, state label, last activity, Adopt…). */
export interface OtherSessionDirectoryPanelRow {
  readonly dir: string;
  readonly sessionCount: number;
  readonly sessions: readonly ProjectPanelOtherSessionRow[];
}

export interface ProjectsPanelData {
  readonly projects: readonly ProjectPanelRow[];
  readonly otherSessionsByDirectory: readonly OtherSessionDirectoryPanelRow[];
}

function toSessionRow(row: SidebarRow): ProjectPanelSessionRow {
  return {
    sessionId: row.sessionId,
    displaySessionId: row.displaySessionId,
    name: row.name,
    cwd: row.cwd,
    state: row.state,
    stateLabel: formatSessionStateLabel(row.state),
    lastActivity: row.lastActivity,
    matchedTabId: row.matchedTabId,
  };
}

/** Plain English for a `ProjectLockStatus` — exported so `state/project-open-result.ts` can show
 * the SAME wording for "how it ended up" after a tab closes (never a second phrasing). */
export function formatLockText(status: ProjectLockStatus): string {
  switch (status.kind) {
    case 'unlocked':
      return 'unlocked';
    case 'heldByLiveSession':
      return `held by ${formatLockHolderDescription(status.lock)}`;
    case 'staleLock':
      return `stale — last held by ${formatLockHolderDescription(status.lock)} (reclaimable)`;
  }
}

/** V2-T55 item 3/4 — the modal's/search result's own "last activity" text, exported so both reuse
 * the identical formatting instead of each rendering `Date` differently. `null` is absence of
 * data (D-025), never a real instant; `toLocaleString()` gives a date AND time, per the task's
 * own acceptance ("data e hora"). */
export function formatSessionLastActivityText(lastActivity: Date | null): string {
  return lastActivity === null
    ? MESSAGES.sessionLastActivityUnknown
    : lastActivity.toLocaleString();
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
  const otherSessionsByDirectory = groupOtherSessionsByDirectory(
    grouping.otherSessions,
    platform,
  ).map((group): OtherSessionDirectoryPanelRow => ({
    dir: group.dir,
    sessionCount: group.sessionCount,
    sessions: group.sessions.map((row): ProjectPanelOtherSessionRow => ({
      ...toSessionRow(row),
      adopt: resolveAdoptEligibility(row, adoptions),
    })),
  }));
  return { projects: projectRows, otherSessionsByDirectory };
}
