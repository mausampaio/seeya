// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, fireEvent, waitFor } from '@testing-library/preact';
import { createFakeSeeyaApi } from '../../_fake-seeya-api.js';
import { ResumeFallbackDialog } from '../../../../../../packages/app/src/renderer/features/confirmations/ResumeFallbackDialog/index.js';
import type { FallbackConfirmRequestEvent } from '../../../../../../packages/app/src/ipc/channels.js';

afterEach(cleanup);

function emitRequest(
  onConfirmFallbackRequest: ReturnType<typeof vi.fn>,
  event: FallbackConfirmRequestEvent,
): void {
  const listener = onConfirmFallbackRequest.mock.calls[0]?.[0] as
    ((event: FallbackConfirmRequestEvent) => void) | undefined;
  listener?.(event);
}

const RESUME_FAILED_EVENT: FallbackConfirmRequestEvent = {
  requestId: 'req-1',
  sessionName: 'auth-hardening',
  cwd: '/code/auth-hardening',
  reasonText: 'Resume failed',
  offersResumeWithoutPlan: false,
};

const PROMPT_TOO_LARGE_EVENT: FallbackConfirmRequestEvent = {
  ...RESUME_FAILED_EVENT,
  reasonText: 'Prompt too large',
  offersResumeWithoutPlan: true,
};

describe('ResumeFallbackDialog (V2-T71)', () => {
  it('shows only two cards for resumeFailed — no "Resume without the plan"', async () => {
    const onConfirmFallbackRequest = vi.fn();
    window.seeya = createFakeSeeyaApi({ onConfirmFallbackRequest });
    const { queryByText } = render(<ResumeFallbackDialog />);
    const dialog = document.getElementById('fallback-dialog') as HTMLDialogElement;
    emitRequest(onConfirmFallbackRequest, RESUME_FAILED_EVENT);
    await waitFor(() => expect(dialog.open).toBe(true));

    expect(document.getElementById('fallback-dialog-skip')).not.toBeNull();
    expect(document.getElementById('fallback-dialog-open')).not.toBeNull();
    expect(document.getElementById('fallback-dialog-resume-without-plan')).toBeNull();
    expect(queryByText('Recommended')).toBeNull();
  });

  it('shows all three cards, with "Resume without the plan" marked Recommended, for promptTooLarge', async () => {
    const onConfirmFallbackRequest = vi.fn();
    window.seeya = createFakeSeeyaApi({ onConfirmFallbackRequest });
    const { getByText } = render(<ResumeFallbackDialog />);
    const dialog = document.getElementById('fallback-dialog') as HTMLDialogElement;
    emitRequest(onConfirmFallbackRequest, PROMPT_TOO_LARGE_EVENT);
    await waitFor(() => expect(dialog.open).toBe(true));

    expect(document.getElementById('fallback-dialog-skip')).not.toBeNull();
    expect(document.getElementById('fallback-dialog-open')).not.toBeNull();
    expect(document.getElementById('fallback-dialog-resume-without-plan')).not.toBeNull();
    expect(getByText('Recommended')).not.toBeNull();
  });

  it('clicking a card answers with that decision and closes', async () => {
    const onConfirmFallbackRequest = vi.fn();
    const answerFallbackConfirm = vi.fn();
    window.seeya = createFakeSeeyaApi({ onConfirmFallbackRequest, answerFallbackConfirm });
    render(<ResumeFallbackDialog />);
    const dialog = document.getElementById('fallback-dialog') as HTMLDialogElement;
    emitRequest(onConfirmFallbackRequest, PROMPT_TOO_LARGE_EVENT);
    await waitFor(() => expect(dialog.open).toBe(true));

    fireEvent.click(
      document.getElementById('fallback-dialog-resume-without-plan') as HTMLButtonElement,
    );

    expect(answerFallbackConfirm).toHaveBeenCalledWith({
      requestId: 'req-1',
      decision: 'resumeWithoutPlan',
    });
    await waitFor(() => expect(dialog.open).toBe(false));
  });

  it('closing without a choice resumes without the plan when offered (the new default)', async () => {
    const onConfirmFallbackRequest = vi.fn();
    const answerFallbackConfirm = vi.fn();
    window.seeya = createFakeSeeyaApi({ onConfirmFallbackRequest, answerFallbackConfirm });
    render(<ResumeFallbackDialog />);
    const dialog = document.getElementById('fallback-dialog') as HTMLDialogElement;
    emitRequest(onConfirmFallbackRequest, PROMPT_TOO_LARGE_EVENT);
    await waitFor(() => expect(dialog.open).toBe(true));

    dialog.dispatchEvent(new Event('close'));

    expect(answerFallbackConfirm).toHaveBeenCalledWith({
      requestId: 'req-1',
      decision: 'resumeWithoutPlan',
    });
  });

  it('closing without a choice skips when there is no free fallback to offer', async () => {
    const onConfirmFallbackRequest = vi.fn();
    const answerFallbackConfirm = vi.fn();
    window.seeya = createFakeSeeyaApi({ onConfirmFallbackRequest, answerFallbackConfirm });
    render(<ResumeFallbackDialog />);
    const dialog = document.getElementById('fallback-dialog') as HTMLDialogElement;
    emitRequest(onConfirmFallbackRequest, RESUME_FAILED_EVENT);
    await waitFor(() => expect(dialog.open).toBe(true));

    dialog.dispatchEvent(new Event('close'));

    expect(answerFallbackConfirm).toHaveBeenCalledWith({ requestId: 'req-1', decision: 'skip' });
  });
});
