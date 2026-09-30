/**
 * The resume-fallback confirmation dialog (V2-T4 item 3, S5-T9's "warn BEFORE, and ask" — split
 * out of the former single-file `renderer.ts` by V2-T62/D-051). Excluded from
 * `packages/app/src`'s coverage floor with everything else in `electron/` (it cannot run without
 * a display).
 */
import { MESSAGES } from '../text/messages.js';
import type { FallbackConfirmRequestEvent } from '../ipc/channels.js';

function fallbackDialog(): HTMLDialogElement {
  return document.getElementById('fallback-dialog') as HTMLDialogElement;
}

function fallbackResumeWithoutPlanButton(): HTMLButtonElement {
  return document.getElementById('fallback-dialog-resume-without-plan') as HTMLButtonElement;
}

/** Sends the person's answer and closes the dialog — the ONLY way a pending fallback question
 * ever gets answered, whether by a button click or by the dialog's own "cancel" event below.
 * `'resumeWithoutPlan'` (V2-T7) is only ever sent by a click on that button, which stays `hidden`
 * for a `resumeFailed` question (`showFallbackDialog` below) — so it's never reachable there. */
function answerFallbackDialog(
  requestId: string,
  decision: 'open' | 'resumeWithoutPlan' | 'skip',
): void {
  window.seeya.answerFallbackConfirm({ requestId, decision });
  fallbackDialog().close();
}

/**
 * V2-T4 item 3: populates and opens the dialog for one `confirmFallbackRequest` — `requestId` is
 * stashed on the element itself (`dataset`) so the button/cancel handlers wired once in
 * `wireFallbackDialog` below can find it without a second piece of state to keep in sync.
 *
 * **V2-T7 item 4: `offersResumeWithoutPlan` decides which button shows and which one takes
 * focus.** For a `promptTooLarge` reason, "Resume without the plan" is shown FIRST and focused —
 * the new default, mirroring the CLI's blank-answer default for the same reason (`core/
 * resume-fallback-decision.ts`'s own docstring); for `resumeFailed`, that button stays `hidden`
 * entirely (there is no free option to offer) and "Open a fresh session" keeps the focus it
 * always had.
 */
function showFallbackDialog(event: FallbackConfirmRequestEvent): void {
  (document.getElementById('fallback-dialog-title') as HTMLElement).textContent =
    MESSAGES.fallbackDialogTitle(event.sessionName);
  (document.getElementById('fallback-dialog-reason') as HTMLElement).textContent =
    `${event.reasonText} (${event.cwd})`;
  (document.getElementById('fallback-dialog-body') as HTMLElement).textContent =
    MESSAGES.fallbackDialogBody(event.offersResumeWithoutPlan);
  const resumeWithoutPlanButton = fallbackResumeWithoutPlanButton();
  resumeWithoutPlanButton.hidden = !event.offersResumeWithoutPlan;
  const dialog = fallbackDialog();
  dialog.dataset.requestId = event.requestId;
  dialog.showModal();
  const focusTarget = event.offersResumeWithoutPlan
    ? resumeWithoutPlanButton
    : (document.getElementById('fallback-dialog-open') as HTMLButtonElement);
  focusTarget.focus();
}

/** Wired once, at startup — the dialog element itself is reused for every fallback question, one
 * at a time (`PendingFallbackRequests`'s own docstring on the production shape this assumes). */
export function wireFallbackDialog(): void {
  const dialog = fallbackDialog();
  const resumeWithoutPlanButton = fallbackResumeWithoutPlanButton();
  resumeWithoutPlanButton.textContent = MESSAGES.fallbackDialogResumeWithoutPlan;
  resumeWithoutPlanButton.addEventListener('click', () => {
    answerFallbackDialog(dialog.dataset.requestId ?? '', 'resumeWithoutPlan');
  });
  const openButton = document.getElementById('fallback-dialog-open') as HTMLButtonElement;
  openButton.textContent = MESSAGES.fallbackDialogOpen;
  openButton.addEventListener('click', () => {
    answerFallbackDialog(dialog.dataset.requestId ?? '', 'open');
  });
  const skipButton = document.getElementById('fallback-dialog-skip') as HTMLButtonElement;
  skipButton.textContent = MESSAGES.fallbackDialogSkip;
  skipButton.addEventListener('click', () => {
    answerFallbackDialog(dialog.dataset.requestId ?? '', 'skip');
  });
  // "cancel" fires on Escape (and any other native dismissal) — V2-T4's own cuidado, "fechar sem
  // escolher = pular" for resumeFailed; V2-T7 changes the DEFAULT for promptTooLarge to "resume
  // without the plan", so closing that question without choosing must match its own new default,
  // not always "skip" — same per-reason default `core/resume-fallback-decision.ts#
  // parseFallbackAnswer('')` already applies to a blank CLI answer.
  dialog.addEventListener('cancel', () => {
    const decision = resumeWithoutPlanButton.hidden ? 'skip' : 'resumeWithoutPlan';
    answerFallbackDialog(dialog.dataset.requestId ?? '', decision);
  });
  window.seeya.onConfirmFallbackRequest((event) => showFallbackDialog(event));
}
