/**
 * Turns each engine outcome the "Project details" dialog can trigger (V2-T83) into what the dialog
 * shows: a tone and the CLI's own sentences (`@seeya-ai/engine/core/project-management-message.js`,
 * the same functions `seeya project add-repo|remove-repo|remove|revert-adoption` print — "o mesmo
 * texto da CLI", `docs/INTERFACE.md` § 4a). Pure; the one place a `kind` becomes a tone, so a new
 * engine outcome that nobody mapped is a compile error here (exhaustive `switch`), never a silent
 * success. D-024: the tone says what kind of fact it is — `info` is "nothing changed, and that is
 * fine" (already associated, you cancelled), never folded into `success` or `error`.
 */
import type { AddRepositoryResult } from '@seeya-ai/engine/application/repository-association.js';
import type { RemoveRepositoryResult } from '@seeya-ai/engine/application/project-remove-repo.js';
import type { RemoveProjectResult } from '@seeya-ai/engine/application/project-remove.js';
import type { RevertAdoptionResult } from '@seeya-ai/engine/application/project-revert-adoption.js';
import {
  formatAdoptedCopyOutcomeLine,
  formatInvalidProjectIdLine,
  formatNothingToRevertLine,
  formatPathNotFoundLine,
  formatProjectLockedRefusalLine,
  formatProjectNotFoundLine,
  formatProjectRemovedLine,
  formatRecoveryLine,
  formatRemovedAdoptionsLines,
  formatRepositoryAlreadyAssociatedLine,
  formatRepositoryLinkedLine,
  formatRepositoryNotAssociatedLine,
  formatRepositoryUnlinkedLine,
  formatRevertBlockedLine,
  formatRevertFailedLine,
  formatRevertedLine,
} from '@seeya-ai/engine/core/project-management-message.js';
import { MESSAGES } from '../text/messages.js';

export type ProjectActionTone = 'success' | 'info' | 'error';

export interface ProjectActionResponse {
  readonly tone: ProjectActionTone;
  readonly lines: readonly string[];
  /** True only when the project itself is gone — the dialog switches to its result state and the
   * Projects tab drops the row, instead of re-reading a project that no longer exists. */
  readonly projectRemoved: boolean;
}

function say(tone: ProjectActionTone, ...lines: readonly string[]): ProjectActionResponse {
  return { tone, lines, projectRemoved: false };
}

/**
 * @example
 * formatAddRepositoryActionResult({ kind: 'alreadyAssociated', projectId: 'p', name: 'api' })
 * // { tone: 'info', lines: ['Repository "api" is already associated with project "p".'], ... }
 */
export function formatAddRepositoryActionResult(
  result: AddRepositoryResult,
): ProjectActionResponse {
  switch (result.kind) {
    case 'invalidId':
      return say('error', formatInvalidProjectIdLine(result.projectId));
    case 'projectNotFound':
      return say('error', formatProjectNotFoundLine(result.projectId));
    case 'pathNotFound':
      return say('error', formatPathNotFoundLine(result.path));
    case 'alreadyAssociated':
      return say('info', formatRepositoryAlreadyAssociatedLine(result.name, result.projectId));
    case 'added':
      return say(
        'success',
        formatRepositoryLinkedLine(result.name, result.projectId, result.hasRemote),
      );
  }
}

export function formatRemoveRepositoryActionResult(
  result: RemoveRepositoryResult,
): ProjectActionResponse {
  switch (result.kind) {
    case 'invalidId':
      return say('error', formatInvalidProjectIdLine(result.projectId));
    case 'projectNotFound':
      return say('error', formatProjectNotFoundLine(result.projectId));
    case 'projectLocked':
      return say(
        'error',
        formatProjectLockedRefusalLine(result.projectId, result.heldBy, 'change it'),
      );
    case 'repositoryNotFound':
      return say('error', formatRepositoryNotAssociatedLine(result.name, result.projectId));
    case 'removed':
      return say('success', formatRepositoryUnlinkedLine(result.name, result.projectId));
  }
}

/** `noAdoption`/`sessionNotFound`/`ambiguousAdoption` all mean "that adoption is not registered
 * any more" here: the window passes the exact `forkSessionId` it read from `adoptions.json` a
 * moment ago, so the CLI's "retype with a longer prefix" advice never applies. `confirmationUnavailable`
 * cannot happen (the window always supplies both confirmations) but is still said, never swallowed. */
export function formatRevertAdoptionActionResult(
  result: RevertAdoptionResult,
): ProjectActionResponse {
  switch (result.kind) {
    case 'invalidId':
      return say('error', formatInvalidProjectIdLine(result.projectId));
    case 'noAdoption':
    case 'sessionNotFound':
    case 'ambiguousAdoption':
      return say('error', MESSAGES.projectDetailsAdoptionNotFound);
    case 'projectLocked':
      return say(
        'error',
        formatProjectLockedRefusalLine(result.projectId, result.heldBy, 'revert'),
      );
    case 'nothingToRevert':
      return say('info', formatNothingToRevertLine(result.projectId, result.forkSessionId));
    case 'blocked':
      return say('error', formatRevertBlockedLine(result.blockingCommit));
    case 'confirmationDeclined':
      return say(
        'info',
        `Project "${result.projectId}": revert cancelled — you chose not to continue.`,
      );
    case 'confirmationUnavailable':
      return say(
        'error',
        `Project "${result.projectId}": there was no way to ask for confirmation.`,
      );
    case 'revertFailed':
      return say('error', formatRevertFailedLine(result.failedCommit));
    case 'reverted':
      return say(
        'success',
        formatRevertedLine(
          result.projectId,
          result.revertedCommits.length,
          result.forkSessionId,
          result.originalSessionId,
        ),
        formatAdoptedCopyOutcomeLine(result.forkSessionId, result.copyOutcome),
      );
  }
}

export function formatRemoveProjectActionResult(
  result: RemoveProjectResult,
): ProjectActionResponse {
  switch (result.kind) {
    case 'invalidId':
      return say('error', formatInvalidProjectIdLine(result.projectId));
    case 'notFound':
      return say('error', formatProjectNotFoundLine(result.projectId));
    case 'projectLocked':
      return say(
        'error',
        formatProjectLockedRefusalLine(result.projectId, result.heldBy, 'remove it'),
      );
    case 'confirmationDeclined':
      return say(
        'info',
        `Project "${result.projectId}": removal cancelled — you chose not to continue.`,
      );
    case 'confirmationUnavailable':
      return say(
        'error',
        `Project "${result.projectId}": there was no way to ask for confirmation.`,
      );
    case 'removed':
      return {
        tone: 'success',
        projectRemoved: true,
        lines: [
          formatProjectRemovedLine(result.projectId, result.fileCount),
          formatRecoveryLine(result.projectId, result.previousCommit),
          ...formatRemovedAdoptionsLines(result.removedAdoptions),
        ],
      };
  }
}
