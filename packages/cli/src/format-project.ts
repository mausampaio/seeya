/**
 * Plain-text rendering for `seeya project create|list|show|add-repo|open` (D-028: CLI output is
 * English; AGENTS.md § "Registro e saída" — user-facing text stays concentrated here, not
 * scattered through `application/workspace.ts`/`repository-association.ts`/`project-open.ts`'s
 * own orchestration).
 */
import type { RejectedDiscoveryRecord } from '@seeya-ai/engine/core/ports.js';
import type { DiscoveredSession, ProjectManifest } from '@seeya-ai/engine/core/types.js';
import type { ProjectLockInfo } from '@seeya-ai/engine/core/project-lock.js';
import {
  formatLockHolderDescription,
  formatProjectLockWarningLines,
} from '@seeya-ai/engine/core/project-lock-message.js';
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
} from '@seeya-ai/engine/application/project-open.js';
import type { AdoptSessionResult } from '@seeya-ai/engine/application/project-adopt.js';

export { formatProjectLockWarningLines };

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

/** V2-T35 item 1: the question `open` asks, right after `formatProjectLockWarningLines`' own
 * warning, before it hands the terminal to the harness — reusing `formatLockHolderDescription` so
 * the answer names the same holder the warning just did. The holder description has no verb of its
 * own ("session <id> (pid <n>) since <time>"), so it goes after "locked by", never glued onto the
 * question — the first wording ("..., while session ...?") read as a sentence that stopped short. */
export function renderReadOnlyOpenConfirmation(heldBy: ProjectLockInfo): string {
  return (
    `Continue and open this project for reading only? ` +
    `(It stays locked by ${formatLockHolderDescription(heldBy)}.) [y/N] `
  );
}

/** Anything other than an explicit "y"/"yes" is a decline (D-025: never guess "yes" from a blank
 * or ambiguous answer) — unlike the richer pickers elsewhere in this package, there is no third
 * "invalid" state to report: a person who typed something else just as clearly meant no. */
export function parseReadOnlyOpenConfirmation(raw: string): boolean {
  const normalized = raw.trim().toLowerCase();
  return normalized === 'y' || normalized === 'yes';
}

export function formatMissingRepositoryLines(
  projectId: string,
  missing: readonly MissingRepositoryRecord[],
): string[] {
  return missing.map((entry) => formatMissingRepositoryLine(projectId, entry));
}

/** `seeya project open <id> [--with <harness>]` (V2-T28). V2-T35 item 3: the `opened` case never repeats the `missing` list (that already streamed via
 * `formatMissingRepositoryLines` before the harness launched, same as before this task) — it DOES
 * repeat the lock warning, because that one is the whole bug this task fixes: "o claude abre por
 * cima, não tem como ver." Followed by the lock's state read fresh, after the harness closed
 * (`result.finalLockStatus`, never the pre-launch `result.lock` re-described as if still current),
 * then the ordinary exit-code line. */
function formatOpenedReport(
  result: Extract<OpenProjectResult, { readonly kind: 'opened' }>,
): string {
  const repeatedWarning = formatProjectLockWarningLines(result.projectId, result.lock);
  const closedLine = `Project "${result.projectId}" closed (${result.harness} exited with code ${result.exitCode}).`;
  return [...repeatedWarning, formatLockStatusLine(result.finalLockStatus), closedLine].join('\n');
}

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
    // V2-T35 item 1: the person was asked, and either said no or had no way to answer — the
    // warning that preceded the question is still on screen (it was never covered by the
    // harness, which never launched), so neither case repeats it.
    case 'lockConfirmationDeclined':
      return (
        `Project "${result.projectId}" was not opened — you chose not to continue while it is ` +
        `locked by ${formatLockHolderDescription(result.heldBy)}.`
      );
    case 'lockConfirmationUnavailable':
      return (
        `seeya: project "${result.projectId}" is locked by ` +
        `${formatLockHolderDescription(result.heldBy)} — refusing to open without a way to ask ` +
        'for confirmation (no interactive terminal attached). Run this from a real terminal, or ' +
        'wait for the lock to be released.'
      );
    case 'opened':
      return formatOpenedReport(result);
  }
}

/** `seeya project adopt <session> <projectId>` (V2-T29) — `--session`-style resolution, same
 * message shape `end-day-command.ts#formatNoMatchMessage` already established for the identical
 * "your positional value didn't match anything discovered" case, minus the `--session` flag name
 * (this command's session argument is positional, never a flag). */
