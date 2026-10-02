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
import type {
  AdoptionRecord,
  ProjectLifecycle,
  ProjectManifest,
  SessionState,
} from '@seeya-ai/engine/core/types.js';
import type { RejectedDiscoveryRecord } from '@seeya-ai/engine/core/ports.js';
import type { ProjectLockStatus } from '@seeya-ai/engine/application/project-lock.js';
import { computeDisplaySessionIds } from '@seeya-ai/engine/application/session-id-display.js';
import { summarizeErrorReason } from './error-reason-summary.js';
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

/**
 * V2-T67 (`docs/INTERFACE.md` § 4's own "lock (`Open in this window`/`Unlocked`/`Locked by
 * session <id>`) ... Ação da linha segue o lock"): the Projects tab's own lock column AND row
 * action are two readings of the exact same fact (D-024: a single source of truth, never a text
 * string and a separately-decided action that could drift apart). `openHere` wins over the raw
 * `ProjectLockStatus` — a project whose own session already has a tab open in THIS window reads
 * "Open in this window" with a `Go to tab` action, even if its `.seeya-lock` happens to be held by
 * that very session (the ordinary case) — same precedence `sidebar-summary.ts
 * #resolveProjectLockBadge` already uses for the identical fact, computed independently here
 * (D-052's "own region, own state" — touching that sidebar-only function to share this one risks
 * the unrelated lateral region this task must leave unchanged).
 *
 * A `staleLock` (the holder's process is no longer alive) reads as `unlocked` here, never a
 * fourth, more alarming lock text: `docs/INTERFACE.md` § 4 names exactly three lock texts, and
 * opening a stale-locked project already succeeds with no confirmation at all
 * (`checkProjectLock`'s own `decision: 'acquire'` for a dead holder) — showing a scarier word for
 * a fact that doesn't change what clicking the button does would mislead, not inform. Registered
 * as Q-104 (`docs/QUESTOES.md`), the spec itself is silent about this one case.
 */
export type ProjectRowLock =
  | { readonly kind: 'openHere'; readonly tabId: string }
  | { readonly kind: 'unlocked' }
  | {
      readonly kind: 'lockedByOther';
      /** V2-T55 item 5's own short-id convention (`computeDisplaySessionIds`), scoped to the
       * batch of lock holders in THIS push (never the whole sidebar's own batch) — `null` only
       * when the lock itself carries no `sessionId` at all (D-025: an unidentified holder, an old
       * `.seeya-lock` written before V2-T35 item 4, never a guessed id). */
      readonly holderDisplaySessionId: string | null;
    };

/** `docs/INTERFACE.md` § 4's own three row actions, read straight off `ProjectRowLock` by
 * `resolveProjectRowAction` below — never re-derived a second way at the render layer. */
export type ProjectRowAction =
  | { readonly kind: 'goToTab'; readonly tabId: string }
  | { readonly kind: 'open' }
  | { readonly kind: 'readOnly' }
  /** V2-T84 (`docs/INTERFACE.md` § 4b): an archived project's row never offers `Open`/`Resume` —
   * the one action is `Unarchive…`, whatever the lock says. */
  | { readonly kind: 'unarchive' };

