// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/preact';
import { createFakeSeeyaApi } from '../../_fake-seeya-api.js';
import {
  DeleteAdoptedCopyConfirmDialog,
  RemoveProjectConfirmDialog,
  RevertAdoptionConfirmDialog,
} from '../../../../../../packages/app/src/renderer/features/confirmations/index.js';

afterEach(cleanup);

function dialogById(id: string): HTMLDialogElement {
  return document.getElementById(id) as HTMLDialogElement;
}

describe('RevertAdoptionConfirmDialog (V2-T83, docs/INTERFACE.md § 9)', () => {
  function setup() {
    const onConfirmRevertAdoptionRequest = vi.fn();
    const answerRevertAdoptionConfirm = vi.fn();
    window.seeya = createFakeSeeyaApi({
      onConfirmRevertAdoptionRequest,
      answerRevertAdoptionConfirm,
    });
    const view = render(<RevertAdoptionConfirmDialog />);
    const emit = (commitCount: number): void => {
      const listener = onConfirmRevertAdoptionRequest.mock.calls[0]?.[0] as (
        event: unknown,
      ) => void;
      act(() =>
        listener({
          requestId: 'req-1',
          projectId: 'auth-hardening',
          originalSessionId: 'o1',
          forkSessionId: 'f1',
          commitCount,
        }),
      );
    };
    return { view, emit, answerRevertAdoptionConfirm };
  }

  it('is closed until the engine asks, then says the fact, the size, and what each option does', async () => {
    const { view, emit } = setup();
    expect(dialogById('revert-adoption-confirm-dialog').open).toBe(false);
    emit(3);
    await waitFor(() => expect(dialogById('revert-adoption-confirm-dialog').open).toBe(true));
    expect(view.getByText('Revert the adoption in "auth-hardening"?')).not.toBeNull();
    expect(view.container.querySelector('#revert-adoption-confirm-context')?.textContent).toBe(
      '3 commits will be reverted, newest first.',
    );
    expect(view.getByText(/Undoes those commits in one new commit/)).not.toBeNull();
    expect(view.getByText(/Go back without changing anything/)).not.toBeNull();
  });

  it('a single commit reads in the singular', async () => {
    const { view, emit } = setup();
    emit(1);
    await waitFor(() =>
      expect(view.container.querySelector('#revert-adoption-confirm-context')?.textContent).toBe(
        '1 commit will be reverted, newest first.',
      ),
    );
  });

  it('Revert answers "proceed" and closes; Cancel and Escape answer "decline"', async () => {
    const first = setup();
    first.emit(2);
    await waitFor(() => expect(dialogById('revert-adoption-confirm-dialog').open).toBe(true));
    fireEvent.click(document.getElementById('revert-adoption-confirm-proceed')!);
    expect(first.answerRevertAdoptionConfirm).toHaveBeenCalledWith({
      requestId: 'req-1',
      decision: 'proceed',
    });
    await waitFor(() => expect(dialogById('revert-adoption-confirm-dialog').open).toBe(false));
    cleanup();

    const second = setup();
    second.emit(2);
    await waitFor(() => expect(dialogById('revert-adoption-confirm-dialog').open).toBe(true));
    fireEvent.click(document.getElementById('revert-adoption-confirm-decline')!);
    expect(second.answerRevertAdoptionConfirm).toHaveBeenCalledWith({
      requestId: 'req-1',
      decision: 'decline',
    });
    cleanup();

    const third = setup();
    third.emit(2);
    await waitFor(() => expect(dialogById('revert-adoption-confirm-dialog').open).toBe(true));
    dialogById('revert-adoption-confirm-dialog').dispatchEvent(new Event('close'));
    expect(third.answerRevertAdoptionConfirm).toHaveBeenCalledWith({
      requestId: 'req-1',
      decision: 'decline',
    });
  });
});

