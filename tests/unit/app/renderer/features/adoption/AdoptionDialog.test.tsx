// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/preact';
import { createFakeSeeyaApi } from '../../_fake-seeya-api.js';
import { AdoptionDialog } from '../../../../../../packages/app/src/renderer/features/adoption/index.js';
import {
  openAdoptionDialog,
  resetAdoptPanelStateForTests,
} from '../../../../../../packages/app/src/renderer/features/adoption/adoption-dialog-bridge.js';

const SESSION = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  name: 'Payments investigation',
  displaySessionId: '11111111',
  cwd: '/code/payments',
  state: 'ended' as const,
  stateLabel: 'ended',
};

afterEach(cleanup);
beforeEach(() => {
  resetAdoptPanelStateForTests();
});

function getDialog(): HTMLDialogElement {
  return document.getElementById('adoption-dialog') as HTMLDialogElement;
}

describe('AdoptionDialog (V2-T70)', () => {
  it('is closed until openAdoptionDialog() is called', () => {
    window.seeya = createFakeSeeyaApi();
    render(<AdoptionDialog />);
    expect(getDialog().open).toBe(false);
  });

  it('opens with the session card and defaults to Existing project', async () => {
    window.seeya = createFakeSeeyaApi({
      previewAdoptionLaunch: vi.fn(() => Promise.resolve({ explanationLines: [] })),
    });
    const { getByText } = render(<AdoptionDialog />);
    openAdoptionDialog(SESSION);
    await waitFor(() => expect(getDialog().open).toBe(true));

    expect(getByText('Payments investigation')).not.toBeNull();
    expect(getByText('[11111111]')).not.toBeNull();
    // No projects exist in this fixture's own cache — the empty-list message shows instead of a
    // `<select>` with no options.
    expect(getByText('No projects yet — type a new project id below.')).not.toBeNull();
  });

  it('typing an invalid new project id shows the inline error on submit, never calls adoptSession', async () => {
    const adoptSession = vi.fn();
    window.seeya = createFakeSeeyaApi({
      adoptSession,
      previewAdoptionLaunch: vi.fn(() => Promise.resolve({ explanationLines: [] })),
    });
    const { getByText } = render(<AdoptionDialog />);
    openAdoptionDialog(SESSION);
    await waitFor(() => expect(getDialog().open).toBe(true));

    fireEvent.click(document.getElementById('adoption-pick-new-option') as HTMLButtonElement);
    const input = document.getElementById('adoption-pick-new-project-id-input') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'Invalid ID!' } });
    fireEvent.click(document.getElementById('adoption-pick-submit-button') as HTMLButtonElement);

    await waitFor(() =>
      expect(
        getByText('Use lowercase letters, digits and hyphens — for example payments-webhooks.'),
      ).not.toBeNull(),
    );
    expect(adoptSession).not.toHaveBeenCalled();
  });

  it('shows the live explanation preview as a valid new project id is typed', async () => {
    const previewAdoptionLaunch = vi.fn(() =>
      Promise.resolve({ explanationLines: ['The copy will open in /code/payments.'] }),
    );
    window.seeya = createFakeSeeyaApi({ previewAdoptionLaunch });
    const { getByText } = render(<AdoptionDialog />);
    openAdoptionDialog(SESSION);
    await waitFor(() => expect(getDialog().open).toBe(true));

    fireEvent.click(document.getElementById('adoption-pick-new-option') as HTMLButtonElement);
    const input = document.getElementById('adoption-pick-new-project-id-input') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'auth-hardening' } });

    await waitFor(() =>
      expect(previewAdoptionLaunch).toHaveBeenCalledWith({
        originalCwd: '/code/payments',
        projectId: 'auth-hardening',
      }),
    );
    await waitFor(() =>
      expect(getByText(/The copy will open in \/code\/payments\./)).not.toBeNull(),
    );
  });

  it('cancel never calls adoptSession and closes the dialog', async () => {
    const adoptSession = vi.fn();
    window.seeya = createFakeSeeyaApi({ adoptSession });
    render(<AdoptionDialog />);
    openAdoptionDialog(SESSION);
    await waitFor(() => expect(getDialog().open).toBe(true));

    fireEvent.click(document.getElementById('adoption-pick-cancel-button') as HTMLButtonElement);
    await waitFor(() => expect(getDialog().open).toBe(false));
    expect(adoptSession).not.toHaveBeenCalled();
  });

  it('submitting closes the dialog (the fork runs in a tab), then the review step shows type+line entries, and committing shows the success result', async () => {
    let resolveAdopt: (value: {
      outcomeText: string;
      adopted: boolean;
      projectId: string;
    }) => void = () => {};
    const adoptSession = vi.fn(
      () =>
        new Promise<{ outcomeText: string; adopted: boolean; projectId: string }>((resolve) => {
          resolveAdopt = resolve;
        }),
    );
    const answerAdoptionCommitConfirm = vi.fn();
    window.seeya = createFakeSeeyaApi({
      adoptSession,
      answerAdoptionCommitConfirm,
      previewAdoptionLaunch: vi.fn(() => Promise.resolve({ explanationLines: [] })),
    });
    const { getByText } = render(<AdoptionDialog />);
    openAdoptionDialog(SESSION);
    await waitFor(() => expect(getDialog().open).toBe(true));

    fireEvent.click(document.getElementById('adoption-pick-new-option') as HTMLButtonElement);
    fireEvent.input(
      document.getElementById('adoption-pick-new-project-id-input') as HTMLInputElement,
      { target: { value: 'auth-hardening' } },
    );
    fireEvent.click(document.getElementById('adoption-pick-submit-button') as HTMLButtonElement);

    await waitFor(() =>
      expect(adoptSession).toHaveBeenCalledWith({
        sessionId: SESSION.sessionId,
        projectId: 'auth-hardening',
      }),
    );
    // "launching": the fork's own tab is open, and this dialog must not block it.
    await waitFor(() => expect(getDialog().open).toBe(false));

    // Main pushes the structured commit question mid-call.
    const onConfirmAdoptionCommitRequest = (
      window.seeya.onConfirmAdoptionCommitRequest as ReturnType<typeof vi.fn>
    ).mock.calls[0]?.[0] as (event: unknown) => void;
    onConfirmAdoptionCommitRequest({
      requestId: 'req-1',
      changedFileEntries: [
        { kind: 'added', path: 'context/know-how.md', lines: { added: 4, removed: 0 } },
        { kind: 'modified', path: 'INDEX.md', lines: { added: 2, removed: 1 } },
        { kind: 'deleted', path: 'AGENTS.md', lines: { added: 0, removed: 3 } },
      ],
    });

    await waitFor(() => expect(getDialog().open).toBe(true));
    expect(getByText('context/know-how.md')).not.toBeNull();
    expect(getByText('+4 −0')).not.toBeNull();
    expect(getByText('M')).not.toBeNull();
    expect(getByText('D')).not.toBeNull();

    fireEvent.click(document.getElementById('adoption-review-commit-button') as HTMLButtonElement);
    expect(answerAdoptionCommitConfirm).toHaveBeenCalledWith({
      requestId: 'req-1',
      decision: 'commit',
    });
    await waitFor(() => expect(getDialog().open).toBe(false));

    resolveAdopt({
      outcomeText: 'Project "auth-hardening": adopted.',
      adopted: true,
      projectId: 'auth-hardening',
    });
    await waitFor(() => expect(getDialog().open).toBe(true));
    expect(getByText('Project "auth-hardening": adopted.')).not.toBeNull();
    expect(document.getElementById('adoption-result-open-project-button')).not.toBeNull();
  });

  it('an unexpected rejection reopens the dialog with an error, never silently (V2-T34)', async () => {
    window.seeya = createFakeSeeyaApi({
      adoptSession: vi.fn(() => Promise.reject(new Error('boom'))),
      previewAdoptionLaunch: vi.fn(() => Promise.resolve({ explanationLines: [] })),
    });
    const { getByText } = render(<AdoptionDialog />);
    openAdoptionDialog(SESSION);
    await waitFor(() => expect(getDialog().open).toBe(true));

    fireEvent.click(document.getElementById('adoption-pick-new-option') as HTMLButtonElement);
    fireEvent.input(
      document.getElementById('adoption-pick-new-project-id-input') as HTMLInputElement,
      { target: { value: 'auth-hardening' } },
    );
    fireEvent.click(document.getElementById('adoption-pick-submit-button') as HTMLButtonElement);

    await waitFor(() => expect(getByText(/adoption failed unexpectedly \(boom\)/)).not.toBeNull());
    expect(document.getElementById('adoption-result-open-project-button')).toBeNull();
  });

  it('a failed-commit result shows the failure reason, never the success chrome', async () => {
    let resolveAdopt: (value: {
      outcomeText: string;
      adopted: boolean;
      projectId: string;
    }) => void = () => {};
    window.seeya = createFakeSeeyaApi({
      adoptSession: vi.fn(
        () =>
          new Promise<{ outcomeText: string; adopted: boolean; projectId: string }>((resolve) => {
            resolveAdopt = resolve;
          }),
      ),
      previewAdoptionLaunch: vi.fn(() => Promise.resolve({ explanationLines: [] })),
    });
    const { getByText } = render(<AdoptionDialog />);
    openAdoptionDialog(SESSION);
    await waitFor(() => expect(getDialog().open).toBe(true));

    fireEvent.click(document.getElementById('adoption-pick-new-option') as HTMLButtonElement);
    fireEvent.input(
      document.getElementById('adoption-pick-new-project-id-input') as HTMLInputElement,
      { target: { value: 'auth-hardening' } },
    );
    fireEvent.click(document.getElementById('adoption-pick-submit-button') as HTMLButtonElement);

    await waitFor(() => expect(getDialog().open).toBe(false));
    // Mid-call push — before `adoptSession`'s own promise ever resolves, same ordering the real
    // `adoptSession` call always has (it decides the commit question BEFORE returning).
    const onConfirmAdoptionCommitRequest = (
      window.seeya.onConfirmAdoptionCommitRequest as ReturnType<typeof vi.fn>
    ).mock.calls[0]?.[0] as (event: unknown) => void;
    onConfirmAdoptionCommitRequest({
      requestId: 'req-1',
      changedFileEntries: [{ kind: 'added', path: 'INDEX.md', lines: { added: 1, removed: 0 } }],
    });
    await waitFor(() => expect(getDialog().open).toBe(true));
    fireEvent.click(document.getElementById('adoption-review-commit-button') as HTMLButtonElement);
    await waitFor(() => expect(getDialog().open).toBe(false));

    resolveAdopt({
      outcomeText:
        'seeya: project "auth-hardening" — the copy wrote changes, but committing them failed (git hook refused).',
      adopted: false,
      projectId: 'auth-hardening',
    });

    await waitFor(() => expect(getDialog().open).toBe(true));
    expect(getByText(/committing them failed/)).not.toBeNull();
    expect(document.getElementById('adoption-result-open-project-button')).toBeNull();
  });
});