export interface ProjectPanelRow {
  readonly projectId: string;
  readonly name: string;
  /** Plain English, ready to render — "unlocked", "held by session X (pid N) since ...", or
   * "stale — last held by ... (reclaimable)". Never a raw `ProjectLockStatus` handed to the DOM
   * layer, same "the state module decides what to say" split every other panel here follows.
   * Kept for `sidebar-summary.ts`'s own `resolveProjectLockBadge` (unchanged by this task); the
   * Projects tab itself reads `lock` below instead. */
  readonly lockText: string;
  /** V2-T67 — see this field's own type's docstring above. */
  readonly lock: ProjectRowLock;
  /** V2-T84: `ProjectManifest.lifecycle`, carried whole (D-024) — an archived project is hidden
   * from the day-to-day views (`state/projects-table.ts`, `state/sidebar-summary.ts`) but its
   * sessions stay in `sessions` (and in the Sessions tab): archiving changes visibility only. */
  readonly lifecycle: ProjectLifecycle;
  readonly sessions: readonly ProjectPanelSessionRow[];
  /** V2-T63: whether this project is starred on THIS machine
   * (`@seeya-ai/engine/core/favorite-projects.js`'s own `favorite-projects.json`, read once per
   * push by `electron/project-ipc.ts`) — drives both the star shown on this row in the Projects
   * tab and whether the project also appears in the lateral's own Favorites section
   * (`state/sidebar-summary.ts`). */
  readonly favorite: boolean;
  /** V2-T67 (`docs/INTERFACE.md` § 4's own "repositórios" column) — `ProjectManifest.repositories
   * .length`, nothing more: a repository's own existence on disk is never checked here (that
   * question belongs to `seeya project open`'s own "Repository ... no longer exists" warning, a
   * different concern). */
  readonly repositoryCount: number;
  /** V2-T67 (`docs/INTERFACE.md` § 4's own "última atividade (ordenação padrão: mais recente
   * primeiro; projeto sem atividade conhecida vai ao fim, nunca uma data inventada — D-025)") —
   * the most recent `ProjectPanelSessionRow.lastActivity` among this project's OWN sessions, the
   * same evidence-based timestamp `state/sidebar-summary.ts#buildRecentProjectRows` already reads
   * one session at a time; `null` when no session of this project carries any activity evidence
   * at all, never guessed from the manifest file's own mtime or the workspace's git history. */
  readonly lastActivity: Date | null;
}

/** V2-T67 — see `ProjectRowLock`'s own docstring for the precedence this follows. */
function resolveProjectRowLock(
  sessions: readonly ProjectPanelSessionRow[],
  status: ProjectLockStatus,
  holderDisplaySessionIds: ReadonlyMap<string, string>,
): ProjectRowLock {
  const openTab = sessions.find((session) => session.matchedTabId !== null);
  if (openTab !== undefined && openTab.matchedTabId !== null) {
    return { kind: 'openHere', tabId: openTab.matchedTabId };
  }
  if (status.kind !== 'heldByLiveSession') {
    return { kind: 'unlocked' };
  }
  const holderDisplaySessionId =
    status.lock.sessionId === undefined
      ? null
      : (holderDisplaySessionIds.get(status.lock.sessionId) ?? null);
  return { kind: 'lockedByOther', holderDisplaySessionId };
}

/**
 * @example
 * resolveProjectRowAction({ lock: { kind: 'unlocked' }, lifecycle: { kind: 'active' } })
 * // { kind: 'open' }
 */
export function resolveProjectRowAction(
  row: Pick<ProjectPanelRow, 'lock' | 'lifecycle'>,
): ProjectRowAction {
  if (row.lifecycle.kind === 'archived') {
    return { kind: 'unarchive' };
  }
  const lock = row.lock;
  switch (lock.kind) {
    case 'openHere':
      return { kind: 'goToTab', tabId: lock.tabId };
    case 'unlocked':
      return { kind: 'open' };
    case 'lockedByOther':
      return { kind: 'readOnly' };
  }
}

/** The lock column's own ready-to-render text — `docs/INTERFACE.md` § 4's exact three strings.
 *
 * @example
 * formatProjectRowLockText({ kind: 'unlocked' }) // 'Unlocked'
 */
export function formatProjectRowLockText(lock: ProjectRowLock): string {
  switch (lock.kind) {
    case 'openHere':
      return MESSAGES.projectsLockOpenHere;
    case 'unlocked':
      return MESSAGES.projectsLockUnlocked;
    case 'lockedByOther':
      return lock.holderDisplaySessionId === null
        ? MESSAGES.projectsLockLockedByUnknown
        : MESSAGES.projectsLockLockedBy(lock.holderDisplaySessionId);
  }
}