describe('DeleteAdoptedCopyConfirmDialog (V2-T83)', () => {
  function setup() {
    const onConfirmDeleteAdoptedCopyRequest = vi.fn();
    const answerDeleteAdoptedCopyConfirm = vi.fn();
    window.seeya = createFakeSeeyaApi({
      onConfirmDeleteAdoptedCopyRequest,
      answerDeleteAdoptedCopyConfirm,
    });
    const view = render(<DeleteAdoptedCopyConfirmDialog />);
    const emit = (): void => {
      const listener = onConfirmDeleteAdoptedCopyRequest.mock.calls[0]?.[0] as (
        event: unknown,
      ) => void;
      act(() =>
        listener({
          requestId: 'req-2',
          projectId: 'auth-hardening',
          forkSessionId: 'f1',
          question: 'The adopted copy (session f1) kept writing. Delete it anyway?',
        }),
      );
    };
    return { view, emit, answerDeleteAdoptedCopyConfirm };
  }

  it('shows the engine question and explains both options, Keep being the primary', async () => {
    const { view, emit } = setup();
    emit();
    await waitFor(() => expect(dialogById('delete-adopted-copy-confirm-dialog').open).toBe(true));
    expect(view.container.querySelector('#delete-adopted-copy-confirm-context')?.textContent).toBe(
      'The adopted copy (session f1) kept writing. Delete it anyway?',
    );
    expect(view.getByText(/This is the default/)).not.toBeNull();
    // Keep is the last button of the footer: the primary, on the right.
    const buttons = Array.from(
      dialogById('delete-adopted-copy-confirm-dialog').querySelectorAll('button'),
    );
    expect(buttons[buttons.length - 1]?.id).toBe('delete-adopted-copy-confirm-keep');
  });

  it('Keep answers "keep", Delete copy answers "delete", Escape keeps (the safe default)', async () => {
    const first = setup();
    first.emit();
    await waitFor(() => expect(dialogById('delete-adopted-copy-confirm-dialog').open).toBe(true));
    fireEvent.click(document.getElementById('delete-adopted-copy-confirm-keep')!);
    expect(first.answerDeleteAdoptedCopyConfirm).toHaveBeenCalledWith({
      requestId: 'req-2',
      decision: 'keep',
    });
    cleanup();

    const second = setup();
    second.emit();
    await waitFor(() => expect(dialogById('delete-adopted-copy-confirm-dialog').open).toBe(true));
    fireEvent.click(document.getElementById('delete-adopted-copy-confirm-delete')!);
    expect(second.answerDeleteAdoptedCopyConfirm).toHaveBeenCalledWith({
      requestId: 'req-2',
      decision: 'delete',
    });
    cleanup();

    const third = setup();
    third.emit();
    await waitFor(() => expect(dialogById('delete-adopted-copy-confirm-dialog').open).toBe(true));
    dialogById('delete-adopted-copy-confirm-dialog').dispatchEvent(new Event('close'));
    expect(third.answerDeleteAdoptedCopyConfirm).toHaveBeenCalledWith({
      requestId: 'req-2',
      decision: 'keep',
    });
  });
});

describe('RemoveProjectConfirmDialog (V2-T83)', () => {
  function setup() {
    const onConfirmRemoveProjectRequest = vi.fn();
    const answerRemoveProjectConfirm = vi.fn();
    window.seeya = createFakeSeeyaApi({
      onConfirmRemoveProjectRequest,
      answerRemoveProjectConfirm,
    });
    const view = render(<RemoveProjectConfirmDialog />);
    const emit = (fileCount: number): void => {
      const listener = onConfirmRemoveProjectRequest.mock.calls[0]?.[0] as (event: unknown) => void;
      act(() =>
        listener({
          requestId: 'req-3',
          projectId: 'auth-hardening',
          name: 'Auth hardening',
          fileCount,
        }),
      );
    };
    return { view, emit, answerRemoveProjectConfirm };
  }

  it('names the project, counts the files and says what is NOT deleted', async () => {
    const { view, emit } = setup();
    emit(12);
    await waitFor(() => expect(dialogById('remove-project-confirm-dialog').open).toBe(true));
    expect(view.getByText('Remove project "Auth hardening"?')).not.toBeNull();
    expect(view.container.querySelector('#remove-project-confirm-context')?.textContent).toBe(
      '12 files will leave the workspace.',
    );
    expect(view.container.querySelector('#remove-project-confirm-not-deleted')?.textContent).toBe(
      'Not deleted: the associated repositories, your sessions and their transcripts.',
    );
    expect(view.getByText(/The commit before it stays in the workspace history/)).not.toBeNull();
  });

  it('one file reads in the singular; the proceed button is error-toned and last (primary, right)', async () => {
    const { view, emit } = setup();
    emit(1);
    await waitFor(() =>
      expect(view.container.querySelector('#remove-project-confirm-context')?.textContent).toBe(
        '1 file will leave the workspace.',
      ),
    );
    const buttons = Array.from(
      dialogById('remove-project-confirm-dialog').querySelectorAll('button'),
    );
    const last = buttons[buttons.length - 1] as HTMLButtonElement;
    expect(last.id).toBe('remove-project-confirm-proceed');
    expect(last.className).toMatch(/toneError/);
  });

  it('Remove project answers "proceed"; Cancel and Escape answer "decline"', async () => {
    const first = setup();
    first.emit(2);
    await waitFor(() => expect(dialogById('remove-project-confirm-dialog').open).toBe(true));
    fireEvent.click(document.getElementById('remove-project-confirm-proceed')!);
    expect(first.answerRemoveProjectConfirm).toHaveBeenCalledWith({
      requestId: 'req-3',
      decision: 'proceed',
    });
    await waitFor(() => expect(dialogById('remove-project-confirm-dialog').open).toBe(false));
    cleanup();

    const second = setup();
    second.emit(2);
    await waitFor(() => expect(dialogById('remove-project-confirm-dialog').open).toBe(true));
    fireEvent.click(document.getElementById('remove-project-confirm-decline')!);
    expect(second.answerRemoveProjectConfirm).toHaveBeenCalledWith({
      requestId: 'req-3',
      decision: 'decline',
    });
    cleanup();

    const third = setup();
    third.emit(2);
    await waitFor(() => expect(dialogById('remove-project-confirm-dialog').open).toBe(true));
    dialogById('remove-project-confirm-dialog').dispatchEvent(new Event('close'));
    expect(third.answerRemoveProjectConfirm).toHaveBeenCalledWith({
      requestId: 'req-3',
      decision: 'decline',
    });
  });
});
