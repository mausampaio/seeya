/**
 * Plain-text rendering for `seeya project remove|remove-repo|revert-adoption` (V2-T32, D-028: CLI
 * output is English). Split out of `format-project.ts` (AGENTS.md § "Arquivo: abaixo de 500
 * linhas") — these three commands are the "desfazer" side of `project`, distinct enough from
 * create/list/show/add-repo/open/adopt to earn their own module, the same way `project-open.ts`
 * and `project-adopt.ts` are already separate `application/` files rather than one growing one.
 */
import type { AdoptionRecord } from '@seeya-ai/engine/core/types.js';
import {
  formatAdoptedCopyOutcomeLine,
  formatNothingToRevertLine,
  formatProjectLockedRefusalLine,
  formatProjectNotFoundLine,
  formatProjectRemovedLine,
  formatRecoveryLine,
  formatRemovedAdoptionsLines,
  formatRepositoryNotAssociatedLine,
  formatRepositoryUnlinkedLine,
  formatRevertBlockedLine,
  formatRevertFailedLine,
  formatRevertedLine,
  renderDeleteAdoptedCopyQuestionLine,
  renderRevertAdoptionQuestionLine,
} from '@seeya-ai/engine/core/project-management-message.js';
import type { RemoveProjectResult } from '@seeya-ai/engine/application/project-remove.js';
import type { RemoveRepositoryResult } from '@seeya-ai/engine/application/project-remove-repo.js';
import type {
  ConfirmDeleteAdoptedCopy,
  RevertAdoptionResult,
} from '@seeya-ai/engine/application/project-revert-adoption.js';
import { parseReadOnlyOpenConfirmation } from './format-project-open.js';
import { formatInvalidIdLine } from './format-project-shared.js';

/** Reused verbatim for every y/N question in this module — blank or anything other than an
 * explicit "y"/"yes" is a decline, same convention `format-project.ts
 * #parseReadOnlyOpenConfirmation` already establishes. Re-exported under this module's own name so
 * a caller never has to remember which file first defined it. */
export const parseUndoConfirmation = parseReadOnlyOpenConfirmation;

/** Item 1: shown before `seeya project remove` does anything — the project's name and how many
 * tracked files it holds, so the person knows the size of what they're about to remove. */
export function renderRemoveProjectConfirmation(name: string, fileCount: number): string {
  return (
    `Remove project "${name}" (${fileCount} file${fileCount === 1 ? '' : 's'})? The content stays ` +
    "in the workspace's own git history — this is not a destructive delete. [y/N] "
  );
}

export function formatRemoveProjectReport(result: RemoveProjectResult): string {
  switch (result.kind) {
    case 'invalidId':
      return formatInvalidIdLine(result.projectId);
    case 'notFound':
      return formatProjectNotFoundLine(result.projectId);
    case 'projectLocked':
      return formatProjectLockedRefusalLine(result.projectId, result.heldBy, 'remove it');
    case 'confirmationDeclined':
      return `Project "${result.projectId}": removal cancelled — you chose not to continue.`;
    case 'confirmationUnavailable':
      return (
        `seeya: refusing to remove project "${result.projectId}" without a way to ask for ` +
        'confirmation (no interactive terminal attached). Run this from a real terminal.'
      );
    case 'removed':
      return [
        formatProjectRemovedLine(result.projectId, result.fileCount),
        formatRecoveryLine(result.projectId, result.previousCommit),
        ...formatRemovedAdoptionsLines(result.removedAdoptions),
      ].join('\n');
  }
}

export function formatRemoveRepositoryReport(result: RemoveRepositoryResult): string {
  switch (result.kind) {
    case 'invalidId':
      return formatInvalidIdLine(result.projectId);
    case 'projectNotFound':
      return formatProjectNotFoundLine(result.projectId);
    case 'projectLocked':
      return formatProjectLockedRefusalLine(result.projectId, result.heldBy, 'change it');
    case 'repositoryNotFound':
      return formatRepositoryNotAssociatedLine(result.name, result.projectId);
    case 'removed':
      return formatRepositoryUnlinkedLine(result.name, result.projectId);
  }
}

