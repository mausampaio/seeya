/**
 * `openProject` (V2-T28, `application/project-open.ts`) — against the same named doubles
 * `repository-association.test.ts` uses, plus `FakeHarnessLauncher`.
 */
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { openProject } from '@seeya-ai/engine/application/project-open.js';
import { addRepository } from '@seeya-ai/engine/application/repository-association.js';
import { createProject } from '@seeya-ai/engine/application/workspace.js';
import type { MissingRepositoryRecord } from '@seeya-ai/engine/application/project-open.js';
import {
  DEFAULT_TEST_CONFIG,
  FakeDirectoryExistence,
  FakeGitReaderWithRemote,
  FakeHarnessLauncher,
  FakeWorkspaceRepository,
  InMemoryDeviceStorage,
} from './_fakes.js';

// Absolute on every OS on purpose: `path.join('C:', ...)` was absolute only on Windows, so on
// Linux/macOS the code under test (which `path.resolve`s the local path it is given) turned it
// into `<cwd>/C:/...` and every lookup missed -- green locally on Windows, red on CI (V2-T28).
const SEEYA_HOME = path.resolve(path.sep, 'seeya-home-fixture');
const WORKSPACE_ROOT = path.join(SEEYA_HOME, 'workspace');
const PROJECT_DIR = path.join(WORKSPACE_ROOT, 'auth-hardening');
const REPO_PATH = path.resolve(path.sep, 'code', 'app-api');

