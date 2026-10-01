/**
 * The daemon-ownership transition dialog (V2-T13 item 5, D-045 item 1 — split out of the former
 * single-file `renderer.ts` by V2-T62/D-051). Excluded from `packages/app/src`'s coverage floor
 * with everything else in `electron/` (it cannot run without a display).
 */
import { MESSAGES } from '../../text/messages.js';

/**
 * V2-T13 item 5 (D-045 item 1): the ownership-transition dialog — fetched once at startup
 * (`wireDaemonOwnershipTransitionDialog`/`offerDaemonOwnershipTransitionIfNeeded` below); shown
 * only when `getDaemonOwnershipTransitionOffer` says so. Never re-checked later in this same
 * session (the answer, once given, persists on disk — `main.ts`'s own
 * `answerDaemonOwnershipTransition` handler), so this dialog has no state machine of its own
 * beyond "open" / "closed", unlike `daemon-control-view.ts`/`autostart-control-view.ts`.
 */
function daemonOwnershipTransitionDialog(): HTMLDialogElement {
  return document.getElementById('daemon-ownership-transition-dialog') as HTMLDialogElement;
}

async function answerDaemonOwnershipTransitionDialog(
  answer: 'accepted' | 'declined',
): Promise<void> {
  const dialog = daemonOwnershipTransitionDialog();
  const acceptButton = document.getElementById(
    'daemon-ownership-transition-accept',
  ) as HTMLButtonElement;
  const declineButton = document.getElementById(
    'daemon-ownership-transition-decline',
  ) as HTMLButtonElement;
  acceptButton.disabled = true;
  declineButton.disabled = true;
  (document.getElementById('daemon-ownership-transition-status') as HTMLElement).textContent =
    MESSAGES.daemonOwnershipTransitionApplying;
  await window.seeya.answerDaemonOwnershipTransition({ answer });
  dialog.close();
}

/** Fetches the offer once and opens the dialog if it says so — called once from `renderer.ts#main`,
 * after every OTHER startup wiring (the dialog itself never blocks tabs/sidebar from working). */
export async function offerDaemonOwnershipTransitionIfNeeded(): Promise<void> {
  const offer = await window.seeya.getDaemonOwnershipTransitionOffer();
  if (!offer.shouldOffer) {
    return;
  }
  (document.getElementById('daemon-ownership-transition-title') as HTMLElement).textContent =
    MESSAGES.daemonOwnershipTransitionTitle;
  (document.getElementById('daemon-ownership-transition-body') as HTMLElement).textContent =
    MESSAGES.daemonOwnershipTransitionBody(offer.launchPath);
  daemonOwnershipTransitionDialog().showModal();
}

/** Wired once, at startup. */
export function wireDaemonOwnershipTransitionDialog(): void {
  const acceptButton = document.getElementById(
    'daemon-ownership-transition-accept',
  ) as HTMLButtonElement;
  acceptButton.textContent = MESSAGES.daemonOwnershipTransitionAccept;
  acceptButton.addEventListener('click', () => {
    void answerDaemonOwnershipTransitionDialog('accepted');
  });
  const declineButton = document.getElementById(
    'daemon-ownership-transition-decline',
  ) as HTMLButtonElement;
  declineButton.textContent = MESSAGES.daemonOwnershipTransitionDecline;
  declineButton.addEventListener('click', () => {
    void answerDaemonOwnershipTransitionDialog('declined');
  });
  // "cancel" (Escape) is the same as declining — closing without an explicit choice must not
  // leave the machine's OWN question unanswered forever (it would just reopen next launch
  // otherwise, since nothing would ever get persisted).
  daemonOwnershipTransitionDialog().addEventListener('cancel', () => {
    void answerDaemonOwnershipTransitionDialog('declined');
  });
}