/** Item 3: no adoption at all in this project. */
export function formatRevertAdoptionNoAdoption(projectId: string): string {
  return `Project "${projectId}" has no adopted session to revert.`;
}

/** Item 5: the session argument was required (more than one adoption) but didn't match any. */
export function formatRevertAdoptionSessionNotFound(projectId: string, sessionRef: string): string {
  return (
    `No adoption in project "${projectId}" matches "${sessionRef}" (checked against the ` +
    "original session id, the adopted copy's own session id, and prefixes of either). Run " +
    '"seeya project show" to see the project, or retype with a longer prefix.'
  );
}

/** Item 5: more than one adoption exists and the session argument didn't narrow it to one. */
export function formatRevertAdoptionAmbiguous(
  projectId: string,
  matches: readonly AdoptionRecord[],
): string {
  const lines = [
    `Project "${projectId}" has ${matches.length} adopted sessions — refusing to guess which one:`,
    ...matches.map(
      (match) =>
        `  - original ${match.originalSessionId} → copy ${match.forkSessionId} ` +
        `(adopted ${match.adoptedAt.toISOString()})`,
    ),
    "Retype the command with a session argument (the original or the copy's own id, or a prefix " +
      'of either) to pick one.',
  ];
  return lines.join('\n');
}

/** Item 3: shown before any `git revert` runs — every commit that will be undone, newest first. */
export function renderRevertAdoptionConfirmation(
  originalSessionId: string,
  forkSessionId: string,
  commitsNewestFirst: readonly string[],
): string {
  const lines = [
    renderRevertAdoptionQuestionLine(originalSessionId, forkSessionId, commitsNewestFirst.length),
    ...commitsNewestFirst.map((hash) => `  ${hash}`),
    'Continue? [y/N] ',
  ];
  return lines.join('\n');
}

/** Item 6: shown only when the adopted copy's own transcript kept writing after `adoptedAt` (or
 * couldn't be checked at all) — the default answer is "keep" (D-047 item 6's own "resposta padrão
 * é manter"), so this reads as `[y/N]` like every other destructive confirmation in this file. */
export function renderDeleteAdoptedCopyConfirmation(
  info: Parameters<ConfirmDeleteAdoptedCopy>[0],
): string {
  const question = renderDeleteAdoptedCopyQuestionLine({
    forkSessionIdText: info.forkSessionId,
    adoptedAtText: info.adoptedAt.toISOString(),
    growth:
      info.growth.kind === 'grew'
        ? { kind: 'grew', lastWriteText: info.growth.lastWrite.toISOString() }
        : { kind: 'unknown' },
  });
  return `${question} Declining (or pressing Enter) keeps it. [y/N] `;
}

export function formatRevertAdoptionReport(result: RevertAdoptionResult): string {
  switch (result.kind) {
    case 'invalidId':
      return formatInvalidIdLine(result.projectId);
    case 'noAdoption':
      return formatRevertAdoptionNoAdoption(result.projectId);
    case 'sessionNotFound':
      return formatRevertAdoptionSessionNotFound(result.projectId, result.sessionRef);
    case 'ambiguousAdoption':
      return formatRevertAdoptionAmbiguous(result.projectId, result.matches);
    case 'projectLocked':
      return formatProjectLockedRefusalLine(result.projectId, result.heldBy, 'revert');
    case 'nothingToRevert':
      return formatNothingToRevertLine(result.projectId, result.forkSessionId);
    case 'blocked':
      return formatRevertBlockedLine(result.blockingCommit);
    case 'confirmationDeclined':
      return `Project "${result.projectId}": revert cancelled — you chose not to continue.`;
    case 'confirmationUnavailable':
      return (
        `seeya: refusing to revert the adoption in project "${result.projectId}" without a way ` +
        'to ask for confirmation (no interactive terminal attached). Run this from a real terminal.'
      );
    case 'revertFailed':
      return formatRevertFailedLine(result.failedCommit);
    case 'reverted':
      return [
        formatRevertedLine(
          result.projectId,
          result.revertedCommits.length,
          result.forkSessionId,
          result.originalSessionId,
        ),
        formatAdoptedCopyOutcomeLine(result.forkSessionId, result.copyOutcome),
      ].join('\n');
  }
}
