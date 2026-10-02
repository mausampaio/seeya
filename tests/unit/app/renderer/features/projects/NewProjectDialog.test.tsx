// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/preact';
import { createFakeSeeyaApi } from '../../_fake-seeya-api.js';
import { NewProjectDialog } from '../../../../../../packages/app/src/renderer/features/projects/NewProjectDialog/index.js';
import { openNewProjectDialog } from '../../../../../../packages/app/src/renderer/features/projects/new-project-dialog-bridge.js';

afterEach(cleanup);

describe('NewProjectDialog (V2-T67)', () => {
  it('is closed until openNewProjectDialog() is called', () => {
    window.seeya = createFakeSeeyaApi();
    const { queryByLabelText } = render(<NewProjectDialog />);
    expect(queryByLabelText('Project id')).not.toBeNull();
    // Closed: a real <dialog> without `open` is `display: none` (never visible/interactive).
    const dialog = document.getElementById('new-project-dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(false);
  });

  it('opens on openNewProjectDialog(), creates on submit, and closes', async () => {
    const createProject = vi.fn(() =>
      Promise.resolve({ kind: 'created' as const, projectId: 'auth-hardening' }),
    );
    window.seeya = createFakeSeeyaApi({ createProject });
    render(<NewProjectDialog />);
    openNewProjectDialog();
    const dialog = document.getElementById('new-project-dialog') as HTMLDialogElement;
    await waitFor(() => expect(dialog.open).toBe(true));

    const input = document.getElementById('new-project-id-input') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'auth-hardening' } });
    fireEvent.submit(document.getElementById('new-project-form') as HTMLFormElement);

    await waitFor(() =>
      expect(createProject).toHaveBeenCalledWith({ projectId: 'auth-hardening' }),
    );
    await waitFor(() => expect(dialog.open).toBe(false));
  });

  it('shows the rejection next to the field and keeps the dialog open, with the typed text', async () => {
    const createProject = vi.fn(() =>
      Promise.resolve({ kind: 'alreadyExists' as const, projectId: 'auth-hardening' }),
    );
    window.seeya = createFakeSeeyaApi({ createProject });
    const { getByText } = render(<NewProjectDialog />);
    openNewProjectDialog();
    const dialog = document.getElementById('new-project-dialog') as HTMLDialogElement;
    await waitFor(() => expect(dialog.open).toBe(true));

    const input = document.getElementById('new-project-id-input') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'auth-hardening' } });
    fireEvent.submit(document.getElementById('new-project-form') as HTMLFormElement);

    await waitFor(() =>
      expect(getByText('Project "auth-hardening" already exists.')).not.toBeNull(),
    );
    expect(dialog.open).toBe(true);
    expect(input.value).toBe('auth-hardening');
  });

  it('shows the format error on blur, before any submit (V2-T71)', async () => {
    const createProject = vi.fn();
    window.seeya = createFakeSeeyaApi({ createProject });
    const { getByText } = render(<NewProjectDialog />);
    openNewProjectDialog();
    const dialog = document.getElementById('new-project-dialog') as HTMLDialogElement;
    await waitFor(() => expect(dialog.open).toBe(true));

    const input = document.getElementById('new-project-id-input') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'Auth Hardening' } });
    fireEvent.blur(input);

    await waitFor(() =>
      expect(
        getByText('Use lowercase letters, digits and hyphens — for example payments-webhooks.'),
      ).not.toBeNull(),
    );
    expect(createProject).not.toHaveBeenCalled();
  });

  it('blocks submit for a malformed id without ever reaching the engine (V2-T71)', async () => {
    const createProject = vi.fn();
    window.seeya = createFakeSeeyaApi({ createProject });
    const { getByText } = render(<NewProjectDialog />);
    openNewProjectDialog();
    const dialog = document.getElementById('new-project-dialog') as HTMLDialogElement;
    await waitFor(() => expect(dialog.open).toBe(true));

    const input = document.getElementById('new-project-id-input') as HTMLInputElement;
    fireEvent.input(input, { target: { value: '../escape' } });
    fireEvent.submit(document.getElementById('new-project-form') as HTMLFormElement);

    await waitFor(() =>
      expect(
        getByText('Use lowercase letters, digits and hyphens — for example payments-webhooks.'),
      ).not.toBeNull(),
    );
    expect(createProject).not.toHaveBeenCalled();
    expect(dialog.open).toBe(true);
  });

  it('an empty, never-touched field shows no format error (not malformed, just not filled in)', async () => {
    window.seeya = createFakeSeeyaApi();
    const { queryByText } = render(<NewProjectDialog />);
    openNewProjectDialog();
    const dialog = document.getElementById('new-project-dialog') as HTMLDialogElement;
    await waitFor(() => expect(dialog.open).toBe(true));

    expect(
      queryByText('Use lowercase letters, digits and hyphens — for example payments-webhooks.'),
    ).toBeNull();
  });

  it('cancel closes without creating anything', async () => {
    const createProject = vi.fn();
    window.seeya = createFakeSeeyaApi({ createProject });
    render(<NewProjectDialog />);
    openNewProjectDialog();
    const dialog = document.getElementById('new-project-dialog') as HTMLDialogElement;
    await waitFor(() => expect(dialog.open).toBe(true));

    fireEvent.click(document.getElementById('new-project-cancel') as HTMLButtonElement);
    await waitFor(() => expect(dialog.open).toBe(false));
    expect(createProject).not.toHaveBeenCalled();
  });

  it('an unexpected rejection never leaves the dialog stuck submitting in silence (V2-T34)', async () => {
    const createProject = vi.fn(() => Promise.reject(new Error('boom')));
    window.seeya = createFakeSeeyaApi({ createProject });
    const { getByText } = render(<NewProjectDialog />);
    openNewProjectDialog();
    const dialog = document.getElementById('new-project-dialog') as HTMLDialogElement;
    await waitFor(() => expect(dialog.open).toBe(true));

    const input = document.getElementById('new-project-id-input') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'auth-hardening' } });
    fireEvent.submit(document.getElementById('new-project-form') as HTMLFormElement);

    await waitFor(() =>
      expect(getByText('seeya: create failed unexpectedly (boom).')).not.toBeNull(),
    );
    const submitButton = document.getElementById('new-project-submit') as HTMLButtonElement;
    expect(submitButton.disabled).toBe(false);
  });
});
