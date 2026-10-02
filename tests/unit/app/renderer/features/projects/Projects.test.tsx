// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/preact';
import { createFakeSeeyaApi } from '../../_fake-seeya-api.js';
import { Projects } from '../../../../../../packages/app/src/renderer/features/projects/Projects.js';
import { registerNewProjectDialogOpener } from '../../../../../../packages/app/src/renderer/features/projects/new-project-dialog-bridge.js';
import type { ProjectPanelRow } from '../../../../../../packages/app/src/state/projects-panel.js';

afterEach(cleanup);

function project(overrides: Partial<ProjectPanelRow> = {}): ProjectPanelRow {
  return {
    projectId: 'auth-hardening',
    name: 'Auth hardening',
    lockText: 'unlocked',
    lock: { kind: 'unlocked' },
    lifecycle: { kind: 'active' },
    sessions: [],
    favorite: false,
    repositoryCount: 0,
    lastActivity: null,
    ...overrides,
  };
}

describe('Projects (V2-T67)', () => {
  it('empty workspace: shows the empty state with a New project action', async () => {
    window.seeya = createFakeSeeyaApi({
      getProjectsPanel: vi.fn(() =>
        Promise.resolve({ projects: [], otherSessionsByDirectory: [], ignoredProjects: [] }),
      ),
    });
    const { getByText } = render(<Projects />);
    await waitFor(() => expect(getByText('No projects yet')).not.toBeNull());
    // Two "New project" buttons exist once the empty state's own action renders — the header's
    // own (always there) and the empty state's own (`docs/INTERFACE.md`'s own "lista vazia
    // (EmptyState com New project)"); clicking EITHER opens the same dialog through the bridge.
    const opener = vi.fn();
    registerNewProjectDialogOpener(opener);
    fireEvent.click(getByText('No projects yet').closest('div')!.querySelector('button')!);
    expect(opener).toHaveBeenCalled();
  });

  it('with projects: shows the header count and the table', async () => {
    window.seeya = createFakeSeeyaApi({
      getProjectsPanel: vi.fn(() =>
        Promise.resolve({
          projects: [
            project({ projectId: 'a', name: 'Alpha' }),
            project({ projectId: 'b', name: 'Beta' }),
          ],
          otherSessionsByDirectory: [],
          ignoredProjects: [],
        }),
      ),
    });
    const { getByText } = render(<Projects />);
    await waitFor(() => expect(getByText('2 projects')).not.toBeNull());
    expect(getByText('Alpha')).not.toBeNull();
    expect(getByText('Beta')).not.toBeNull();
  });

  it('a search with no match shows the no-match empty state, never an invented row', async () => {
    window.seeya = createFakeSeeyaApi({
      getProjectsPanel: vi.fn(() =>
        Promise.resolve({
          projects: [project({ name: 'Auth hardening' })],
          otherSessionsByDirectory: [],
          ignoredProjects: [],
        }),
      ),
    });
    const { getByLabelText, getByText } = render(<Projects />);
    await waitFor(() => expect(getByText('Auth hardening')).not.toBeNull());
    fireEvent.input(getByLabelText('Search projects'), { target: { value: 'nothing-like-this' } });
    await waitFor(() => expect(getByText('No projects match')).not.toBeNull());
  });

  it('shows the Ignored projects section only when there is at least one entry', async () => {
    window.seeya = createFakeSeeyaApi({
      getProjectsPanel: vi.fn(() =>
        Promise.resolve({
          projects: [],
          otherSessionsByDirectory: [],
          ignoredProjects: [
            { projectId: 'broken', reason: 'invalid JSON', fullReason: 'invalid JSON' },
          ],
        }),
      ),
    });
    const { getByText } = render(<Projects />);
    await waitFor(() => expect(getByText('Ignored projects')).not.toBeNull());
    expect(getByText('broken: invalid JSON')).not.toBeNull();
  });

  it('the header’s own "New project" button opens the dialog through the shared bridge', async () => {
    window.seeya = createFakeSeeyaApi({
      getProjectsPanel: vi.fn(() =>
        Promise.resolve({
          projects: [project()],
          otherSessionsByDirectory: [],
          ignoredProjects: [],
        }),
      ),
    });
    const opener = vi.fn();
    const { getByText } = render(<Projects />);
    await waitFor(() => expect(getByText('Auth hardening')).not.toBeNull());
    registerNewProjectDialogOpener(opener);
    fireEvent.click(getByText('New project'));
    expect(opener).toHaveBeenCalledTimes(1);
  });
});

describe('Projects with archived projects (V2-T84, docs/INTERFACE.md § 4b)', () => {
  const ARCHIVED = {
    kind: 'archived',
    archivedAt: new Date('2026-10-02T10:00:00.000Z'),
    note: 'Finished — shipped',
  } as const;

  function install(rows: readonly ProjectPanelRow[]): void {
    window.seeya = createFakeSeeyaApi({
      getProjectsPanel: vi.fn(() =>
        Promise.resolve({ projects: rows, otherSessionsByDirectory: [], ignoredProjects: [] }),
      ),
    });
  }

  it('the default view and the header count consider only the active projects', async () => {
    install([
      project({ projectId: 'a', name: 'Alpha' }),
      project({ projectId: 'old', name: 'Old thing', lifecycle: ARCHIVED }),
    ]);
    const { getByText, queryByText } = render(<Projects />);
    await waitFor(() => expect(getByText('1 project')).not.toBeNull());
    expect(getByText('Alpha')).not.toBeNull();
    expect(queryByText('Old thing')).toBeNull();
  });

  it('the Archived filter shows only the archived ones, with date and note', async () => {
    install([
      project({ projectId: 'a', name: 'Alpha' }),
      project({ projectId: 'old', name: 'Old thing', lifecycle: ARCHIVED }),
    ]);
    const { getByText, queryByText, getByRole } = render(<Projects />);
    await waitFor(() => expect(getByText('Alpha')).not.toBeNull());
    fireEvent.click(getByRole('radio', { name: 'Archived' }));
    await waitFor(() => expect(getByText('Old thing')).not.toBeNull());
    expect(queryByText('Alpha')).toBeNull();
    expect(getByText('2026-10-02')).not.toBeNull();
    expect(getByText('Finished — shipped')).not.toBeNull();
    expect(getByText('Unarchive…')).not.toBeNull();
  });

  it('the Archived filter with nothing archived says so, instead of the generic no-match text', async () => {
    install([project({ projectId: 'a', name: 'Alpha' })]);
    const { getByText, getByRole } = render(<Projects />);
    await waitFor(() => expect(getByText('Alpha')).not.toBeNull());
    fireEvent.click(getByRole('radio', { name: 'Archived' }));
    await waitFor(() => expect(getByText('No archived projects')).not.toBeNull());
  });

  it('a workspace with only archived projects still offers the filters (the Archived one reaches them)', async () => {
    install([project({ projectId: 'old', name: 'Old thing', lifecycle: ARCHIVED })]);
    const { getByText, getByRole } = render(<Projects />);
    await waitFor(() => expect(getByText('0 projects')).not.toBeNull());
    fireEvent.click(getByRole('radio', { name: 'Archived' }));
    await waitFor(() => expect(getByText('Old thing')).not.toBeNull());
  });
});
