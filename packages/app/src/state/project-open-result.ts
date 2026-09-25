/**
 * The window's own short "how it ended" text for `seeya project open`'s outcome (V2-T30 item 3:
 * "a janela mostra, curto, como ele ficou") — a SHORT sentence, not `cli/format-project.ts
 * #formatOpenProjectReport`'s multi-line terminal report (that one repeats the whole lock warning
 * and the missing-repository lines, meant for a scrollback the person can read at leisure; this one
 * is what a dialog shows right after a tab closes). Pure: `OpenProjectResult`/`ProjectLockStatus`
 * both already exist by the time this runs.
 */
import { formatLockHolderDescription } from '@seeya-ai/engine/core/project-lock-message.js';
import type { OpenProjectResult } from '@seeya-ai/engine/application/project-open.js';
import { formatLockText } from './projects-panel.js';

/**
 * @example
 * formatProjectOpenOutcomeText({ kind: 'notFound', projectId: 'auth-hardening' })
 * // 'Project "auth-hardening" not found.'
 */
export function formatProjectOpenOutcomeText(result: OpenProjectResult): string {
  switch (result.kind) {
    case 'invalidId':
      return `"${result.projectId}" is not a valid project id.`;
    case 'notFound':
      return `Project "${result.projectId}" not found.`;
    case 'noHarnessChosen':
      return `Project "${result.projectId}" has no default harness set.`;
    case 'unsupportedHarness':
      return `seeya: harness "${result.harness}" is not supported yet.`;
    case 'failedToStart':
      return `seeya: could not start ${result.harness} for project "${result.projectId}".`;
    case 'lockConfirmationDeclined':
      return (
        `Project "${result.projectId}" was not opened — you chose not to continue while it is ` +
        `locked by ${formatLockHolderDescription(result.heldBy)}.`
      );
    case 'lockConfirmationUnavailable':
      return (
        `Project "${result.projectId}" is locked by ${formatLockHolderDescription(result.heldBy)} ` +
        '— refusing to open without confirmation.'
      );
    case 'leftoverChangesConfirmationUnavailable':
      return (
        `Project "${result.projectId}" has ${result.changedFiles.length} uncommitted change(s) ` +
        'left by a previous session — refusing to open without confirmation.'
      );
    case 'opened':
      return (
        `Project "${result.projectId}" closed (exit code ${result.exitCode}). ` +
        `Lock: ${formatLockText(result.finalLockStatus)}.`
      );
  }
}
