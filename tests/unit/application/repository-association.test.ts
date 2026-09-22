/**
 * `addRepository` (V2-T28, `application/repository-association.ts`) — against the same named
 * doubles `application/workspace.test.ts` already uses, plus `FakeGitReaderWithRemote` for
 * `readRemoteUrl` and `FakeDirectoryExistence` for the local-path check.
 */
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { addRepository } from '@seeya-ai/engine/application/repository-association.js';
import { createProject } from '@seeya-ai/engine/application/workspace.js';
import {
  DEFAULT_TEST_CONFIG,
  FakeDirectoryExistence,
  FakeGitReaderWithRemote,
  FakeWorkspaceRepository,
  InMemoryDeviceStorage,
} from './_fakes.js';

const SEEYA_HOME = path.join('C:', 'seeya-home-fixture');
const WORKSPACE_ROOT = path.join(SEEYA_HOME, 'workspace');
const REPO_PATH = path.join('C:', 'code', 'app-api');

describe('addRepository', () => {
  let storage: InMemoryDeviceStorage;
  let workspace: FakeWorkspaceRepository;

  beforeEach(async () => {
    storage = new InMemoryDeviceStorage(DEFAULT_TEST_CONFIG);
    workspace = new FakeWorkspaceRepository();
    await createProject({ storage, workspace, seeyaHome: SEEYA_HOME }, 'auth-hardening');
  });

  it('refuses an invalid project id without touching any port', async () => {
    const result = await addRepository(
      {
        storage,
        workspace,
        gitReader: new FakeGitReaderWithRemote(),
        directoryExistence: new FakeDirectoryExistence(new Set([REPO_PATH])),
        seeyaHome: SEEYA_HOME,
      },
      'Not Valid',
      REPO_PATH,
    );
    expect(result).toEqual({ kind: 'invalidId', projectId: 'Not Valid' });
  });

  it('reports projectNotFound for an id never created', async () => {
    const result = await addRepository(
      {
        storage,
        workspace,
        gitReader: new FakeGitReaderWithRemote(),
        directoryExistence: new FakeDirectoryExistence(new Set([REPO_PATH])),
        seeyaHome: SEEYA_HOME,
      },
      'ghost',
      REPO_PATH,
    );
    expect(result).toEqual({ kind: 'projectNotFound', projectId: 'ghost' });
  });

  it('reports pathNotFound when the given local path does not exist', async () => {
    const result = await addRepository(
      {
        storage,
        workspace,
        gitReader: new FakeGitReaderWithRemote(),
        directoryExistence: new FakeDirectoryExistence(),
        seeyaHome: SEEYA_HOME,
      },
      'auth-hardening',
      REPO_PATH,
    );
    expect(result).toEqual({ kind: 'pathNotFound', path: REPO_PATH });
  });

  it('adds a repository with a remote: identity derived, name from the path, committed', async () => {
    const result = await addRepository(
      {
        storage,
        workspace,
        gitReader: new FakeGitReaderWithRemote(
          new Map([[REPO_PATH, 'git@host:acme-widgets/app-api.git']]),
        ),
        directoryExistence: new FakeDirectoryExistence(new Set([REPO_PATH])),
        seeyaHome: SEEYA_HOME,
      },
      'auth-hardening',
      REPO_PATH,
    );
    expect(result).toEqual({
      kind: 'added',
      projectId: 'auth-hardening',
      name: 'app-api',
      hasRemote: true,
    });
    const manifest = await workspace.readProjectManifest(WORKSPACE_ROOT, 'auth-hardening');
    expect(manifest?.repositories).toEqual([
      {
        hasRemote: true,
        name: 'app-api',
        remote: 'git@host:acme-widgets/app-api.git',
        identity: { host: 'host', owner: 'acme-widgets', repository: 'app-api' },
      },
    ]);
    expect(workspace.commitMessages.at(-1)).toBe(
      'Add repository app-api to project auth-hardening',
    );
    expect(await storage.readRepositoryMap()).toEqual([
      {
        hasIdentity: true,
        identity: { host: 'host', owner: 'acme-widgets', repository: 'app-api' },
        path: REPO_PATH,
      },
    ]);
  });

  it('adds a repository with no remote: hasRemote false, keyed in the map by projectId+name', async () => {
    const result = await addRepository(
      {
        storage,
        workspace,
        gitReader: new FakeGitReaderWithRemote(),
        directoryExistence: new FakeDirectoryExistence(new Set([REPO_PATH])),
        seeyaHome: SEEYA_HOME,
      },
      'auth-hardening',
      REPO_PATH,
    );
    expect(result).toEqual({
      kind: 'added',
      projectId: 'auth-hardening',
      name: 'app-api',
      hasRemote: false,
    });
    const manifest = await workspace.readProjectManifest(WORKSPACE_ROOT, 'auth-hardening');
    expect(manifest?.repositories).toEqual([{ hasRemote: false, name: 'app-api' }]);
    expect(await storage.readRepositoryMap()).toEqual([
      { hasIdentity: false, projectId: 'auth-hardening', name: 'app-api', path: REPO_PATH },
    ]);
  });

  it('adding the same repository (same remote identity) twice reports alreadyAssociated, never duplicates', async () => {
    const deps = {
      storage,
      workspace,
      gitReader: new FakeGitReaderWithRemote(
        new Map([[REPO_PATH, 'git@host:acme-widgets/app-api.git']]),
      ),
      directoryExistence: new FakeDirectoryExistence(new Set([REPO_PATH])),
      seeyaHome: SEEYA_HOME,
    };
    await addRepository(deps, 'auth-hardening', REPO_PATH);
    const second = await addRepository(deps, 'auth-hardening', REPO_PATH);
    expect(second).toEqual({
      kind: 'alreadyAssociated',
      projectId: 'auth-hardening',
      name: 'app-api',
    });
    const manifest = await workspace.readProjectManifest(WORKSPACE_ROOT, 'auth-hardening');
    expect(manifest?.repositories).toHaveLength(1);
  });

  it('the SAME remote reached from a different local path (SSH vs HTTPS clone) is also alreadyAssociated', async () => {
    const secondPath = path.join('C:', 'code', 'app-api-clone-2');
    const deps = {
      storage,
      workspace,
      gitReader: new FakeGitReaderWithRemote(
        new Map([
          [REPO_PATH, 'git@host:acme-widgets/app-api.git'],
          [secondPath, 'https://host/acme-widgets/app-api.git'],
        ]),
      ),
      directoryExistence: new FakeDirectoryExistence(new Set([REPO_PATH, secondPath])),
      seeyaHome: SEEYA_HOME,
    };
    await addRepository(deps, 'auth-hardening', REPO_PATH);
    const second = await addRepository(deps, 'auth-hardening', secondPath);
    expect(second.kind).toBe('alreadyAssociated');
  });
});
