/**
 * Plain-text rendering for `seeya project create|list|show|add-repo|open` (D-028: CLI output is
 * English; AGENTS.md § "Registro e saída" — user-facing text stays concentrated here, not
 * scattered through `application/workspace.ts`/`repository-association.ts`/`project-open.ts`'s
 * own orchestration).
 */
import type { RejectedDiscoveryRecord } from '@seeya-ai/engine/core/ports.js';
import type { ProjectManifest } from '@seeya-ai/engine/core/types.js';
import type { ProjectLockInfo } from '@seeya-ai/engine/core/project-lock.js';
import type {
  CreateProjectResult,
  ListProjectsResult,
  ProjectLockStatus,
  ShowProjectResult,
} from '@seeya-ai/engine/application/workspace.js';
import type { AddRepositoryResult } from '@seeya-ai/engine/application/repository-association.js';
import type {
  MissingRepositoryRecord,
  OpenProjectResult,
  ProjectOpenLockOutcome,
} from '@seeya-ai/engine/application/project-open.js';

function formatInvalidIdLine(projectId: string): string {
  return (
    `seeya: "${projectId}" is not a valid project id — use lowercase letters, digits and ` +
    'hyphens only, e.g. "auth-hardening".'
  );
}

export function formatCreateProjectReport(result: CreateProjectResult): string {
  switch (result.kind) {
    case 'invalidId':
      return formatInvalidIdLine(result.projectId);
    case 'alreadyExists':
      return `Project "${result.projectId}" already exists.`;
    case 'created':
      return `Created project "${result.projectId}" at ${result.root}.`;
  }
}

/** D-025: "not set", never a guessed harness name — see `core/types.ts#ProjectManifest`'s own
 * docstring on why a fresh project's `defaultHarness` starts `null`. */
function formatDefaultHarness(defaultHarness: string | null): string {
  return defaultHarness === null ? 'not set' : defaultHarness;
}

function formatRepositoriesSummary(manifest: ProjectManifest): string {
  return manifest.repositories.length === 0
    ? 'none'
    : manifest.repositories.map((repository) => repository.name).join(', ');
}

function formatTrackersSummary(manifest: ProjectManifest): string {
  return manifest.trackers.length === 0
    ? 'none'
    : manifest.trackers.map((tracker) => `${tracker.type}:${tracker.project}`).join(', ');
}

function formatProjectLine(manifest: ProjectManifest): string {
  return (
    `- ${manifest.id} — ${manifest.name}\n` +
    `    default harness: ${formatDefaultHarness(manifest.defaultHarness)} | ` +
    `repositories: ${formatRepositoriesSummary(manifest)}`
  );
}

function formatRejectedLine(rejection: RejectedDiscoveryRecord): string {
  return `  - ${rejection.file}: ${rejection.reason}`;
}

/** D-022's "both sides", sayable to a human — same shape
 * `cli/format-sessions.ts#formatSummaryLine` already established for `seeya sessions`. */
function formatSummaryLine(projectCount: number, rejectedCount: number): string {
  const projects = `${projectCount} project${projectCount === 1 ? '' : 's'} found`;
  if (rejectedCount === 0) {
    return `${projects}.`;
  }
  const entries = `${rejectedCount} entr${rejectedCount === 1 ? 'y' : 'ies'} ignored`;
  return `${projects}, ${entries}.`;
}

export function formatProjectsReport(result: ListProjectsResult): string {
  const lines = [
    `Workspace: ${result.root}`,
    formatSummaryLine(result.manifests.length, result.rejected.length),
  ];
  if (result.manifests.length > 0) {
    lines.push('', ...result.manifests.map(formatProjectLine));
  }
  if (result.rejected.length > 0) {
    lines.push('', 'Ignored entries:', ...result.rejected.map(formatRejectedLine));
  }
  return lines.join('\n');
}

/** "session &lt;id&gt;" when the lock's holder is known, "an unidentified session" otherwise (D-025:
 * `ProjectLockInfo.sessionId` is absent, not a guessed identity — see that field's own docstring).
 * Shared by `formatShowProjectReport`'s lock line and `formatProjectLockWarningLines` below. */
function formatLockHolderDescription(lock: ProjectLockInfo): string {
  const holder =
    lock.sessionId === undefined ? 'an unidentified session' : `session ${lock.sessionId}`;
  return `${holder} (pid ${lock.pid}) since ${lock.acquiredAt.toISOString()}`;
}

/** `seeya project show <id>`'s own lock line (V2-T33, D-047 item 5) — three states, matching
 * `ProjectLockStatus` (never flattened, D-024): `unlocked` says so plainly; `staleLock` still
 * names who last held it (useful diagnostic — the lock file is still ON DISK), but says clearly
 * that it's reclaimable; `heldByLiveSession` is the one that actually blocks a second `open`. */
function formatLockStatusLine(status: ProjectLockStatus): string {
  switch (status.kind) {
    case 'unlocked':
      return 'lock: none';
    case 'staleLock':
      return `lock: stale (last held by ${formatLockHolderDescription(status.lock)}) — reclaimable`;
    case 'heldByLiveSession':
      return `lock: held by ${formatLockHolderDescription(status.lock)}`;
  }
}