/** Every distinct `sessionId` currently holding a project's lock, across the whole push — the
 * batch `computeDisplaySessionIds` scopes its collision-safe short ids to (V2-T55 item 5's own
 * "escopando ids curtos só ao lote do resultado"). */
function collectLockHolderSessionIds(
  lockStatusByProjectId: ReadonlyMap<string, ProjectLockStatus>,
): readonly string[] {
  const ids: string[] = [];
  for (const status of lockStatusByProjectId.values()) {
    if (status.kind === 'heldByLiveSession' && status.lock.sessionId !== undefined) {
      ids.push(status.lock.sessionId);
    }
  }
  return ids;
}

/** This module's own docstring on `ProjectPanelRow.lastActivity` explains why `null` (never a
 * session with activity evidence) is the only way out of this loop. */
function mostRecentSessionActivity(sessions: readonly ProjectPanelSessionRow[]): Date | null {
  let latest: Date | null = null;
  for (const session of sessions) {
    if (session.lastActivity !== null && (latest === null || session.lastActivity > latest)) {
      latest = session.lastActivity;
    }
  }
  return latest;
}

export interface ProjectPanelOtherSessionRow extends ProjectPanelSessionRow {
  readonly adopt: AdoptEligibility;
}

/** V2-T55 item 2 — one row per directory in "Other sessions", not one per session (with many
 * Claude Code sessions on a machine, a flat list was the exact problem the maintainer hit on
 * Ubuntu). V2-T68: the directory modal this used to feed (`renderer/legacy/
 * other-sessions-dir-dialog-view.ts`, apagado) is gone — `sessions` (name, short id, state label,
 * last activity, Adopt…) now flattens straight into the Sessions tab's own table
 * (`state/sessions-panel.ts#flattenSessionsPanelRows`) instead. */
export interface OtherSessionDirectoryPanelRow {
  readonly dir: string;
  readonly sessionCount: number;
  readonly sessions: readonly ProjectPanelOtherSessionRow[];
}

/** V2-T72 item 2 — a workspace subdirectory whose `seeya.json` didn't validate
 * (`WorkspaceRepository.listProjects`'s own `rejected: RejectedDiscoveryRecord[]`, D-022's "both
 * sides"). The CLI already shows this (`cli/format-project.ts`'s own "Ignored entries:"); before
 * this task the window showed nothing at all for it — the maintainer's own "o projeto some" —
 * because `computeProjectsPanelData` only ever read `manifests`, never `rejected`.
 *
 * V2-T67 PO review round 1: `reason` is a raw `zod`/`JSON.parse` error message, often with an
 * absolute path baked in — exactly the shape `state/error-reason-summary.ts#summarizeErrorReason`
 * already exists for (moved here from `state/end-day-failure-reason.ts` by this same review, so
 * End day and this row read the identical `~`-abbreviated, length-capped line, never two
 * implementations of the same three rules). `reason` is that SHORT line; `fullReason` is the
 * untouched original, for a `title` tooltip — identical to `reason` when nothing was abbreviated
 * or truncated, so a caller never needs a second boolean to know whether a tooltip is worth
 * attaching (`reason !== fullReason`, the same convention `EndDayReasonRow` already uses). */
export interface IgnoredProjectPanelRow {
  readonly projectId: string;
  readonly reason: string;
  readonly fullReason: string;
}

export interface ProjectsPanelData {
  readonly projects: readonly ProjectPanelRow[];
  readonly otherSessionsByDirectory: readonly OtherSessionDirectoryPanelRow[];
  readonly ignoredProjects: readonly IgnoredProjectPanelRow[];
}

/** `RejectedDiscoveryRecord.file` is always `<root>/<projectId>/seeya.json`
 * (`adapters/workspace/index.ts#manifestPath`, the same path `readManifestOrRejection` builds) —
 * the second-to-last path segment is the candidate project id, whatever the id validation this
 * project id never got to run would have decided. Splits on both separators (never `node:path`,
 * to stay a pure, host-independent computation like the rest of this module) so the same test
 * exercises the same logic regardless of which OS runs it. Falls back to the raw path when it
 * doesn't have the expected shape (D-025: never invents an id it can't actually read off) — the
 * one case that can't happen from `listProjects`'s own real callers, but a test double could hand
 * this a shape the real adapter never would. */
