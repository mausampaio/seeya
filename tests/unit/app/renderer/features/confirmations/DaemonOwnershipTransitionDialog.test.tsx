// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, fireEvent, waitFor } from '@testing-library/preact';
import { createFakeSeeyaApi } from '../../_fake-seeya-api.js';
import { DaemonOwnershipTransitionDialog } from '../../../../../../packages/app/src/renderer/features/confirmations/DaemonOwnershipTransitionDialog/index.js';

afterEach(cleanup);

describe('DaemonOwnershipTransitionDialog (V2-T71)', () => {
  it('never opens when the offer says shouldOffer: false', async () => {
    window.seeya = createFakeSeeyaApi({
      getDaemonOwnershipTransitionOffer: vi.fn(() =>
        Promise.resolve({ shouldOffer: false, launchPath: '' }),
      ),
    });
    render(<DaemonOwnershipTransitionDialog />);
    const dialog = document.getElementById(
      'daemon-ownership-transition-dialog',
    ) as HTMLDialogElement;
    await waitFor(() => expect(dialog.open).toBe(false));
  });

  it('opens with the launch path when the offer says shouldOffer: true', async () => {
    window.seeya = createFakeSeeyaApi({
      getDaemonOwnershipTransitionOffer: vi.fn(() =>
        Promise.resolve({ shouldOffer: true, launchPath: '/opt/seeya/seeya' }),
      ),
    });
    const { getByText } = render(<DaemonOwnershipTransitionDialog />);
    const dialog = document.getElementById(
      'daemon-ownership-transition-dialog',
    ) as HTMLDialogElement;
    await waitFor(() => expect(dialog.open).toBe(true));
    expect(getByText(/\/opt\/seeya\/seeya/)).not.toBeNull();
  });

  it('accepting shows "loading" only on the Accept button, disables both, and answers accepted', async () => {
    let resolveAnswer: (() => void) | undefined;
    const answerDaemonOwnershipTransition = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveAnswer = resolve;
        }),
    );
    window.seeya = createFakeSeeyaApi({
      getDaemonOwnershipTransitionOffer: vi.fn(() =>
        Promise.resolve({ shouldOffer: true, launchPath: '/opt/seeya/seeya' }),
      ),
      answerDaemonOwnershipTransition,
    });
    render(<DaemonOwnershipTransitionDialog />);
    const dialog = document.getElementById(
      'daemon-ownership-transition-dialog',
    ) as HTMLDialogElement;
    await waitFor(() => expect(dialog.open).toBe(true));

    const acceptButton = document.getElementById(
      'daemon-ownership-transition-accept',
    ) as HTMLButtonElement;
    const declineButton = document.getElementById(
      'daemon-ownership-transition-decline',
    ) as HTMLButtonElement;
    fireEvent.click(acceptButton);

    expect(answerDaemonOwnershipTransition).toHaveBeenCalledWith({ answer: 'accepted' });
    await waitFor(() => expect(acceptButton.getAttribute('aria-busy')).toBe('true'));
    expect(declineButton.disabled).toBe(true);

    resolveAnswer?.();
    await waitFor(() => expect(dialog.open).toBe(false));
  });

  it('closing without an explicit choice (Escape) declines, so the question is never left unanswered', async () => {
    const answerDaemonOwnershipTransition = vi.fn(() => Promise.resolve());
    window.seeya = createFakeSeeyaApi({
      getDaemonOwnershipTransitionOffer: vi.fn(() =>
        Promise.resolve({ shouldOffer: true, launchPath: '/opt/seeya/seeya' }),
      ),
      answerDaemonOwnershipTransition,
    });
    render(<DaemonOwnershipTransitionDialog />);
    const dialog = document.getElementById(
      'daemon-ownership-transition-dialog',
    ) as HTMLDialogElement;
    await waitFor(() => expect(dialog.open).toBe(true));

    dialog.dispatchEvent(new Event('close'));

    expect(answerDaemonOwnershipTransition).toHaveBeenCalledWith({ answer: 'declined' });
  });
});
