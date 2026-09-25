/**
 * Plain-text rendering for `seeya project remove|remove-repo|revert-adoption` (V2-T32, D-028: CLI
 * output is English). Split out of `format-project.ts` (AGENTS.md § "Arquivo: abaixo de 500
 * linhas") — these three commands are the "desfazer" side of `project`, distinct enough from
 * create/list/show/add-repo/open/adopt to earn their own module, the same way `project-open.ts`
 * and `project-adopt.ts` are already separate `application/` files rather than one growing one.
 */
import type { AdoptionRecord } from '@seeya-ai/engine/core/types.js';
import { formatLockHolderDescription } from '@seeya-ai/engine/core/project-lock-message.js';
import type {
  RemovedAdoptionSummary,
  RemoveProjectResult,
} from '@seeya-ai/engine/application/project-remove.js';
import type { RemoveRepositoryResult } from '@seeya-ai/engine/application/project-remove-repo.js';
import type {
  AdoptedCopyOutcome,
  ConfirmDeleteAdoptedCopy,
  RevertAdoptionResult,
} from '@seeya-ai/engine/application/project-revert-adoption.js';
import { parseReadOnlyOpenConfirmation } from './format-project.js';

function formatInvalidIdLine(projectId: string): string {
  return (
    `seeya: "${projectId}" is not a valid project id — use lowercase letters, digits and ` +
    'hyphens only, e.g. "auth-hardening".'
  );
}

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

function formatRemovedAdoptionsLines(
  removedAdoptions: readonly RemovedAdoptionSummary[],
): string[] {
  if (removedAdoptions.length === 0) {
    return [];
  }
  return [
    'These adoptions were removed from adoptions.json — their original sessions can be adopted ' +
      'again; the adopted copies themselves were left untouched:',
    ...removedAdoptions.map(
      (adoption) => `  - original ${adoption.originalSessionId} (copy ${adoption.forkSessionId})`,
    ),
  ];
}

/** Item 1: "diz em uma linha como recuperar (o commit anterior)". */
function formatRecoveryLine(projectId: string, previousCommit: string | null): string {
  if (previousCommit === null) {
    return `seeya: no previous commit was found to recover "${projectId}" from.`;
  }
  return (
    `To recover: git -C <workspace> checkout ${previousCommit} -- ${projectId} (then commit that ` +
    'restoration yourself).'
  );
}

export function formatRemoveProjectReport(result: RemoveProjectResult): string {
  switch (result.kind) {
    case 'invalidId':
      return formatInvalidIdLine(result.projectId);
    case 'notFound':
      return `Project "${result.projectId}" not found.`;
    case 'projectLocked':
      return (
        `seeya: project "${result.projectId}" is locked by ` +
        `${formatLockHolderDescription(result.heldBy)} — refusing to remove it while it's held ` +
        'by another live session.'
      );
    case 'confirmationDeclined':
      return `Project "${result.projectId}": removal cancelled — you chose not to continue.`;
    case 'confirmationUnavailable':
      return (
        `seeya: refusing to remove project "${result.projectId}" without a way to ask for ` +
        'confirmation (no interactive terminal attached). Run this from a real terminal.'
      );
    case 'removed':
      return [
        `Project "${result.projectId}" removed (${result.fileCount} file` +
          `${result.fileCount === 1 ? '' : 's'}).`,
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
      return `Project "${result.projectId}" not found.`;
    case 'projectLocked':
      return (
        `seeya: project "${result.projectId}" is locked by ` +
        `${formatLockHolderDescription(result.heldBy)} — refusing to change it while it's held ` +
        'by another live session.'
      );
    case 'repositoryNotFound':
      return `Repository "${result.name}" is not associated with project "${result.projectId}".`;
    case 'removed':
      return `Unlinked repository "${result.name}" from project "${result.projectId}".`;
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
    `This reverts ${commitsNewestFirst.length} commit${commitsNewestFirst.length === 1 ? '' : 's'} ` +
      `made by the adopted session (copy ${forkSessionId}, original ${originalSessionId}), ` +
      'newest first:',
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
  const description =
    info.growth.kind === 'grew'
      ? `it kept writing after being adopted on ${info.adoptedAt.toISOString()} — last activity ` +
        `${info.growth.lastWrite.toISOString()}, now ${info.growth.sizeBytes} bytes`
      : "its transcript couldn't be found, so growth since adoption can't be confirmed";
  return (
    `The adopted copy (session ${info.forkSessionId}) ${description}. Delete it anyway? ` +
    'Declining (or pressing Enter) keeps it. [y/N] '
  );
}

function formatCopyOutcomeLine(forkSessionId: string, outcome: AdoptedCopyOutcome): string {
  if (outcome.kind === 'deleted') {
    return `The adopted copy (session ${forkSessionId}) was deleted.`;
  }
  const reason =
    outcome.reason === 'grew'
      ? 'it kept writing after being adopted, and the answer was to keep it'
      : outcome.reason === 'unknownGrowth'
        ? "its transcript couldn't be found, so it was kept rather than guessed safe to delete"
        : 'there was no interactive terminal to confirm deleting it';
  return `The adopted copy (session ${forkSessionId}) was kept — ${reason}.`;
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
      return (
        `seeya: project "${result.projectId}" is locked by ` +
        `${formatLockHolderDescription(result.heldBy)} — refusing to revert while it's held by ` +
        'another live session.'
      );
    case 'nothingToRevert':
      return (
        `Project "${result.projectId}": the adopted session (copy ${result.forkSessionId}) never ` +
        'committed anything here — nothing to revert.'
      );
    case 'blocked':
      return (
        `seeya: refusing to revert — commit ${result.blockingCommit} (from a different session) ` +
        'touched the same files afterward. Reverting would undo part of that later work too.'
      );
    case 'confirmationDeclined':
      return `Project "${result.projectId}": revert cancelled — you chose not to continue.`;
    case 'confirmationUnavailable':
      return (
        `seeya: refusing to revert the adoption in project "${result.projectId}" without a way ` +
        'to ask for confirmation (no interactive terminal attached). Run this from a real terminal.'
      );
    case 'revertFailed':
      return (
        `seeya: reverting stopped at commit ${result.failedCommit} — it didn't apply cleanly. ` +
        'Nothing was committed; the workspace was left as it was before this attempt.'
      );
    case 'reverted':
      return [
        `Project "${result.projectId}": reverted ${result.revertedCommits.length} commit` +
          `${result.revertedCommits.length === 1 ? '' : 's'} from the adopted session (copy ` +
          `${result.forkSessionId}). The original session (${result.originalSessionId}) can be ` +
          'adopted again.',
        formatCopyOutcomeLine(result.forkSessionId, result.copyOutcome),
      ].join('\n');
  }
}
