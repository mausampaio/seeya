/**
 * `removeRepository` (V2-T32, `application/project-remove-repo.ts`) — against the same named
 * doubles `repository-association.test.ts` already uses for the opposite direction (`addRepository`
 * is reused here to set up each scenario, never reimplemented).
 */
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { removeRepository } from '@seeya-ai/engine/application/project-remove-repo.js';
import type { RemoveRepositoryDeps } from '@seeya-ai/engine/application/project-remove-repo.js';
import { addRepository } from '@seeya-ai/engine/application/repository-association.js';
import { createProject } from '@seeya-ai/engine/application/workspace.js';
import {
  ControllableProcessControl,
  DEFAULT_TEST_CONFIG,
  FakeClock,
  FakeDirectoryExistence,
  FakeGitReaderWithRemote,
  FakeProjectLock,
  FakeWorkspaceRepository,
  InMemoryDeviceStorage,
} from './_fakes.js';

const SEEYA_HOME = path.resolve(path.sep, 'seeya-home-fixture');
const WORKSPACE_ROOT = path.join(SEEYA_HOME, 'workspace');
const REPO_PATH = path.resolve(path.sep, 'code', 'app-api');
const OTHER_REPO_PATH = path.resolve(path.sep, 'code', 'app-api-clone-2');
const NOW = new Date('2026-09-24T10:00:00.000Z');
const THIS_PID = 4242;
const REMOTE_URL = 'git@host:acme-widgets/app-api.git';

function buildDeps(
  storage: InMemoryDeviceStorage,
  workspace: FakeWorkspaceRepository,
  overrides: Partial<RemoveRepositoryDeps> = {},
): RemoveRepositoryDeps {
  return {
    storage,
    workspace,
    projectLock: new FakeProjectLock(),
    processControl: new ControllableProcessControl(),
    clock: new FakeClock(NOW),
    seeyaHome: SEEYA_HOME,
    sessionId: undefined,
    pid: THIS_PID,
    procStart: undefined,
    ...overrides,
  };
}

async function setUpProjectsForOneRepo(
  storage: InMemoryDeviceStorage,
  workspace: FakeWorkspaceRepository,
): Promise<void> {
  await createProject(
    {
      storage,
      workspace,
      projectLock: new FakeProjectLock(),
      processControl: new ControllableProcessControl(),
      seeyaHome: SEEYA_HOME,
      sessionId: undefined,
      nodePath: 'node',
      cliEntryPath: '/fake/cli-entry.js',
    },
    'auth-hardening',
  );
  await addRepository(
    {
      storage,
      workspace,
      gitReader: new FakeGitReaderWithRemote(new Map([[REPO_PATH, REMOTE_URL]])),
      directoryExistence: new FakeDirectoryExistence(new Set([REPO_PATH])),
      seeyaHome: SEEYA_HOME,
      sessionId: undefined,
    },
    'auth-hardening',
    REPO_PATH,
  );
}

