// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, fireEvent, waitFor } from '@testing-library/preact';
import { createFakeSeeyaApi } from '../../_fake-seeya-api.js';
import { LeftoverChangesConfirmDialog } from '../../../../../../packages/app/src/renderer/features/confirmations/LeftoverChangesConfirmDialog/index.js';
import type { ConfirmLeftoverChangesOpenRequestEvent } from '../../../../../../packages/app/src/ipc/channels.js';

afterEach(cleanup);

function emitRequest(
  onConfirmLeftoverChangesOpenRequest: ReturnType<typeof vi.fn>,
  event: ConfirmLeftoverChangesOpenRequestEvent,
): void {
  const listener = onConfirmLeftoverChangesOpenRequest.mock.calls[0]?.[0] as
    ((event: ConfirmLeftoverChangesOpenRequestEvent) => void) | undefined;
  listener?.(event);
}

const SAMPLE_EVENT: ConfirmLeftoverChangesOpenRequestEvent = {
  requestId: 'req-1',
  projectId: 'auth-hardening',
  changedFiles: [
    { path: 'auth-hardening/context/know-how.md', status: 'added' },
    { path: 'auth-hardening/INDEX.md', status: 'modified' },
  ],
};

describe('LeftoverChangesConfirmDialog (V2-T71)', () => {
  it('shows the project, the file count, and every file with its status', async () => {
    const onConfirmLeftoverChangesOpenRequest = vi.fn();
    window.seeya = createFakeSeeyaApi({ onConfirmLeftoverChangesOpenRequest });
    const { getByText } = render(<LeftoverChangesConfirmDialog />);
    const dialog = document.getElementById('leftover-changes-confirm-dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(false);

    emitRequest(onConfirmLeftoverChangesOpenRequest, SAMPLE_EVENT);
    await waitFor(() => expect(dialog.open).toBe(true));

    expect(
      getByText('Project "auth-hardening" has uncommitted changes from a previous session'),
    ).not.toBeNull();
    expect(getByText('2 files changed, left uncommitted by a previous session:')).not.toBeNull();
    expect(getByText('auth-hardening/context/know-how.md')).not.toBeNull();
    expect(getByText('auth-hardening/INDEX.md')).not.toBeNull();
    expect(getByText('A')).not.toBeNull();
    expect(getByText('M')).not.toBeNull();
  });

  it('Commit now answers "commitNow" and closes', async () => {
    const onConfirmLeftoverChangesOpenRequest = vi.fn();
    const answerLeftoverChangesOpenConfirm = vi.fn();
    window.seeya = createFakeSeeyaApi({
      onConfirmLeftoverChangesOpenRequest,
      answerLeftoverChangesOpenConfirm,
    });
    render(<LeftoverChangesConfirmDialog />);
    const dialog = document.getElementById('leftover-changes-confirm-dialog') as HTMLDialogElement;
    emitRequest(onConfirmLeftoverChangesOpenRequest, SAMPLE_EVENT);
    await waitFor(() => expect(dialog.open).toBe(true));

    fireEvent.click(
      document.getElementById('leftover-changes-confirm-commit') as HTMLButtonElement,
    );

    expect(answerLeftoverChangesOpenConfirm).toHaveBeenCalledWith({
      requestId: 'req-1',
      decision: 'commitNow',
    });
    await waitFor(() => expect(dialog.open).toBe(false));
  });

  it('Continue without committing answers "proceedWithoutCommitting"', async () => {
    const onConfirmLeftoverChangesOpenRequest = vi.fn();
    const answerLeftoverChangesOpenConfirm = vi.fn();
    window.seeya = createFakeSeeyaApi({
      onConfirmLeftoverChangesOpenRequest,
      answerLeftoverChangesOpenConfirm,
    });
    render(<LeftoverChangesConfirmDialog />);
    const dialog = document.getElementById('leftover-changes-confirm-dialog') as HTMLDialogElement;
    emitRequest(onConfirmLeftoverChangesOpenRequest, SAMPLE_EVENT);
    await waitFor(() => expect(dialog.open).toBe(true));

    fireEvent.click(
      document.getElementById('leftover-changes-confirm-proceed') as HTMLButtonElement,
    );

    expect(answerLeftoverChangesOpenConfirm).toHaveBeenCalledWith({
      requestId: 'req-1',
      decision: 'proceedWithoutCommitting',
    });
  });

  it('closing without an explicit choice (Escape) proceeds without committing — never auto-commits', async () => {
    const onConfirmLeftoverChangesOpenRequest = vi.fn();
    const answerLeftoverChangesOpenConfirm = vi.fn();
    window.seeya = createFakeSeeyaApi({
      onConfirmLeftoverChangesOpenRequest,
      answerLeftoverChangesOpenConfirm,
    });
    render(<LeftoverChangesConfirmDialog />);
    const dialog = document.getElementById('leftover-changes-confirm-dialog') as HTMLDialogElement;
    emitRequest(onConfirmLeftoverChangesOpenRequest, SAMPLE_EVENT);
    await waitFor(() => expect(dialog.open).toBe(true));

    dialog.dispatchEvent(new Event('close'));

    expect(answerLeftoverChangesOpenConfirm).toHaveBeenCalledWith({
      requestId: 'req-1',
      decision: 'proceedWithoutCommitting',
    });
  });
});
