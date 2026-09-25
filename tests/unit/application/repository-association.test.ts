/**
 * `addRepository` (V2-T28, `application/repository-association.ts`) — against the same named
 * doubles `application/workspace.test.ts` already uses, plus `FakeGitReaderWithRemote` for
 * `readRemoteUrl` and `FakeDirectoryExistence` for the local-path check.
 */
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AddRepositoryDeps } from '@seeya-ai/engine/application/repository-association.js';
import { addRepository } from '@seeya-ai/engine/application/repository-association.js';
import { createProject } from '@seeya-ai/engine/application/workspace.js';
import type { DirectoryExistence, GitReader } from '@seeya-ai/engine/core/ports.js';
import { buildProjectCommitMessage } from '@seeya-ai/engine/core/project-commit.js';
import {
  ControllableProcessControl,
  DEFAULT_TEST_CONFIG,
  FakeDirectoryExistence,
  FakeGitReaderWithRemote,
  FakeProjectLock,
  FakeWorkspaceRepository,
  InMemoryDeviceStorage,
} from './_fakes.js';

// Absolute on every OS on purpose: `path.join('C:', ...)` was absolute only on Windows, so on
// Linux/macOS the code under test (which `path.resolve`s the local path it is given) turned it
// into `<cwd>/C:/...` and every lookup missed -- green locally on Windows, red on CI (V2-T28).
const SEEYA_HOME = path.resolve(path.sep, 'seeya-home-fixture');
const WORKSPACE_ROOT = path.join(SEEYA_HOME, 'workspace');
const REPO_PATH = path.resolve(path.sep, 'code', 'app-api');

/** Same idea as `application/workspace.test.ts#buildDeps` — one place threading
 * `AddRepositoryDeps`'s V2-T33 additions (`sessionId`) through every call in this file. */
function buildAddRepoDeps(
  storage: InMemoryDeviceStorage,
  workspace: FakeWorkspaceRepository,
  gitReader: GitReader,
  directoryExistence: DirectoryExistence,
): AddRepositoryDeps {
  return {
    storage,
    workspace,
    gitReader,
    directoryExistence,
    seeyaHome: SEEYA_HOME,
    sessionId: undefined,
  };
}

describe('addRepository', () => {
  let storage: InMemoryDeviceStorage;
  let workspace: FakeWorkspaceRepository;

  beforeEach(async () => {
    storage = new InMemoryDeviceStorage(DEFAULT_TEST_CONFIG);
    workspace = new FakeWorkspaceRepository();
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
  });

  it('refuses an invalid project id without touching any port', async () => {
    const result = await addRepository(
      buildAddRepoDeps(
        storage,
        workspace,
        new FakeGitReaderWithRemote(),
        new FakeDirectoryExistence(new Set([REPO_PATH])),
      ),
      'Not Valid',
      REPO_PATH,
    );
    expect(result).toEqual({ kind: 'invalidId', projectId: 'Not Valid' });
  });

  it('reports projectNotFound for an id never created', async () => {
    const result = await addRepository(
      buildAddRepoDeps(
        storage,
        workspace,
        new FakeGitReaderWithRemote(),
        new FakeDirectoryExistence(new Set([REPO_PATH])),
      ),
      'ghost',
      REPO_PATH,
    );
    expect(result).toEqual({ kind: 'projectNotFound', projectId: 'ghost' });
  });

  it('reports pathNotFound when the given local path does not exist', async () => {
    const result = await addRepository(
      buildAddRepoDeps(
        storage,
        workspace,
        new FakeGitReaderWithRemote(),
        new FakeDirectoryExistence(),
      ),
      'auth-hardening',
      REPO_PATH,
    );
    expect(result).toEqual({ kind: 'pathNotFound', path: REPO_PATH });
  });

  it('adds a repository with a remote: identity derived, name from the path, committed', async () => {
    const result = await addRepository(
      buildAddRepoDeps(
        storage,
        workspace,
        new FakeGitReaderWithRemote(new Map([[REPO_PATH, 'git@host:acme-widgets/app-api.git']])),
        new FakeDirectoryExistence(new Set([REPO_PATH])),
      ),
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
    // V2-T33 (D-047 item 4): subject plus both trailers, built by `buildProjectCommitMessage`.
    expect(workspace.commitMessages.at(-1)).toBe(
      buildProjectCommitMessage(
        'Add repository app-api to project auth-hardening',
        'auth-hardening',
        undefined,
      ),
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
      buildAddRepoDeps(
        storage,
        workspace,
        new FakeGitReaderWithRemote(),
        new FakeDirectoryExistence(new Set([REPO_PATH])),
      ),
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
    const deps = buildAddRepoDeps(
      storage,
      workspace,
      new FakeGitReaderWithRemote(new Map([[REPO_PATH, 'git@host:acme-widgets/app-api.git']])),
      new FakeDirectoryExistence(new Set([REPO_PATH])),
    );
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
    const secondPath = path.resolve(path.sep, 'code', 'app-api-clone-2');
    const deps = buildAddRepoDeps(
      storage,
      workspace,
      new FakeGitReaderWithRemote(
        new Map([
          [REPO_PATH, 'git@host:acme-widgets/app-api.git'],
          [secondPath, 'https://host/acme-widgets/app-api.git'],
        ]),
      ),
      new FakeDirectoryExistence(new Set([REPO_PATH, secondPath])),
    );
    await addRepository(deps, 'auth-hardening', REPO_PATH);
    const second = await addRepository(deps, 'auth-hardening', secondPath);
    expect(second.kind).toBe('alreadyAssociated');
  });
});
