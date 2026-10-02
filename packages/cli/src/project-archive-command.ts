/**
 * `seeya project archive <id> [--note "<text>"]` / `unarchive <id>` (V2-T84, `docs/INTERFACE.md` §
 * 4b). No confirmation, like `remove-repo`: archiving is reversible by `unarchive` and the
 * workspace's own git history, and nothing is deleted. User-facing sentences come from
 * `core/project-management-message.ts`, the same words the window's dialogs show.
 */
import {
  archiveProject,
  unarchiveProject,
} from '@seeya-ai/engine/application/project-archive.js';
import type {
  ArchiveProjectDeps,
  ArchiveProjectResult,
  UnarchiveProjectResult,
} from '@seeya-ai/engine/application/project-archive.js';
import {
  formatInvalidProjectIdLine,
  formatProjectAlreadyActiveLine,
  formatProjectAlreadyArchivedLine,
  formatProjectArchivedLine,
  formatProjectLockedRefusalLine,
  formatProjectNotFoundLine,
  formatProjectUnarchivedLine,
} from '@seeya-ai/engine/core/project-management-message.js';

export function formatArchiveProjectReport(result: ArchiveProjectResult): string {
  switch (result.kind) {
    case 'invalidId':
      return formatInvalidProjectIdLine(result.projectId);
    case 'notFound':
      return formatProjectNotFoundLine(result.projectId);
    case 'locked':
      return formatProjectLockedRefusalLine(result.projectId, result.heldBy, 'archive it');
    case 'alreadyArchived':
      return formatProjectAlreadyArchivedLine(result.projectId, result.archivedAt);
    case 'archived':
      return formatProjectArchivedLine(result.projectId, result.note);
  }
}

export function formatUnarchiveProjectReport(result: UnarchiveProjectResult): string {
  switch (result.kind) {
    case 'invalidId':
      return formatInvalidProjectIdLine(result.projectId);
    case 'notFound':
      return formatProjectNotFoundLine(result.projectId);
    case 'locked':
      return formatProjectLockedRefusalLine(result.projectId, result.heldBy, 'unarchive it');
    case 'alreadyActive':
      return formatProjectAlreadyActiveLine(result.projectId);
    case 'unarchived':
      return formatProjectUnarchivedLine(result.projectId);
  }
}

export async function runProjectArchiveCommand(
  deps: ArchiveProjectDeps,
  projectId: string,
  note: string | undefined,
): Promise<string> {
  return formatArchiveProjectReport(await archiveProject(deps, projectId, note));
}

export async function runProjectUnarchiveCommand(
  deps: ArchiveProjectDeps,
  projectId: string,
): Promise<string> {
  return formatUnarchiveProjectReport(await unarchiveProject(deps, projectId));
}
