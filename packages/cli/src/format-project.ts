/**
 * Plain-text rendering for `seeya project create|list|show|add-repo|open` (D-028: CLI output is
 * English; AGENTS.md § "Registro e saída" — user-facing text stays concentrated here, not
 * scattered through `application/workspace.ts`/`repository-association.ts`/`project-open.ts`'s
 * own orchestration).
 */
import type { RejectedDiscoveryRecord } from '@seeya-ai/engine/core/ports.js';
import type { ProjectManifest } from '@seeya-ai/engine/core/types.js';
import type {
  CreateProjectResult,
  ListProjectsResult,
  ShowProjectResult,
} from '@seeya-ai/engine/application/workspace.js';
import type { AddRepositoryResult } from '@seeya-ai/engine/application/repository-association.js';
import type {
  MissingRepositoryRecord,
  OpenProjectResult,
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
