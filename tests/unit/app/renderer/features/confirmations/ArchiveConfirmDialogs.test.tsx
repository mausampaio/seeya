// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/preact';
import { createFakeSeeyaApi } from '../../_fake-seeya-api.js';
import {
  ArchiveProjectConfirmDialog,
  UnarchiveProjectConfirmDialog,
  openArchiveConfirm,
  openUnarchiveConfirm,
} from '../../../../../../packages/app/src/renderer/features/confirmations/index.js';
import type { ProjectActionResponse } from '../../../../../../packages/app/src/state/project-details-result.js';

afterEach(cleanup);

const TARGET = { projectId: 'old-thing', name: 'Old thing' };

function dialogById(id: string): HTMLDialogElement {
  return document.getElementById(id) as HTMLDialogElement;
}

function ok(line = 'done'): ProjectActionResponse {
  return { tone: 'success', lines: [line], projectRemoved: false };
}

describe('ArchiveProjectConfirmDialog (V2-T84, docs/INTERFACE.md § 4b/§ 9)', () => {
  it('is closed until asked, then says what changes, what does not, and offers the optional note', async () => {
    window.seeya = createFakeSeeyaApi();
    const view = render(<ArchiveProjectConfirmDialog />);
    expect(dialogById('archive-project-confirm-dialog').open).toBe(false);

    void act(() => openArchiveConfirm(TARGET));
    await waitFor(() => expect(dialogById('archive-project-confirm-dialog').open).toBe(true));
    expect(view.getByText('Archive project "Old thing"?')).not.toBeNull();
    expect(view.container.querySelector('#archive-project-confirm-changes')?.textContent).toMatch(
      /leaves Favorites, Recent/,
    );
    expect(
      view.container.querySelector('#archive-project-confirm-nothing-deleted')?.textContent,
    ).toMatch(/Nothing is deleted/);
    expect(view.getByLabelText('Note (optional)')).not.toBeNull();
  });

  it('Archive sends the trimmed note (null when blank), shows loading while it runs, then closes', async () => {
    let finish: (response: ProjectActionResponse) => void = () => {};
    const archiveProject = vi.fn(
      () =>
        new Promise<ProjectActionResponse>((resolve) => {
          finish = resolve;
        }),
    );
    window.seeya = createFakeSeeyaApi({ archiveProject });
    const view = render(<ArchiveProjectConfirmDialog />);
    void act(() => openArchiveConfirm(TARGET));
    await waitFor(() => expect(dialogById('archive-project-confirm-dialog').open).toBe(true));
    fireEvent.input(view.getByLabelText('Note (optional)'), {
      target: { value: '  Finished — shipped  ' },
    });
    fireEvent.click(document.getElementById('archive-project-confirm-proceed')!);

    await waitFor(() =>
      expect(archiveProject).toHaveBeenCalledWith({
        projectId: 'old-thing',
        note: 'Finished — shipped',
      }),
    );
    expect(
      document.getElementById('archive-project-confirm-proceed')?.getAttribute('aria-busy'),
    ).toBe('true');
    expect(
      (document.getElementById('archive-project-confirm-decline') as HTMLButtonElement).disabled,
    ).toBe(true);
    void act(() => finish(ok()));
    await waitFor(() => expect(dialogById('archive-project-confirm-dialog').open).toBe(false));
  });

  it('a blank note goes as null', async () => {
    const archiveProject = vi.fn(() => Promise.resolve(ok()));
    window.seeya = createFakeSeeyaApi({ archiveProject });
    render(<ArchiveProjectConfirmDialog />);
    void act(() => openArchiveConfirm(TARGET));
    await waitFor(() => expect(dialogById('archive-project-confirm-dialog').open).toBe(true));
    fireEvent.click(document.getElementById('archive-project-confirm-proceed')!);
    await waitFor(() =>
      expect(archiveProject).toHaveBeenCalledWith({ projectId: 'old-thing', note: null }),
    );
  });

  it('a refusal stays on screen inside the dialog — never a silent close', async () => {
    const archiveProject = vi.fn(() =>
      Promise.resolve<ProjectActionResponse>({
        tone: 'error',
        lines: ['seeya: project "old-thing" is locked by session abc — refusing to archive it'],
        projectRemoved: false,
      }),
    );
    window.seeya = createFakeSeeyaApi({ archiveProject });
    const view = render(<ArchiveProjectConfirmDialog />);
    void act(() => openArchiveConfirm(TARGET));
    await waitFor(() => expect(dialogById('archive-project-confirm-dialog').open).toBe(true));
    fireEvent.click(document.getElementById('archive-project-confirm-proceed')!);

    await waitFor(() =>
      expect(view.container.querySelector('#archive-project-confirm-problem')?.textContent).toMatch(
        /refusing to archive it/,
      ),
    );
    expect(dialogById('archive-project-confirm-dialog').open).toBe(true);
  });

  it('a rejected IPC call is shown as an error line, never swallowed', async () => {
    const archiveProject = vi.fn(() => Promise.reject(new Error('ipc blew up')));
    window.seeya = createFakeSeeyaApi({ archiveProject });
    const view = render(<ArchiveProjectConfirmDialog />);
    void act(() => openArchiveConfirm(TARGET));
    await waitFor(() => expect(dialogById('archive-project-confirm-dialog').open).toBe(true));
    fireEvent.click(document.getElementById('archive-project-confirm-proceed')!);
    await waitFor(() => expect(view.getByText('That did not work: ipc blew up')).not.toBeNull());
  });

  it('Cancel closes without calling the engine', async () => {
    const archiveProject = vi.fn();
    window.seeya = createFakeSeeyaApi({ archiveProject });
    render(<ArchiveProjectConfirmDialog />);
    void act(() => openArchiveConfirm(TARGET));
    await waitFor(() => expect(dialogById('archive-project-confirm-dialog').open).toBe(true));
    fireEvent.click(document.getElementById('archive-project-confirm-decline')!);
    await waitFor(() => expect(dialogById('archive-project-confirm-dialog').open).toBe(false));
    expect(archiveProject).not.toHaveBeenCalled();
  });
});

