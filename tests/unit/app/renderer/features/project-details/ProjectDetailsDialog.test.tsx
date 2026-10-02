// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/preact';
import { createFakeSeeyaApi } from '../../_fake-seeya-api.js';
import {
  ProjectDetailsDialog,
  openProjectDetails,
} from '../../../../../../packages/app/src/renderer/features/project-details/index.js';
import type {
  ProjectDetailsAdoptionRow,
  ProjectDetailsData,
  ProjectDetailsRepositoryRow,
} from '../../../../../../packages/app/src/state/project-details.js';
import type { ProjectActionResponse } from '../../../../../../packages/app/src/state/project-details-result.js';
import type {
  ProjectPanelRow,
  ProjectsPanelData,
} from '../../../../../../packages/app/src/state/projects-panel.js';

afterEach(cleanup);

const REPOSITORIES: readonly ProjectDetailsRepositoryRow[] = [
  {
    name: 'api',
    remote: 'git@example.com:acme/api.git',
    localPath: { kind: 'onThisDevice', path: '/home/<usuario>/code/api' },
  },
  {
    name: 'notes',
    remote: null,
    localPath: { kind: 'onThisDevice', path: '/home/<usuario>/notes' },
  },
  { name: 'web', remote: 'git@example.com:acme/web.git', localPath: { kind: 'notOnThisDevice' } },
];

const ADOPTION: ProjectDetailsAdoptionRow = {
  originalSessionId: 'aaaaaaaa-1111-4111-8111-111111111111',
  forkSessionId: 'bbbbbbbb-2222-4222-8222-222222222222',
  originalDisplayId: 'aaaaaaaa',
  forkDisplayId: 'bbbbbbbb',
  adoptedAt: new Date('2026-09-24T10:00:00.000Z'),
};

function found(
  overrides: Partial<Extract<ProjectDetailsData, { kind: 'found' }>> = {},
): ProjectDetailsData {
  return {
    kind: 'found',
    projectId: 'auth-hardening',
    name: 'Auth hardening',
    dir: '/home/<usuario>/seeya/workspace/auth-hardening',
    writeAccess: { kind: 'open' },
    repositories: REPOSITORIES,
    adoptions: [],
    fileCount: 7,
    ...overrides,
  };
}

function panelRow(overrides: Partial<ProjectPanelRow> = {}): ProjectPanelRow {
  return {
    projectId: 'auth-hardening',
    name: 'Auth hardening',
    lockText: 'unlocked',
    lock: { kind: 'unlocked' },
    sessions: [],
    favorite: false,
    repositoryCount: 3,
    lastActivity: null,
    ...overrides,
  };
}

function panel(rows: readonly ProjectPanelRow[]): ProjectsPanelData {
  return { projects: rows, otherSessionsByDirectory: [], ignoredProjects: [] };
}

function response(overrides: Partial<ProjectActionResponse> = {}): ProjectActionResponse {
  return { tone: 'success', lines: ['done'], projectRemoved: false, ...overrides };
}

interface Api {
  readonly getProjectDetails: ReturnType<typeof vi.fn>;
  readonly pickDirectory: ReturnType<typeof vi.fn>;
  readonly addProjectRepository: ReturnType<typeof vi.fn>;
  readonly removeProjectRepository: ReturnType<typeof vi.fn>;
  readonly revertProjectAdoption: ReturnType<typeof vi.fn>;
  readonly removeProject: ReturnType<typeof vi.fn>;
}

function installApi(
  options: {
    details?: ProjectDetailsData | (() => Promise<ProjectDetailsData>);
    row?: ProjectPanelRow | null;
    overrides?: Partial<Api>;
  } = {},
): Api {
  const details = options.details ?? found();
  const api: Api = {
    getProjectDetails: vi.fn(() =>
      typeof details === 'function' ? details() : Promise.resolve(details),
    ),
    pickDirectory: vi.fn(() => Promise.resolve({ canceled: true as const })),
    addProjectRepository: vi.fn(() => Promise.resolve(response())),
    removeProjectRepository: vi.fn(() => Promise.resolve(response())),
    revertProjectAdoption: vi.fn(() => Promise.resolve(response())),
    removeProject: vi.fn(() => Promise.resolve(response())),
    ...options.overrides,
  };
  const row = options.row === undefined ? panelRow() : options.row;
  window.seeya = createFakeSeeyaApi({
    ...api,
    getProjectsPanel: vi.fn(() => Promise.resolve(panel(row === null ? [] : [row]))),
    getHomeDir: vi.fn(() => Promise.resolve('/home/<usuario>')),
  } as never);
  return api;
}