export function formatAdoptNoMatchMessage(session: string, discoveredCount: number): string {
  const discovered = `${discoveredCount} ${discoveredCount === 1 ? 'session was' : 'sessions were'}`;
  return (
    `No discovered session matches "${session}" (checked against sessionId, a sessionId prefix, ` +
    `the display name, and cwd). ${discovered} discovered in total — see "seeya sessions" to ` +
    'list them.'
  );
}

/** Same "never guess which one" rule `end-day-command.ts#formatAmbiguousMatchMessage` already
 * enforces for `--session` — adoption can create a project and take its lock, real consequences
 * exactly like `end-day --session`'s own D-002 termination, so an ambiguous match refuses here too. */
export function formatAdoptAmbiguousMatchMessage(
  session: string,
  matches: readonly DiscoveredSession[],
): string {
  const lines = [
    `"${session}" matches ${matches.length} discovered sessions — refusing to guess which one:`,
    ...matches.map((match) => `  - ${match.name} (${match.cwd}) — sessionId ${match.sessionId}`),
    'Retype the session argument with the full sessionId shown above to pick one.',
  ];
  return lines.join('\n');
}

/** V2-T29 item 4: the question `adopt` asks once the fork's interactive session has closed and
 * something inside the project actually changed — one line per changed file, same "show, then
 * ask" order the task's own spec requires ("a CLI mostra os arquivos que mudaram... e pergunta"). */
export function renderAdoptionCommitConfirmation(changedFiles: readonly string[]): string {
  const lines = [
    'The session wrote the following inside the project:',
    ...changedFiles.map((file) => `  ${file}`),
    'Commit these changes? [y/N] ',
  ];
  return lines.join('\n');
}

function formatAdoptSessionRunning(
  result: Extract<AdoptSessionResult, { readonly kind: 'sessionRunning' }>,
): string {
  return (
    `seeya: session "${result.name}" is running right now (${result.state}) — resuming it here ` +
    'would open a second copy. Wait for it to end, or capture and adopt it afterward.'
  );
}

function formatAdoptAlreadyAdopted(
  result: Extract<AdoptSessionResult, { readonly kind: 'alreadyAdopted' }>,
): string {
  return (
    `seeya: session ${result.sessionId} was already adopted into project "${result.projectId}" ` +
    `on ${result.adoptedAt.toISOString()} — refusing to adopt it a second time.`
  );
}

function formatAdoptedChangedFiles(changedFiles: readonly string[]): string {
  return changedFiles.map((file) => `  ${file}`).join('\n');
}

export function formatAdoptSessionReport(result: AdoptSessionResult): string {
  switch (result.kind) {
    case 'invalidId':
      return formatInvalidIdLine(result.projectId);
    case 'sessionRunning':
      return formatAdoptSessionRunning(result);
    case 'alreadyAdopted':
      return formatAdoptAlreadyAdopted(result);
    case 'projectLocked':
      return (
        `seeya: project "${result.projectId}" is locked by ` +
        `${formatLockHolderDescription(result.heldBy)} — refusing to adopt into it while it's ` +
        'held by another live session.'
      );
    case 'failedToStart':
      return `seeya: could not start claude to adopt session into project "${result.projectId}".`;
    case 'noChanges':
      return (
        `Project "${result.projectId}": the session (fork ${result.forkSessionId}) didn't write ` +
        'anything inside the project — nothing to commit, nothing kept.'
      );
    case 'declined':
      return (
        `Project "${result.projectId}": adoption declined — the fork (${result.forkSessionId}) ` +
        `was discarded and nothing was committed. It had written:\n` +
        formatAdoptedChangedFiles(result.changedFiles)
      );
    case 'confirmationUnavailable':
      return (
        `seeya: project "${result.projectId}" — the fork (${result.forkSessionId}) wrote changes, ` +
        'but there was no interactive terminal to confirm the commit. Nothing was committed or ' +
        'discarded; run "seeya project adopt" again from a real terminal to decide. It had ' +
        `written:\n${formatAdoptedChangedFiles(result.changedFiles)}`
      );
    case 'adopted':
      return (
        `Project "${result.projectId}": adopted. The fork (${result.forkSessionId}) is now this ` +
        `project's own session. Committed:\n${formatAdoptedChangedFiles(result.changedFiles)}`
      );
  }
}
