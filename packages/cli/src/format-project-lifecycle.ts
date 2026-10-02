/**
 * Plain-text rendering for `seeya project create|list|show` (D-028: CLI output is English;
 * AGENTS.md § "Registro e saída" — user-facing text stays concentrated here, not scattered through
 * `application/workspace.ts`'s own orchestration).
 *
 * V2-T76: split out of the former `format-project.ts` (Q-100) — this file covers the three
 * commands that only read the workspace (never lock a project, never spawn a harness), as opposed
 * to `format-project-open.ts`/`format-project-adopt.ts`.
 */
import type { RejectedDiscoveryRecord } from '@seeya-ai/engine/core/ports.js';
import type { ProjectManifest } from '@seeya-ai/engine/core/types.js';
import type {
  CreateProjectResult,
  ListProjectsResult,
  ShowProjectResult,
} from '@seeya-ai/engine/application/workspace.js';
import { formatArchiveStateText } from '@seeya-ai/engine/core/project-management-message.js';
import {
  formatInvalidIdLine,
  formatLockStatusLine,
  formatRepositoriesSummary,
} from './format-project-shared.js';

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

function formatTrackersSummary(manifest: ProjectManifest): string {
  return manifest.trackers.length === 0
    ? 'none'
    : manifest.trackers.map((tracker) => `${tracker.type}:${tracker.project}`).join(', ');
}

/** `project show`'s own state line: `active`, or the archive date and note. */
function formatLifecycleState(manifest: ProjectManifest): string {
  const lifecycle = manifest.lifecycle;
  return lifecycle.kind === 'active'
    ? 'active'
    : formatArchiveStateText(lifecycle.archivedAt, lifecycle.note).replace('Archived', 'archived');
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
 * `cli/format-sessions.ts#formatSummaryLine` already established for `seeya sessions`. V2-T84:
 * `projectCount` is the ACTIVE projects only; archived ones are named after it, only when there
 * are any — a workspace with none archived keeps the exact pre-archiving text. */
function formatSummaryLine(
  projectCount: number,
  archivedCount: number,
  rejectedCount: number,
): string {
  const parts = [`${projectCount} project${projectCount === 1 ? '' : 's'} found`];
  if (archivedCount > 0) {
    parts.push(`${archivedCount} archived`);
  }
  if (rejectedCount > 0) {
    parts.push(`${rejectedCount} entr${rejectedCount === 1 ? 'y' : 'ies'} ignored`);
  }
  return `${parts.join(', ')}.`;
}

function formatArchivedProjectLine(manifest: ProjectManifest): string {
  const lifecycle = manifest.lifecycle;
  const state =
    lifecycle.kind === 'archived'
      ? formatArchiveStateText(lifecycle.archivedAt, lifecycle.note)
      : 'Not archived';
  return (
    `- ${manifest.id} — ${manifest.name}\n` +
    `    ${state} | repositories: ${formatRepositoriesSummary(manifest)}`
  );
}

export function formatProjectsReport(result: ListProjectsResult): string {
  const active = result.manifests.filter((manifest) => manifest.lifecycle.kind === 'active');
  const archived = result.manifests.filter((manifest) => manifest.lifecycle.kind === 'archived');
  const lines = [
    `Workspace: ${result.root}`,
    formatSummaryLine(active.length, archived.length, result.rejected.length),
  ];
  if (active.length > 0) {
    lines.push('', ...active.map(formatProjectLine));
  }
  if (archived.length > 0) {
    lines.push('', 'Archived:', ...archived.map(formatArchivedProjectLine));
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
        `  ${formatLockStatusLine(result.lockStatus)}`,
        `  state: ${formatLifecycleState(result.manifest)}`,
      ].join('\n');
  }
}
