// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, fireEvent, waitFor } from '@testing-library/preact';
import { createFakeSeeyaApi } from '../../_fake-seeya-api.js';
import { ProjectLockConfirmDialog } from '../../../../../../packages/app/src/renderer/features/confirmations/ProjectLockConfirmDialog/index.js';
import type { ConfirmProjectLockOpenRequestEvent } from '../../../../../../packages/app/src/ipc/channels.js';

afterEach(cleanup);

function emitRequest(
  onConfirmProjectLockOpenRequest: ReturnType<typeof vi.fn>,
  event: ConfirmProjectLockOpenRequestEvent,
): void {
  const listener = onConfirmProjectLockOpenRequest.mock.calls[0]?.[0] as
    ((event: ConfirmProjectLockOpenRequestEvent) => void) | undefined;
  listener?.(event);
}

describe('ProjectLockConfirmDialog (V2-T71)', () => {
  it('is closed until a request arrives, then shows who holds the lock and since when', async () => {
    const onConfirmProjectLockOpenRequest = vi.fn();
    window.seeya = createFakeSeeyaApi({ onConfirmProjectLockOpenRequest });
    const { getByText } = render(<ProjectLockConfirmDialog />);
    const dialog = document.getElementById('project-lock-confirm-dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(false);

    emitRequest(onConfirmProjectLockOpenRequest, {
      requestId: 'req-1',
      projectId: 'auth-hardening',
      heldBySessionId: 'abc123',
      heldByPid: 456,
      heldByAcquiredAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    await waitFor(() => expect(dialog.open).toBe(true));
    expect(getByText('Project "auth-hardening" is locked')).not.toBeNull();
    expect(getByText(/Session abc123 \(pid 456\) has held this lock since/)).not.toBeNull();
  });

  it('Open read-only answers "proceed" and closes', async () => {
    const onConfirmProjectLockOpenRequest = vi.fn();
    const answerProjectLockOpenConfirm = vi.fn();
    window.seeya = createFakeSeeyaApi({
      onConfirmProjectLockOpenRequest,
      answerProjectLockOpenConfirm,
    });
    render(<ProjectLockConfirmDialog />);
    const dialog = document.getElementById('project-lock-confirm-dialog') as HTMLDialogElement;
    emitRequest(onConfirmProjectLockOpenRequest, {
      requestId: 'req-1',
      projectId: 'auth-hardening',
      heldBySessionId: null,
      heldByPid: 1,
      heldByAcquiredAt: new Date(0),
    });
    await waitFor(() => expect(dialog.open).toBe(true));

    fireEvent.click(document.getElementById('project-lock-confirm-proceed') as HTMLButtonElement);

    expect(answerProjectLockOpenConfirm).toHaveBeenCalledWith({
      requestId: 'req-1',
      decision: 'proceed',
    });
    await waitFor(() => expect(dialog.open).toBe(false));
  });

  it('Cancel answers "decline"', async () => {
    const onConfirmProjectLockOpenRequest = vi.fn();
    const answerProjectLockOpenConfirm = vi.fn();
    window.seeya = createFakeSeeyaApi({
      onConfirmProjectLockOpenRequest,
      answerProjectLockOpenConfirm,
    });
    render(<ProjectLockConfirmDialog />);
    const dialog = document.getElementById('project-lock-confirm-dialog') as HTMLDialogElement;
    emitRequest(onConfirmProjectLockOpenRequest, {
      requestId: 'req-1',
      projectId: 'auth-hardening',
      heldBySessionId: 'abc123',
      heldByPid: 1,
      heldByAcquiredAt: new Date(0),
    });
    await waitFor(() => expect(dialog.open).toBe(true));

    fireEvent.click(document.getElementById('project-lock-confirm-decline') as HTMLButtonElement);

    expect(answerProjectLockOpenConfirm).toHaveBeenCalledWith({
      requestId: 'req-1',
      decision: 'decline',
    });
    await waitFor(() => expect(dialog.open).toBe(false));
  });

  it('closing without an explicit choice (Escape) declines, the safe default', async () => {
    const onConfirmProjectLockOpenRequest = vi.fn();
    const answerProjectLockOpenConfirm = vi.fn();
    window.seeya = createFakeSeeyaApi({
      onConfirmProjectLockOpenRequest,
      answerProjectLockOpenConfirm,
    });
    render(<ProjectLockConfirmDialog />);
    const dialog = document.getElementById('project-lock-confirm-dialog') as HTMLDialogElement;
    emitRequest(onConfirmProjectLockOpenRequest, {
      requestId: 'req-1',
      projectId: 'auth-hardening',
      heldBySessionId: 'abc123',
      heldByPid: 1,
      heldByAcquiredAt: new Date(0),
    });
    await waitFor(() => expect(dialog.open).toBe(true));

    dialog.dispatchEvent(new Event('close'));

    expect(answerProjectLockOpenConfirm).toHaveBeenCalledWith({
      requestId: 'req-1',
      decision: 'decline',
    });
  });
});
