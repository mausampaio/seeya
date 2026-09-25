/**
 * The window's own short "how it ended" text for `seeya project adopt`'s outcome (V2-T30 item 5) —
 * mirrors `state/project-open-result.ts`'s own reasoning: a short sentence for the dialog that
 * appears once the fork's tab closes, not `cli/format-project.ts#formatAdoptSessionReport`'s
 * multi-line terminal report (which repeats every changed file — the window shows that list
 * separately, in the commit confirmation itself, via `core/project-adoption-message.ts`).
 */
import { formatLockHolderDescription } from '@seeya-ai/engine/core/project-lock-message.js';
import type { AdoptSessionResult } from '@seeya-ai/engine/application/project-adopt.js';

/** Whether `result` is the one case the "Open project" button follows — kept here so
 * `electron/adopt-flow-view.ts` never re-derives the discriminant check on its own (D-041). */
export function isAdoptedResult(
  result: AdoptSessionResult,
): result is Extract<AdoptSessionResult, { readonly kind: 'adopted' }> {
  return result.kind === 'adopted';
}

/**
 * @example
 * formatAdoptSessionOutcomeText({ kind: 'noChanges', projectId: 'x', forkSessionId: 'y' })
 * // 'Project "x": the session didn\'t write anything inside the project — nothing to commit.'
 */
export function formatAdoptSessionOutcomeText(result: AdoptSessionResult): string {
  switch (result.kind) {
    case 'invalidId':
      return `"${result.projectId}" is not a valid project id.`;
    case 'sessionRunning':
      return (
        `seeya: session "${result.name}" is running right now (${result.state}) — resuming it ` +
        'would open a second copy.'
      );
    case 'alreadyAdopted':
      return `seeya: this session was already adopted into project "${result.projectId}".`;
    case 'launchConfirmationDeclined':
      return `Project "${result.projectId}": adoption cancelled — you chose not to continue.`;
    case 'launchConfirmationUnavailable':
      return `seeya: refusing to adopt into project "${result.projectId}" without confirmation.`;
    case 'projectLocked':
      return (
        `seeya: project "${result.projectId}" is locked by ` +
        `${formatLockHolderDescription(result.heldBy)} — refusing to adopt into it.`
      );
    case 'failedToStart':
      return `seeya: could not start claude to adopt the session into project "${result.projectId}".`;
    case 'noChanges':
      return (
        `Project "${result.projectId}": the session didn't write anything inside the project — ` +
        'nothing to commit.'
      );
    case 'declined':
      return `Project "${result.projectId}": adoption declined — the copy was discarded.`;
    case 'confirmationUnavailable':
      return (
        `seeya: project "${result.projectId}" — the copy wrote changes, but there was no way to ` +
        'confirm the commit. Nothing was committed or discarded.'
      );
    case 'adopted':
      return `Project "${result.projectId}": adopted.`;
    // V2-T34 production defect (PO review, 2026-09-25): the workspace's own git hook (or any other
    // git failure) refused the commit — the copy's files stay on disk and the fork stays
    // registered as pending, so this is recoverable, never silently discarded. `result.reason`
    // already carries git's own stderr (`adapters/workspace/index.ts#commitAll`'s own fix, same PO
    // review).
    case 'commitFailed':
      return (
        `seeya: project "${result.projectId}" — the copy wrote changes, but committing them ` +
        `failed (${result.reason}). The files are still on disk; the fork stays registered so a ` +
        'later attempt to adopt this session again finds it exactly as it was left.'
      );
  }
}

/**
 * `electron/adopt-flow-view.ts`'s own refusal when the session an "Adopt…" click named is no
 * longer in the latest discovery (D-025: aged past `relevanceHours`, or the record vanished — never
 * guessed, reported as its own outcome). Pulled out of the IPC handler (PO review, 2026-09-25) so
 * this one line of "mapeamento de resultado" has the same test coverage every other outcome text in
 * this file already gets.
 *
 * @example
 * formatSessionNotDiscoverableText('11111111-1111-4111-8111-111111111111')
 */
export function formatSessionNotDiscoverableText(sessionId: string): string {
  return `seeya: session ${sessionId} is no longer discoverable.`;
}
