/**
 * Plain-English sentences for `seeya project add-repo|remove-repo|remove|revert-adoption`
 * (V2-T83). Pure (`core/`), moved out of `packages/cli/src/format-project-{open,undo,shared}.ts`
 * for the same reason `core/project-lock-message.ts` exists: two consumers on opposite sides of the
 * layer matrix that may never import each other — the CLI prints these lines to a terminal, and the
 * window's "Project details" dialog (`docs/INTERFACE.md` § 4a) shows the SAME words ("o mesmo texto
 * da CLI"). Every function takes primitives, never an `application/` result type, because `core/`
 * cannot import `application/`; the CLI's own `format*Report` switches stay where they were and
 * only call these.
 *
 * CLI output is English (D-028), so the wording moved here byte for byte.
 */
import type { ProjectLockInfo } from './project-lock.js';
import type { AdoptedCopyGrowth } from './adopted-copy-growth.js';
import { formatLockHolderDescription } from './project-lock-message.js';

/** D-024: what happened to an adopted copy after its adoption was reverted. Moved here from
 * `application/project-revert-adoption.ts` (which re-exports it) so `formatAdoptedCopyOutcomeLine`
 * below can name it without `core/` importing `application/`. */
export type AdoptedCopyOutcome =
  | { readonly kind: 'deleted' }
  | {
      readonly kind: 'kept';
      readonly reason: 'grew' | 'unknownGrowth' | 'confirmationUnavailable';
    };

export function formatInvalidProjectIdLine(projectId: string): string {
  return (
    `seeya: "${projectId}" is not a valid project id — use lowercase letters, digits and ` +
    'hyphens only, e.g. "auth-hardening".'
  );
}

export function formatProjectNotFoundLine(projectId: string): string {
  return `Project "${projectId}" not found.`;
}

/** What the refused command was about to do, completing "refusing to ...": `remove it`,
 * `change it`, or `revert`. */
export type LockedRefusalAction = 'remove it' | 'change it' | 'revert';

export function formatProjectLockedRefusalLine(
  projectId: string,
  heldBy: ProjectLockInfo,
  action: LockedRefusalAction,
): string {
  return (
    `seeya: project "${projectId}" is locked by ${formatLockHolderDescription(heldBy)} — ` +
    `refusing to ${action} while it's held by another live session.`
  );
}

export function formatPathNotFoundLine(path: string): string {
  return `seeya: "${path}" does not exist.`;
}

export function formatRepositoryAlreadyAssociatedLine(name: string, projectId: string): string {
  return `Repository "${name}" is already associated with project "${projectId}".`;
}

export function formatRepositoryLinkedLine(
  name: string,
  projectId: string,
  hasRemote: boolean,
): string {
  const remoteNote = hasRemote
    ? ''
    : ' (no remote — only resolvable on this device, docs/V2-RUMO.md § "Repositório sem remoto")';
  return `Linked repository "${name}" to project "${projectId}"${remoteNote}.`;
}

export function formatRepositoryNotAssociatedLine(name: string, projectId: string): string {
  return `Repository "${name}" is not associated with project "${projectId}".`;
}

export function formatRepositoryUnlinkedLine(name: string, projectId: string): string {
  return `Unlinked repository "${name}" from project "${projectId}".`;
}

/** "diz em uma linha como recuperar (o commit anterior)" (V2-T32 item 1). */
export function formatRecoveryLine(projectId: string, previousCommit: string | null): string {
  if (previousCommit === null) {
    return `seeya: no previous commit was found to recover "${projectId}" from.`;
  }
  return (
    `To recover: git -C <workspace> checkout ${previousCommit} -- ${projectId} (then commit that ` +
    'restoration yourself).'
  );
}

export function formatProjectRemovedLine(projectId: string, fileCount: number): string {
  return `Project "${projectId}" removed (${fileCount} file${fileCount === 1 ? '' : 's'}).`;
}

/** Empty when the removed project had no adoption — nothing to say. */
export function formatRemovedAdoptionsLines(
  removedAdoptions: readonly {
    readonly originalSessionId: string;
    readonly forkSessionId: string;
  }[],
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

export function formatNothingToRevertLine(projectId: string, forkSessionId: string): string {
  return (
    `Project "${projectId}": the adopted session (copy ${forkSessionId}) never ` +
    'committed anything here — nothing to revert.'
  );
}

export function formatRevertBlockedLine(blockingCommit: string): string {
  return (
    `seeya: refusing to revert — commit ${blockingCommit} (from a different session) ` +
    'touched the same files afterward. Reverting would undo part of that later work too.'
  );
}

export function formatRevertFailedLine(failedCommit: string): string {
  return (
    `seeya: reverting stopped at commit ${failedCommit} — it didn't apply cleanly. ` +
    'Nothing was committed; the workspace was left as it was before this attempt.'
  );
}

/** The sentence the revert confirmation opens with, without any prompt suffix — the CLI appends
 * its own `Continue? [y/N]`, the window shows its own buttons. */
export function renderRevertAdoptionQuestionLine(
  originalSessionId: string,
  forkSessionId: string,
  commitCount: number,
): string {
  return (
    `This reverts ${commitCount} commit${commitCount === 1 ? '' : 's'} ` +
    `made by the adopted session (copy ${forkSessionId}, original ${originalSessionId}), ` +
    'newest first:'
  );
}

export function formatRevertedLine(
  projectId: string,
  revertedCount: number,
  forkSessionId: string,
  originalSessionId: string,
): string {
  return (
    `Project "${projectId}": reverted ${revertedCount} commit` +
    `${revertedCount === 1 ? '' : 's'} from the adopted session (copy ` +
    `${forkSessionId}). The original session (${originalSessionId}) can be ` +
    'adopted again.'
  );
}

export function formatAdoptedCopyOutcomeLine(
  forkSessionId: string,
  outcome: AdoptedCopyOutcome,
): string {
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

/** The first half of the "delete the adopted copy?" question — shared by the CLI (which appends
 * its own "Declining keeps it. [y/N]") and the window's dialog (which has `Keep` as the default
 * button). `growth` is never `unchanged` here: an unchanged copy is deleted without asking
 * (`application/project-revert-adoption.ts#resolveAdoptedCopy`). */
export function renderDeleteAdoptedCopyQuestionLine(info: {
  readonly forkSessionId: string;
  readonly adoptedAt: Date;
  readonly growth: Extract<AdoptedCopyGrowth, { readonly kind: 'grew' | 'unknown' }>;
}): string {
  const description =
    info.growth.kind === 'grew'
      ? `it kept writing after being adopted on ${info.adoptedAt.toISOString()} — last activity ` +
        `${info.growth.lastWrite.toISOString()}, now ${info.growth.sizeBytes} bytes`
      : "its transcript couldn't be found, so growth since adoption can't be confirmed";
  return `The adopted copy (session ${info.forkSessionId}) ${description}. Delete it anyway?`;
}