describe('openProject', () => {
  let storage: InMemoryDeviceStorage;
  let workspace: FakeWorkspaceRepository;

  beforeEach(async () => {
    storage = new InMemoryDeviceStorage(DEFAULT_TEST_CONFIG);
    workspace = new FakeWorkspaceRepository();
    await createProject({ storage, workspace, seeyaHome: SEEYA_HOME }, 'auth-hardening');
  });

  it('refuses an invalid project id without touching any port', async () => {
    const harnessLauncher = new FakeHarnessLauncher();
    const result = await openProject(
      {
        storage,
        workspace,
        directoryExistence: new FakeDirectoryExistence(),
        harnessLauncher,
        seeyaHome: SEEYA_HOME,
      },
      'Not Valid',
    );
    expect(result).toEqual({ kind: 'invalidId', projectId: 'Not Valid' });
    expect(harnessLauncher.calls).toHaveLength(0);
  });

  it('reports notFound for an id never created', async () => {
    const result = await openProject(
      {
        storage,
        workspace,
        directoryExistence: new FakeDirectoryExistence(),
        harnessLauncher: new FakeHarnessLauncher(),
        seeyaHome: SEEYA_HOME,
      },
      'ghost',
    );
    expect(result).toEqual({ kind: 'notFound', projectId: 'ghost' });
  });

  it('reports noHarnessChosen when the project has no defaultHarness and none is given', async () => {
    const result = await openProject(
      {
        storage,
        workspace,
        directoryExistence: new FakeDirectoryExistence(),
        harnessLauncher: new FakeHarnessLauncher(),
        seeyaHome: SEEYA_HOME,
      },
      'auth-hardening',
    );
    expect(result).toEqual({ kind: 'noHarnessChosen', projectId: 'auth-hardening' });
  });

  it('reports unsupportedHarness for anything other than claude (item 5)', async () => {
    const result = await openProject(
      {
        storage,
        workspace,
        directoryExistence: new FakeDirectoryExistence(),
        harnessLauncher: new FakeHarnessLauncher(),
        seeyaHome: SEEYA_HOME,
      },
      'auth-hardening',
      'codex',
    );
    expect(result).toEqual({ kind: 'unsupportedHarness', harness: 'codex' });
  });

  it('opens claude with the project directory as cwd and no --add-dir when there are no repositories', async () => {
    const harnessLauncher = new FakeHarnessLauncher();
    const result = await openProject(
      {
        storage,
        workspace,
        directoryExistence: new FakeDirectoryExistence(),
        harnessLauncher,
        seeyaHome: SEEYA_HOME,
      },
      'auth-hardening',
      'claude',
    );
    expect(result).toEqual({
      kind: 'opened',
      projectId: 'auth-hardening',
      harness: 'claude',
      exitCode: 0,
      addedDirs: [],
      missing: [],
    });
    expect(harnessLauncher.calls).toEqual([{ cwd: PROJECT_DIR, addDirs: [] }]);
  });

  it('adds --add-dir for a repository whose local path is registered and still exists', async () => {
    const gitReader = new FakeGitReaderWithRemote(
      new Map([[REPO_PATH, 'git@host:acme-widgets/app-api.git']]),
    );
    const directoryExistence = new FakeDirectoryExistence(new Set([REPO_PATH]));
    await addRepository(
      { storage, workspace, gitReader, directoryExistence, seeyaHome: SEEYA_HOME },
      'auth-hardening',
      REPO_PATH,
    );

    const harnessLauncher = new FakeHarnessLauncher();
    const result = await openProject(
      { storage, workspace, directoryExistence, harnessLauncher, seeyaHome: SEEYA_HOME },
      'auth-hardening',
      'claude',
    );
    expect(result.kind).toBe('opened');
    if (result.kind === 'opened') {
      expect(result.addedDirs).toEqual([REPO_PATH]);
      expect(result.missing).toEqual([]);
    }
    expect(harnessLauncher.calls).toEqual([{ cwd: PROJECT_DIR, addDirs: [REPO_PATH] }]);
  });

  it('item 4: a repository never registered on this device is reported missing, notInDeviceMap — open continues anyway', async () => {
    const manifest = await workspace.readProjectManifest(WORKSPACE_ROOT, 'auth-hardening');
    await workspace.writeProjectManifest(WORKSPACE_ROOT, 'auth-hardening', {
      ...manifest!,
      repositories: [{ hasRemote: false, name: 'frontend' }],
    });

    const harnessLauncher = new FakeHarnessLauncher();
    let observedBeforeLaunch: readonly MissingRepositoryRecord[] | undefined;
    const result = await openProject(
      {
        storage,
        workspace,
        directoryExistence: new FakeDirectoryExistence(),
        harnessLauncher,
        seeyaHome: SEEYA_HOME,
      },
      'auth-hardening',
      'claude',
      (missing) => {
        observedBeforeLaunch = missing;
      },
    );
    expect(result.kind).toBe('opened');
    if (result.kind === 'opened') {
      expect(result.addedDirs).toEqual([]);
      expect(result.missing).toEqual([{ name: 'frontend', reason: 'notInDeviceMap' }]);
    }
    // The callback fires with the SAME list, BEFORE the launcher is called (its own docstring's
    // promise) — proven here by asserting it happened at all, not just that the final result
    // carries it too.
    expect(observedBeforeLaunch).toEqual([{ name: 'frontend', reason: 'notInDeviceMap' }]);
    expect(harnessLauncher.calls).toEqual([{ cwd: PROJECT_DIR, addDirs: [] }]);
  });

  it('item 4: a registered repository whose local path no longer exists is reported missing, pathMissing', async () => {
    const gitReader = new FakeGitReaderWithRemote(
      new Map([[REPO_PATH, 'git@host:acme-widgets/app-api.git']]),
    );
    await addRepository(
      {
        storage,
        workspace,
        gitReader,
        directoryExistence: new FakeDirectoryExistence(new Set([REPO_PATH])),
        seeyaHome: SEEYA_HOME,
      },
      'auth-hardening',
      REPO_PATH,
    );

    // The directory existed at add-repo time but has since vanished — a fresh, empty
    // `FakeDirectoryExistence` for `open` reproduces exactly that.
    const harnessLauncher = new FakeHarnessLauncher();
    const result = await openProject(
      {
        storage,
        workspace,
        directoryExistence: new FakeDirectoryExistence(),
        harnessLauncher,
        seeyaHome: SEEYA_HOME,
      },
      'auth-hardening',
      'claude',
    );
    expect(result.kind).toBe('opened');
    if (result.kind === 'opened') {
      expect(result.missing).toEqual([{ name: 'app-api', reason: 'pathMissing', path: REPO_PATH }]);
    }
  });

  it('reports failedToStart when the harness never actually spawned', async () => {
    const harnessLauncher = new FakeHarnessLauncher({ kind: 'failedToStart' });
    const result = await openProject(
      {
        storage,
        workspace,
        directoryExistence: new FakeDirectoryExistence(),
        harnessLauncher,
        seeyaHome: SEEYA_HOME,
      },
      'auth-hardening',
      'claude',
    );
    expect(result).toEqual({
      kind: 'failedToStart',
      projectId: 'auth-hardening',
      harness: 'claude',
    });
  });

  it('--with overrides defaultHarness for this call only — never persisted', async () => {
    const harnessLauncher = new FakeHarnessLauncher();
    await openProject(
      {
        storage,
        workspace,
        directoryExistence: new FakeDirectoryExistence(),
        harnessLauncher,
        seeyaHome: SEEYA_HOME,
      },
      'auth-hardening',
      'claude',
    );
    const manifest = await workspace.readProjectManifest(WORKSPACE_ROOT, 'auth-hardening');
    expect(manifest?.defaultHarness).toBeNull();
  });
});
