/**
 * The project-lock read-only-open confirmation (V2-T30 item 3) — split out of `electron/
 * project-panel-view.ts` (PO review, 2026-09-25: that file grew past the 500-line ceiling) into its
 * own single responsibility. One native `<dialog>`, the same `showModal()`/button-click/`cancel`-
 * event shape `wireFallbackDialog` already establishes in `renderer.ts`.
 */
import { MESSAGES } from '../text/messages.js';
import type {
  AnswerProjectLockOpenConfirmRequest,
  ConfirmProjectLockOpenRequestEvent,
} from '../ipc/channels.js';

/** Escape (the dialog's own "cancel" event) declines, same "closing without choosing is the safe
 * answer" default every confirmation dialog in this package follows. Wired once, at startup, from
 * `electron/project-panel-view.ts#wireProjectPanel`. */
export function wireProjectLockConfirmDialog(): void {
  const dialog = document.getElementById('project-lock-confirm-dialog') as HTMLDialogElement;
  (document.getElementById('project-lock-confirm-title') as HTMLElement).textContent =
    MESSAGES.projectLockConfirmTitle;
  const proceedButton = document.getElementById(
    'project-lock-confirm-proceed',
  ) as HTMLButtonElement;
  const declineButton = document.getElementById(
    'project-lock-confirm-decline',
  ) as HTMLButtonElement;
  proceedButton.textContent = MESSAGES.projectLockConfirmProceed;
  declineButton.textContent = MESSAGES.projectLockConfirmDecline;

  function answer(decision: 'proceed' | 'decline'): void {
    const request: AnswerProjectLockOpenConfirmRequest = {
      requestId: dialog.dataset.requestId ?? '',
      decision,
    };
    window.seeya.answerProjectLockOpenConfirm(request);
    dialog.close();
  }
  proceedButton.addEventListener('click', () => answer('proceed'));
  declineButton.addEventListener('click', () => answer('decline'));
  dialog.addEventListener('cancel', () => answer('decline'));

  window.seeya.onConfirmProjectLockOpenRequest((event: ConfirmProjectLockOpenRequestEvent) => {
    dialog.dataset.requestId = event.requestId;
    (document.getElementById('project-lock-confirm-question') as HTMLElement).textContent =
      event.questionText;
    dialog.showModal();
  });
}