describe('UnarchiveProjectConfirmDialog (V2-T84, docs/INTERFACE.md § 4b/§ 9)', () => {
  it('offers Unarchive and Unarchive and open, each explained, plus Cancel', async () => {
    window.seeya = createFakeSeeyaApi();
    const view = render(<UnarchiveProjectConfirmDialog />);
    void act(() => openUnarchiveConfirm(TARGET));
    await waitFor(() => expect(dialogById('unarchive-project-confirm-dialog').open).toBe(true));
    expect(view.getByText('Unarchive project "Old thing"?')).not.toBeNull();
    expect(view.getByText(/Brings it back into Favorites, Recent/)).not.toBeNull();
    expect(view.getByText(/then opens it in a tab right away/)).not.toBeNull();
    expect(document.getElementById('unarchive-project-confirm-decline')).not.toBeNull();
  });

  it('Unarchive calls only unarchiveProject and opens nothing', async () => {
    const unarchiveProject = vi.fn(() => Promise.resolve(ok()));
    const openProject = vi.fn();
    window.seeya = createFakeSeeyaApi({ unarchiveProject, openProject });
    render(<UnarchiveProjectConfirmDialog />);
    void act(() => openUnarchiveConfirm(TARGET));
    await waitFor(() => expect(dialogById('unarchive-project-confirm-dialog').open).toBe(true));
    fireEvent.click(document.getElementById('unarchive-project-confirm-proceed')!);
    await waitFor(() => expect(dialogById('unarchive-project-confirm-dialog').open).toBe(false));
    expect(unarchiveProject).toHaveBeenCalledWith({ projectId: 'old-thing' });
    expect(openProject).not.toHaveBeenCalled();
  });

  it('Unarchive and open calls unarchiveProject, then openProject for the same project', async () => {
    const unarchiveProject = vi.fn(() => Promise.resolve(ok()));
    const openProject = vi.fn(() => Promise.resolve({ outcomeText: 'x' }));
    window.seeya = createFakeSeeyaApi({ unarchiveProject, openProject: openProject as never });
    render(<UnarchiveProjectConfirmDialog />);
    void act(() => openUnarchiveConfirm(TARGET));
    await waitFor(() => expect(dialogById('unarchive-project-confirm-dialog').open).toBe(true));
    fireEvent.click(document.getElementById('unarchive-project-confirm-open')!);
    await waitFor(() => expect(openProject).toHaveBeenCalledWith({ projectId: 'old-thing' }));
    expect(unarchiveProject).toHaveBeenCalledWith({ projectId: 'old-thing' });
  });

  it('a refusal (project locked) keeps the dialog open with the reason and never opens the project', async () => {
    const unarchiveProject = vi.fn(() =>
      Promise.resolve<ProjectActionResponse>({
        tone: 'error',
        lines: ['seeya: project "old-thing" is locked — refusing to unarchive it'],
        projectRemoved: false,
      }),
    );
    const openProject = vi.fn();
    window.seeya = createFakeSeeyaApi({ unarchiveProject, openProject });
    const view = render(<UnarchiveProjectConfirmDialog />);
    void act(() => openUnarchiveConfirm(TARGET));
    await waitFor(() => expect(dialogById('unarchive-project-confirm-dialog').open).toBe(true));
    fireEvent.click(document.getElementById('unarchive-project-confirm-open')!);
    await waitFor(() =>
      expect(
        view.container.querySelector('#unarchive-project-confirm-problem')?.textContent,
      ).toMatch(/refusing to unarchive it/),
    );
    expect(dialogById('unarchive-project-confirm-dialog').open).toBe(true);
    expect(openProject).not.toHaveBeenCalled();
  });
});