export function formatShowProjectReport(result: ShowProjectResult): string {
  switch (result.kind) {
    case 'invalidId':
      return formatInvalidIdLine(result.projectId);
    case 'notFound':
      return `Project "${result.projectId}" not found.`;
    case 'found':
      return [
        `Project "${result.manifest.id}" — ${result.manifest.name}`,
        `  path: ${result.root}`,
        `  default harness: ${formatDefaultHarness(result.manifest.defaultHarness)}`,
        `  repositories: ${formatRepositoriesSummary(result.manifest)}`,
        `  trackers: ${formatTrackersSummary(result.manifest)}`,
        `  ${formatLockStatusLine(result.lockStatus)}`,
      ].join('\n');
  }
}

/** `seeya project add-repo <id> <path>` (V2-T28). */
export function formatAddRepoReport(result: AddRepositoryResult): string {
  switch (result.kind) {
    case 'invalidId':
      return formatInvalidIdLine(result.projectId);
    case 'projectNotFound':
      return `Project "${result.projectId}" not found.`;
    case 'pathNotFound':
      return `seeya: "${result.path}" does not exist.`;
    case 'alreadyAssociated':
      return `Repository "${result.name}" is already associated with project "${result.projectId}".`;
    case 'added': {
      const remoteNote = result.hasRemote
        ? ''
        : ' (no remote — only resolvable on this device, docs/V2-RUMO.md § "Repositório sem remoto")';
      return `Linked repository "${result.name}" to project "${result.projectId}"${remoteNote}.`;
    }
  }
}

/** One line per `MissingRepositoryRecord` (V2-T28 item 4) — `runProjectOpenCommand` prints these
 * BEFORE the harness spawns, so the warning is visible while the person can still act on it. */
function formatMissingRepositoryLine(projectId: string, missing: MissingRepositoryRecord): string {
  if (missing.reason === 'notInDeviceMap') {
    return (
      `Repository "${missing.name}" is not registered on this device — run "seeya project ` +
      `add-repo ${projectId} <path>" to add it. Continuing without it.`
    );
  }
  return (
    `Repository "${missing.name}" was registered at "${missing.path}", but that directory no ` +
    `longer exists — run "seeya project add-repo ${projectId} <new-path>" to update it. ` +
    'Continuing without it.'
  );
}

/** `seeya project open`'s own lock warning (V2-T33, D-047 item 4) — printed BEFORE the harness
 * takes over the terminal, same "the person needs to see this while they can still act on it"
 * timing `formatMissingRepositoryLines` already gets. `acquired` with no `reclaimedStale` prints
 * nothing (the ordinary case: a genuinely free lock needs no comment); `acquired` with
 * `reclaimedStale` set names the stale lock it just took over, so a silently-abandoned lock never
 * looks like nothing happened. `readOnly` is the one that matters most: this session did NOT get
 * the lock, so it can look but "não escreve" — the guard that enforces that is V2-T34's, this is
 * only the warning half (`ProjectOpenLockOutcome`'s own docstring). */
export function formatProjectLockWarningLines(
  projectId: string,
  lock: ProjectOpenLockOutcome,
): string[] {
  if (lock.kind === 'readOnly') {
    return [
      `Project "${projectId}" is locked by ${formatLockHolderDescription(lock.heldBy)} — ` +
        'opening for reading only. Work in your own code, but changes to this project itself ' +
        'will not be recorded here until that session releases the lock.',
    ];
  }
  if (lock.reclaimedStale === null) {
    return [];
  }
  return [
    `Project "${projectId}"'s lock was stale (last held by ` +
      `${formatLockHolderDescription(lock.reclaimedStale)}) — reclaimed.`,
  ];
}

export function formatMissingRepositoryLines(
  projectId: string,
  missing: readonly MissingRepositoryRecord[],
): string[] {
  return missing.map((entry) => formatMissingRepositoryLine(projectId, entry));
}

/** `seeya project open <id> [--with <harness>]` (V2-T28). The `opened` case never repeats the
 * `missing` list — `runProjectOpenCommand` already streamed it via `formatMissingRepositoryLines`
 * before the harness launched. */
export function formatOpenProjectReport(result: OpenProjectResult): string {
  switch (result.kind) {
    case 'invalidId':
      return formatInvalidIdLine(result.projectId);
    case 'notFound':
      return `Project "${result.projectId}" not found.`;
    case 'noHarnessChosen':
      return (
        `Project "${result.projectId}" has no default harness set — pass --with <harness> ` +
        '(e.g. --with claude) to choose one for this session.'
      );
    case 'unsupportedHarness':
      return `seeya: harness "${result.harness}" is not supported yet — only "claude" is, for now.`;
    case 'failedToStart':
      return `seeya: could not start ${result.harness} for project "${result.projectId}".`;
    case 'opened':
      return `Project "${result.projectId}" closed (${result.harness} exited with code ${result.exitCode}).`;
  }
}
