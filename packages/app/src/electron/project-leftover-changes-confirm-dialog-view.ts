/**
 * The leftover-changes open confirmation (V2-T34 production defect, PO review 2026-09-25) — the
 * window never asked this question at all before this fix. Same one-`<dialog>`,
 * `showModal()`/button-click/`cancel`-event shape `project-lock-confirm-dialog-view.ts` already
 * establishes for the sibling lock confirmation.
 *
 * Two real answers, never a boolean or a silent default (D-024/D-025): "commit now" or "proceed
 * without committing," matching `ConfirmLeftoverChanges`'s own two non-`unavailable` outcomes —
 * the third, `unavailable`, only ever happens when NO callback answers at all (the CLI running
 * without a TTY), never a real choice a person makes here.
 */
import { MESSAGES } from '../text/messages.js';
import { renderDialogLines } from './dialog-lines.js';
import type {
  AnswerLeftoverChangesOpenConfirmRequest,
  ConfirmLeftoverChangesOpenRequestEvent,
} from '../ipc/channels.js';

/** Escape (the dialog's own "cancel" event) proceeds WITHOUT committing — the same "closing
 * without an explicit choice never destroys or auto-commits anything" default every confirmation
 * dialog in this package follows (never silently discards the leftover changes themselves, which
 * stay on disk either way; only the COMMIT is the thing an escape must never trigger by accident).
 * Wired once, at startup, from `electron/project-panel-view.ts#wireProjectPanel`. */
export function wireLeftoverChangesConfirmDialog(): void {
  const dialog = document.getElementById('leftover-changes-confirm-dialog') as HTMLDialogElement;
  (document.getElementById('leftover-changes-confirm-title') as HTMLElement).textContent =
    MESSAGES.leftoverChangesConfirmTitle;
  const commitButton = document.getElementById(
    'leftover-changes-confirm-commit',
  ) as HTMLButtonElement;
  const proceedButton = document.getElementById(
    'leftover-changes-confirm-proceed',
  ) as HTMLButtonElement;
  commitButton.textContent = MESSAGES.leftoverChangesConfirmCommit;
  proceedButton.textContent = MESSAGES.leftoverChangesConfirmProceed;

  function answer(decision: 'commitNow' | 'proceedWithoutCommitting'): void {
    const request: AnswerLeftoverChangesOpenConfirmRequest = {
      requestId: dialog.dataset.requestId ?? '',
      decision,
    };
    window.seeya.answerLeftoverChangesOpenConfirm(request);
    dialog.close();
  }
  commitButton.addEventListener('click', () => answer('commitNow'));
  proceedButton.addEventListener('click', () => answer('proceedWithoutCommitting'));
  dialog.addEventListener('cancel', () => answer('proceedWithoutCommitting'));

  window.seeya.onConfirmLeftoverChangesOpenRequest(
    (event: ConfirmLeftoverChangesOpenRequestEvent) => {
      dialog.dataset.requestId = event.requestId;
      renderDialogLines('leftover-changes-confirm-lines', event.questionLines);
      dialog.showModal();
    },
  );
}
