/**
 * Plain-text rendering for `seeya project create|list|show` (D-028: CLI output is English;
 * AGENTS.md § "Registro e saída" — user-facing text stays concentrated here, not scattered
 * through `application/workspace.ts`'s own orchestration).
 */
import type { RejectedDiscoveryRecord } from '@seeya-ai/engine/core/ports.js';
import type { ProjectManifest } from '@seeya-ai/engine/core/types.js';
import type {
  CreateProjectResult,
  ListProjectsResult,
  ShowProjectResult,
} from '@seeya-ai/engine/application/workspace.js';

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