function deriveIgnoredProjectId(manifestFilePath: string): string {
  const segments = manifestFilePath.split(/[\\/]+/).filter((segment) => segment.length > 0);
  const candidate = segments.at(-2);
  return candidate ?? manifestFilePath;
}

function toIgnoredProjectRow(
  rejection: RejectedDiscoveryRecord,
  homeDir: string,
  platform: PathPlatformHint,
): IgnoredProjectPanelRow {
  const summary = summarizeErrorReason(rejection.reason, homeDir, platform);
  return {
    projectId: deriveIgnoredProjectId(rejection.file),
    reason: summary.text,
    fullReason: summary.fullText,
  };
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
 *   [],
 *   new Set(['auth-hardening']),
 * )
 */
export function buildProjectsPanelData(
  rows: readonly SidebarRow[],
  projects: readonly ProjectWithDirectory[],
  adoptions: readonly AdoptionRecord[],
  lockStatusByProjectId: ReadonlyMap<string, ProjectLockStatus>,
  platform: PathPlatformHint,
  /** V2-T72 item 2 — `WorkspaceRepository.listProjects`'s own `rejected`, the D-022 half of the
   * result this module used to drop entirely. */
  rejected: readonly RejectedDiscoveryRecord[] = [],
  /** V2-T63 — `Storage.readFavoriteProjectIds()`'s own result, read once per push by the caller.
   * Defaults to empty so every call site that predates favorites (every test above) keeps
   * compiling and behaving exactly as before: no project favorited. */
  favoriteProjectIds: ReadonlySet<string> = new Set(),
  /** V2-T67 PO review round 1 — `AppContext.homeDir`, for abbreviating an ignored project's own
   * error message the same way `error-reason-summary.ts` already does for End day. Defaults to
   * `''`, which `summarizeErrorReason`/`collapseHomeDirectory` both treat as "never abbreviate"
   * (an empty string is never a real prefix of anything) — every call site that predates this
   * field (every test above) keeps compiling and behaving exactly as before: the raw reason,
   * unabbreviated. */
  homeDir: string = '',
): ProjectsPanelData {
  const grouping = groupSessionsByProject(
    rows,
    projects.map((project) => ({ projectId: project.manifest.id, dir: project.dir })),
    adoptions,
    lockSessionIdByProjectId(lockStatusByProjectId),
    platform,
  );
  // V2-T67: the Projects tab's own "Locked by session <id>" column — scoped to the lock holders
  // actually present in THIS push, never the whole sidebar's own batch of every discovered id.
  const holderDisplaySessionIds = computeDisplaySessionIds(
    collectLockHolderSessionIds(lockStatusByProjectId),
  );
  const projectRows = projects.map((project): ProjectPanelRow => {
    const status = lockStatusByProjectId.get(project.manifest.id) ?? { kind: 'unlocked' };
    const sessions = (grouping.sessionsByProjectId.get(project.manifest.id) ?? []).map(
      toSessionRow,
    );
    return {
      projectId: project.manifest.id,
      name: project.manifest.name,
      lockText: formatLockText(status),
      lock: resolveProjectRowLock(sessions, status, holderDisplaySessionIds),
      lifecycle: project.manifest.lifecycle,
      sessions,
      favorite: favoriteProjectIds.has(project.manifest.id),
      repositoryCount: project.manifest.repositories.length,
      lastActivity: mostRecentSessionActivity(sessions),
    };
  });
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
  return {
    projects: projectRows,
    otherSessionsByDirectory,
    ignoredProjects: rejected.map((rejection) => toIgnoredProjectRow(rejection, homeDir, platform)),
  };
}