async function openDialog(): Promise<ReturnType<typeof render>> {
  const view = render(<ProjectDetailsDialog />);
  act(() => openProjectDetails('auth-hardening'));
  await waitFor(() => expect(view.container.querySelector('#project-details-name')).not.toBeNull());
  return view;
}

describe('ProjectDetailsDialog (V2-T83, docs/INTERFACE.md § 4a)', () => {
  it('is closed until the Projects tab asks for it, then reads the project it was asked for', async () => {
    const api = installApi();
    const view = render(<ProjectDetailsDialog />);
    const dialog = document.getElementById('project-details-dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(false);
    expect(api.getProjectDetails).not.toHaveBeenCalled();

    act(() => openProjectDetails('auth-hardening'));
    await waitFor(() => expect(dialog.open).toBe(true));
    await waitFor(() =>
      expect(api.getProjectDetails).toHaveBeenCalledWith({ projectId: 'auth-hardening' }),
    );
    await waitFor(() => expect(view.getByText('Auth hardening')).not.toBeNull());
  });

  it('header: name, id, the lock text of the Projects tab, and the folder abbreviated with ~ (full path in title)', async () => {
    installApi();
    const view = await openDialog();
    expect(view.container.querySelector('#project-details-id')?.textContent).toBe('auth-hardening');
    await waitFor(() =>
      expect(view.container.querySelector('#project-details-lock')?.textContent).toBe(
        'Lock: Unlocked',
      ),
    );
    const path = view.container.querySelector('#project-details-path') as HTMLElement;
    expect(path.textContent).toBe('Folder: ~/seeya/workspace/auth-hardening');
    expect(path.getAttribute('title')).toBe('/home/<usuario>/seeya/workspace/auth-hardening');
  });

  it('repositories: remote or "No remote", the local path or "Not on this device"', async () => {
    installApi();
    const view = await openDialog();
    const rows = view.container.querySelectorAll('#project-details-repositories li');
    expect(rows).toHaveLength(3);
    const [api, notes, web] = Array.from(rows).map((row) => row.textContent ?? '');
    expect(api).toContain('git@example.com:acme/api.git');
    expect(api).toContain('~/code/api');
    expect(notes).toContain('No remote');
    expect(notes).toContain('~/notes');
    expect(web).toContain('git@example.com:acme/web.git');
    expect(web).toContain('Not on this device');
    // The full path stays one hover away.
    expect(rows[0]?.querySelector('[title="/home/<usuario>/code/api"]')).not.toBeNull();
  });

  it('a project with no repository says so', async () => {
    installApi({ details: found({ repositories: [] }) });
    const view = await openDialog();
    expect(view.getByText('No repository is associated with this project yet.')).not.toBeNull();
  });

  it('hides "Adopted sessions" when the project has no adoption, shows a row with Revert… when it has', async () => {
    installApi();
    const empty = await openDialog();
    expect(empty.container.querySelector('#project-details-adoptions')).toBeNull();
    cleanup();

    installApi({ details: found({ adoptions: [ADOPTION] }) });
    const view = await openDialog();
    const row = view.container.querySelector('#project-details-adoptions li') as HTMLElement;
    expect(row.textContent).toContain('bbbbbbbb');
    expect(row.textContent).toContain('original aaaaaaaa');
    expect(row.textContent).toContain('adopted ');
    expect(view.getByText('Revert…')).not.toBeNull();
  });

  it('Add repository…: a cancelled picker asks the engine nothing and shows nothing', async () => {
    const api = installApi();
    const view = await openDialog();
    fireEvent.click(view.getByText('Add repository…'));
    await waitFor(() => expect(api.pickDirectory).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        (view.getByText('Add repository…').closest('button') as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    expect(api.addProjectRepository).not.toHaveBeenCalled();
    expect(view.container.querySelector('#project-details-result')).toBeNull();
  });

  it('Add repository…: the picked folder goes to the engine, the result is shown and the details are re-read at once', async () => {
    const api = installApi({
      overrides: {
        pickDirectory: vi.fn(() =>
          Promise.resolve({ canceled: false as const, path: '/code/new' }),
        ),
        addProjectRepository: vi.fn(() =>
          Promise.resolve(
            response({ lines: ['Linked repository "new" to project "auth-hardening".'] }),
          ),
        ),
      },
    });
    const view = await openDialog();
    const readsBefore = api.getProjectDetails.mock.calls.length;
    fireEvent.click(view.getByText('Add repository…'));

    await waitFor(() =>
      expect(api.addProjectRepository).toHaveBeenCalledWith({
        projectId: 'auth-hardening',
        path: '/code/new',
      }),
    );
    await waitFor(() =>
      expect(view.container.querySelector('#project-details-result')?.textContent).toContain(
        'Linked repository "new"',
      ),
    );
    expect(api.getProjectDetails.mock.calls.length).toBeGreaterThan(readsBefore);
  });

  it('Add repository…: "already associated" and a refusal are shown with their reason, never silently', async () => {
    installApi({
      overrides: {
        pickDirectory: vi.fn(() => Promise.resolve({ canceled: false as const, path: '/code/x' })),
        addProjectRepository: vi.fn(() =>
          Promise.resolve(
            response({
              tone: 'info',
              lines: ['Repository "x" is already associated with project "auth-hardening".'],
            }),
          ),
        ),
      },
    });
    const view = await openDialog();
    fireEvent.click(view.getByText('Add repository…'));
    await waitFor(() =>
      expect(view.container.querySelector('#project-details-result')?.textContent).toContain(
        'already associated',
      ),
    );
  });

  it('an action whose call REJECTS shows the reason in the dialog (the .catch), and re-enables the buttons', async () => {
    installApi({
      overrides: {
        pickDirectory: vi.fn(() => Promise.resolve({ canceled: false as const, path: '/code/x' })),
        addProjectRepository: vi.fn(() => Promise.reject(new Error('git exploded'))),
      },
    });
    const view = await openDialog();
    fireEvent.click(view.getByText('Add repository…'));
    await waitFor(() =>
      expect(view.container.querySelector('#project-details-result')?.textContent).toBe(
        'That did not work: git exploded',
      ),
    );
    expect(
      (view.getByText('Add repository…').closest('button') as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('shows loading on the running action and disables every other write button meanwhile', async () => {
    let finish: ((value: ProjectActionResponse) => void) | undefined;
    installApi({
      details: found({ adoptions: [ADOPTION] }),
      overrides: {
        removeProjectRepository: vi.fn(
          () =>
            new Promise<ProjectActionResponse>((resolve) => {
              finish = resolve;
            }),
        ),
      },
    });
    const view = await openDialog();
    fireEvent.click(view.getAllByText('Remove')[0]!);

    const removeButtons = view.getAllByText('Remove').map((node) => node.closest('button')!);
    await waitFor(() => expect(removeButtons[0]?.getAttribute('aria-busy')).toBe('true'));
    expect(
      (view.getByText('Add repository…').closest('button') as HTMLButtonElement).disabled,
    ).toBe(true);
    expect((view.getByText('Revert…').closest('button') as HTMLButtonElement).disabled).toBe(true);
    expect(
      (view.getByText('Remove project…').closest('button') as HTMLButtonElement).disabled,
    ).toBe(true);

    await act(async () => finish?.(response()));
    await waitFor(() =>
      expect(
        (view.getByText('Add repository…').closest('button') as HTMLButtonElement).disabled,
      ).toBe(false),
    );
  });

  it('Remove on a repository row removes THAT repository, with no confirmation', async () => {
    const api = installApi();
    const view = await openDialog();
    const secondRow = view.container.querySelectorAll('#project-details-repositories li')[1]!;
    fireEvent.click(secondRow.querySelector('button')!);
    await waitFor(() =>
      expect(api.removeProjectRepository).toHaveBeenCalledWith({
        projectId: 'auth-hardening',
        name: 'notes',
      }),
    );
  });

  it('Revert… asks the engine to revert THAT adoption by its copy id and shows the outcome', async () => {
    const api = installApi({
      details: found({ adoptions: [ADOPTION] }),
      overrides: {
        revertProjectAdoption: vi.fn(() =>
          Promise.resolve(response({ lines: ['Project "auth-hardening": reverted 2 commits.'] })),
        ),
      },
    });
    const view = await openDialog();
    fireEvent.click(view.getByText('Revert…'));
    await waitFor(() =>
      expect(api.revertProjectAdoption).toHaveBeenCalledWith({
        projectId: 'auth-hardening',
        forkSessionId: ADOPTION.forkSessionId,
      }),
    );
    await waitFor(() =>
      expect(view.container.querySelector('#project-details-result')?.textContent).toContain(
        'reverted 2 commits',
      ),
    );
  });

  it('a refusal by a later commit is shown with its reason as an error', async () => {
    installApi({
      details: found({ adoptions: [ADOPTION] }),
      overrides: {
        revertProjectAdoption: vi.fn(() =>
          Promise.resolve(
            response({
              tone: 'error',
              lines: [
                'seeya: refusing to revert — commit c0ffee (from a different session) touched the same files afterward.',
              ],
            }),
          ),
        ),
      },
    });
    const view = await openDialog();
    fireEvent.click(view.getByText('Revert…'));
    await waitFor(() =>
      expect(view.container.querySelector('#project-details-result')?.textContent).toContain(
        'commit c0ffee',
      ),
    );
  });

  it('Remove project…: removed switches the dialog to a readable result with the recovery line, never re-reading the gone project', async () => {
    const api = installApi({
      overrides: {
        removeProject: vi.fn(() =>
          Promise.resolve(
            response({
              projectRemoved: true,
              lines: [
                'Project "auth-hardening" removed (7 files).',
                'To recover: git -C <workspace> checkout abc1234 -- auth-hardening (then commit that restoration yourself).',
              ],
            }),
          ),
        ),
      },
    });
    const view = await openDialog();
    fireEvent.click(view.getByText('Remove project…'));
    await waitFor(() =>
      expect(view.container.querySelector('#project-details-removed-title')?.textContent).toBe(
        'Project "auth-hardening" removed',
      ),
    );
    expect(view.getByText(/To recover: git -C <workspace> checkout abc1234/)).not.toBeNull();
    expect(view.container.querySelector('#project-details-repositories')).toBeNull();
    expect(view.getByText('Done')).not.toBeNull();
    const readsAtRemoval = api.getProjectDetails.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(api.getProjectDetails.mock.calls.length).toBe(readsAtRemoval);

    const dialog = document.getElementById('project-details-dialog') as HTMLDialogElement;
    fireEvent.click(view.getByText('Done'));
    await waitFor(() => expect(dialog.open).toBe(false));
  });

  it('Remove project…: cancelling in the confirmation keeps the project and says so', async () => {
    installApi({
      overrides: {
        removeProject: vi.fn(() =>
          Promise.resolve(
            response({
              tone: 'info',
              lines: ['Project "auth-hardening": removal cancelled — you chose not to continue.'],
            }),
          ),
        ),
      },
    });
    const view = await openDialog();
    fireEvent.click(view.getByText('Remove project…'));
    await waitFor(() =>
      expect(view.container.querySelector('#project-details-result')?.textContent).toContain(
        'removal cancelled',
      ),
    );
    expect(view.container.querySelector('#project-details-repositories')).not.toBeNull();
  });

  it('locked by another live session: every write is disabled with the reason, reading stays', async () => {
    installApi({
      details: found({
        adoptions: [ADOPTION],
        writeAccess: { kind: 'blocked', heldByText: 'session s (pid 1) since X' },
      }),
      row: panelRow({ lock: { kind: 'lockedByOther', holderDisplaySessionId: 's' } }),
    });
    const view = await openDialog();
    const notice = view.container.querySelector('#project-details-locked-notice');
    expect(notice?.textContent).toContain('held by session s (pid 1) since X');
    const writes = [
      view.getByText('Add repository…'),
      view.getByText('Revert…'),
      view.getByText('Remove project…'),
      ...view.getAllByText('Remove'),
    ].map((node) => node.closest('button') as HTMLButtonElement);
    for (const button of writes) {
      expect(button.disabled).toBe(true);
      expect(button.getAttribute('title')).toContain('held by session s (pid 1) since X');
    }
    // Reading: the lists are still there, and Close still works.
    expect(view.container.querySelectorAll('#project-details-repositories li')).toHaveLength(3);
    expect((view.getByText('Close').closest('button') as HTMLButtonElement).disabled).toBe(false);
  });

  it('a project open in a tab of THIS window says to close that tab', async () => {
    installApi({
      details: found({ writeAccess: { kind: 'blocked', heldByText: 'session s' } }),
      row: panelRow({ lock: { kind: 'openHere', tabId: 'tab-1' } }),
    });
    const view = await openDialog();
    expect(view.container.querySelector('#project-details-locked-notice')?.textContent).toBe(
      'This project is open in a tab. Close that tab to change it from here.',
    );
  });

  it('a project that no longer exists says so instead of showing empty sections', async () => {
    installApi({ details: { kind: 'notFound', projectId: 'auth-hardening' }, row: null });
    const view = render(<ProjectDetailsDialog />);
    act(() => openProjectDetails('auth-hardening'));
    await waitFor(() =>
      expect(view.container.querySelector('#project-details-not-found')?.textContent).toBe(
        'Project "auth-hardening" no longer exists in the workspace.',
      ),
    );
    expect(view.container.querySelector('#project-details-repositories')).toBeNull();
  });

  it('a failed read is shown, never a blank dialog', async () => {
    installApi({ details: () => Promise.reject(new Error('disk on fire')) });
    const view = render(<ProjectDetailsDialog />);
    act(() => openProjectDetails('auth-hardening'));
    await waitFor(() =>
      expect(view.container.querySelector('#project-details-load-error')?.textContent).toBe(
        'Could not read the project: disk on fire',
      ),
    );
  });
});