describe('removeRepository', () => {
  let storage: InMemoryDeviceStorage;
  let workspace: FakeWorkspaceRepository;

  beforeEach(() => {
    storage = new InMemoryDeviceStorage(DEFAULT_TEST_CONFIG);
    workspace = new FakeWorkspaceRepository();
  });

  it('refuses an invalid project id without touching any port', async () => {
    const result = await removeRepository(buildDeps(storage, workspace), 'Not Valid', 'app-api');
    expect(result).toEqual({ kind: 'invalidId', projectId: 'Not Valid' });
  });

  it('reports projectNotFound for an id never created', async () => {
    const result = await removeRepository(buildDeps(storage, workspace), 'ghost', 'app-api');
    expect(result).toEqual({ kind: 'projectNotFound', projectId: 'ghost' });
  });

  it('reports repositoryNotFound when the project has no such repository associated', async () => {
    await createProject(
      {
        storage,
        workspace,
        projectLock: new FakeProjectLock(),
        processControl: new ControllableProcessControl(),
        seeyaHome: SEEYA_HOME,
        sessionId: undefined,
        nodePath: 'node',
        cliEntryPath: '/fake/cli-entry.js',
      },
      'auth-hardening',
    );
    const result = await removeRepository(buildDeps(storage, workspace), 'auth-hardening', 'ghost');
    expect(result).toEqual({
      kind: 'repositoryNotFound',
      projectId: 'auth-hardening',
      name: 'ghost',
    });
  });

  it('refuses when the project is locked by another LIVE session (D-047 item 8)', async () => {
    await setUpProjectsForOneRepo(storage, workspace);
    const projectLock = new FakeProjectLock();
    await projectLock.write(WORKSPACE_ROOT, 'auth-hardening', {
      sessionId: 'other-session',
      pid: 555,
      procStart: undefined,
      acquiredAt: new Date('2026-09-24T09:00:00.000Z'),
    });
    const processControl = new ControllableProcessControl(new Map([[555, true]]));

    const result = await removeRepository(
      buildDeps(storage, workspace, { projectLock, processControl }),
      'auth-hardening',
      'app-api',
    );
    expect(result.kind).toBe('projectLocked');
    const manifest = await workspace.readProjectManifest(WORKSPACE_ROOT, 'auth-hardening');
    expect(manifest?.repositories).toHaveLength(1); // untouched
  });

  it('removes the repository from seeya.json and commits it', async () => {
    await setUpProjectsForOneRepo(storage, workspace);

    const result = await removeRepository(
      buildDeps(storage, workspace),
      'auth-hardening',
      'app-api',
    );

    expect(result).toEqual({ kind: 'removed', projectId: 'auth-hardening', name: 'app-api' });
    const manifest = await workspace.readProjectManifest(WORKSPACE_ROOT, 'auth-hardening');
    expect(manifest?.repositories).toEqual([]);
    expect(workspace.commitMessages.at(-1)).toContain(
      'Remove repository app-api from project auth-hardening',
    );
  });

  it('drops the identity-keyed map entry when no other project still uses it', async () => {
    await setUpProjectsForOneRepo(storage, workspace);
    expect(await storage.readRepositoryMap()).toHaveLength(1);

    await removeRepository(buildDeps(storage, workspace), 'auth-hardening', 'app-api');

    expect(await storage.readRepositoryMap()).toEqual([]);
  });

  it('keeps the identity-keyed map entry when ANOTHER project still uses the same identity', async () => {
    await setUpProjectsForOneRepo(storage, workspace);
    await createProject(
      {
        storage,
        workspace,
        projectLock: new FakeProjectLock(),
        processControl: new ControllableProcessControl(),
        seeyaHome: SEEYA_HOME,
        sessionId: undefined,
        nodePath: 'node',
        cliEntryPath: '/fake/cli-entry.js',
      },
      'billing-v2',
    );
    await addRepository(
      {
        storage,
        workspace,
        gitReader: new FakeGitReaderWithRemote(new Map([[OTHER_REPO_PATH, REMOTE_URL]])),
        directoryExistence: new FakeDirectoryExistence(new Set([OTHER_REPO_PATH])),
        seeyaHome: SEEYA_HOME,
        sessionId: undefined,
      },
      'billing-v2',
      OTHER_REPO_PATH,
    );

    await removeRepository(buildDeps(storage, workspace), 'auth-hardening', 'app-api');

    const map = await storage.readRepositoryMap();
    expect(map).toHaveLength(1);
    expect(map[0]).toMatchObject({ path: OTHER_REPO_PATH });
  });

  it("drops a no-remote repository's map entry unconditionally (it is keyed by this project alone)", async () => {
    await createProject(
      {
        storage,
        workspace,
        projectLock: new FakeProjectLock(),
        processControl: new ControllableProcessControl(),
        seeyaHome: SEEYA_HOME,
        sessionId: undefined,
        nodePath: 'node',
        cliEntryPath: '/fake/cli-entry.js',
      },
      'auth-hardening',
    );
    // No remote at all — `FakeGitReaderWithRemote` with an empty map reports `null` for any path.
    await addRepository(
      {
        storage,
        workspace,
        gitReader: new FakeGitReaderWithRemote(),
        directoryExistence: new FakeDirectoryExistence(new Set([REPO_PATH])),
        seeyaHome: SEEYA_HOME,
        sessionId: undefined,
      },
      'auth-hardening',
      REPO_PATH,
    );
    expect(await storage.readRepositoryMap()).toHaveLength(1);

    const result = await removeRepository(
      buildDeps(storage, workspace),
      'auth-hardening',
      'app-api',
    );

    expect(result).toEqual({ kind: 'removed', projectId: 'auth-hardening', name: 'app-api' });
    expect(await storage.readRepositoryMap()).toEqual([]);
  });
});
