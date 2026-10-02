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
          ignoredProjects: [{ projectId: 'broken', reason: 'invalid JSON' }],
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
