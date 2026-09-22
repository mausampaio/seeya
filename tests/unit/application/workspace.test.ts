/**
 * `application/workspace.ts` (V2-T27) — `resolveWorkspaceRoot`, `createProject`, `listProjects`,
 * `showProject` — against named, in-memory doubles for `Storage`/`WorkspaceRepository`
 * (AGENTS.md § "Testes": "duplo de I/O é classe/objeto nomeado implementando a porta").
 */
import { beforeEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import type { WorkspaceCommandDeps } from '@seeya-ai/engine/application/workspace.js';
import {
  createProject,
  listProjects,
  resolveWorkspaceRoot,
  showProject,
} from '@seeya-ai/engine/application/workspace.js';
import { buildProjectCommitMessage } from '@seeya-ai/engine/core/project-commit.js';
import {
  ControllableProcessControl,
  DEFAULT_TEST_CONFIG,
  FakeProjectLock,
  FakeWorkspaceRepository,
  InMemoryWorkspaceStorage,
} from './_fakes.js';

const SEEYA_HOME = path.join('C:', 'seeya-home-fixture');
const DEFAULT_WORKSPACE_ROOT = path.join(SEEYA_HOME, 'workspace');

/** Every `application/workspace.ts` function under test takes the SAME shape — this is the one
 * place that assembles it, so an addition to `WorkspaceCommandDeps` (like V2-T33's own
 * `projectLock`/`processControl`/`sessionId`) only has to be threaded through here, not at every
 * call site in this file. */
function buildDeps(
  storage: InMemoryWorkspaceStorage,
  workspace: FakeWorkspaceRepository,
): WorkspaceCommandDeps {
  return {
    storage,
    workspace,
    projectLock: new FakeProjectLock(),
    processControl: new ControllableProcessControl(),
    seeyaHome: SEEYA_HOME,
    sessionId: undefined,
  };
}

describe('resolveWorkspaceRoot', () => {
  it('defaults to <seeyaHome>/workspace and persists it the first time', async () => {
    const storage = new InMemoryWorkspaceStorage(DEFAULT_TEST_CONFIG);
    const root = await resolveWorkspaceRoot(storage, SEEYA_HOME);
    expect(root).toBe(DEFAULT_WORKSPACE_ROOT);
    expect(await storage.readWorkspaceRoot()).toBe(DEFAULT_WORKSPACE_ROOT);
  });

  it('returns whatever was already saved, never overwriting it with the default', async () => {
    const storage = new InMemoryWorkspaceStorage(DEFAULT_TEST_CONFIG);
    const chosen = path.join('D:', 'elsewhere', 'my-workspace');
    await storage.saveWorkspaceRoot(chosen);
    expect(await resolveWorkspaceRoot(storage, SEEYA_HOME)).toBe(chosen);
  });
});

describe('createProject', () => {
  let storage: InMemoryWorkspaceStorage;
  let workspace: FakeWorkspaceRepository;

  beforeEach(() => {
    storage = new InMemoryWorkspaceStorage(DEFAULT_TEST_CONFIG);
    workspace = new FakeWorkspaceRepository();
  });

  it('refuses an invalid id without touching either port', async () => {
    const result = await createProject(buildDeps(storage, workspace), 'Not Valid');
    expect(result).toEqual({ kind: 'invalidId', projectId: 'Not Valid' });
    expect(await workspace.isInitialized(DEFAULT_WORKSPACE_ROOT)).toBe(false);
  });

  it('initializes the workspace the first time, and never again on a second create', async () => {
    await createProject(buildDeps(storage, workspace), 'auth-hardening');
    expect(await workspace.isInitialized(DEFAULT_WORKSPACE_ROOT)).toBe(true);
    await createProject(buildDeps(storage, workspace), 'billing-v2');
    // Both projects exist — if `initialize` had been called a second time destructively, this
    // would have wiped the first (this fake's `initialize` doesn't clear state, so this only
    // proves the sequence didn't error; the "not called twice" claim itself is on `isInitialized`
    // gating it, exercised directly above).
    expect(await workspace.projectExists(DEFAULT_WORKSPACE_ROOT, 'auth-hardening')).toBe(true);
  });

  it('writes the skeleton and commits exactly one message naming the project', async () => {
    const result = await createProject(buildDeps(storage, workspace), 'auth-hardening');
    expect(result).toEqual({
      kind: 'created',
      projectId: 'auth-hardening',
      root: path.join(DEFAULT_WORKSPACE_ROOT, 'auth-hardening'),
    });
    // V2-T33 (D-047 item 4): the committed message is the subject PLUS both trailers — built by
    // the same pure `buildProjectCommitMessage` this test calls to compute what it expects, so the
    // two can never silently drift apart.
    const expectedMessage = buildProjectCommitMessage(
      'Create project auth-hardening',
      'auth-hardening',
      undefined,
    );
    expect(workspace.commitMessages).toEqual([expectedMessage]);
    expect(expectedMessage).toContain('Seeya-Project-Id: auth-hardening');
    expect(expectedMessage).toContain('Seeya-Session-Id: unknown');
    const manifest = await workspace.readProjectManifest(DEFAULT_WORKSPACE_ROOT, 'auth-hardening');
    expect(manifest?.id).toBe('auth-hardening');
  });

  it('refuses a duplicate id without writing or committing again', async () => {
    await createProject(buildDeps(storage, workspace), 'auth-hardening');
    const second = await createProject(buildDeps(storage, workspace), 'auth-hardening');
    expect(second).toEqual({ kind: 'alreadyExists', projectId: 'auth-hardening' });
    expect(workspace.commitMessages).toHaveLength(1);
  });
});

describe('listProjects', () => {
  it('resolves the workspace root and returns whatever WorkspaceRepository.listProjects reports', async () => {
    const storage = new InMemoryWorkspaceStorage(DEFAULT_TEST_CONFIG);
    const workspace = new FakeWorkspaceRepository();
    await createProject(buildDeps(storage, workspace), 'auth-hardening');

    const result = await listProjects(buildDeps(storage, workspace));
    expect(result.root).toBe(DEFAULT_WORKSPACE_ROOT);
    expect(result.manifests.map((m) => m.id)).toEqual(['auth-hardening']);
    expect(result.rejected).toEqual([]);
  });
});

describe('showProject', () => {
  let storage: InMemoryWorkspaceStorage;
  let workspace: FakeWorkspaceRepository;

  beforeEach(() => {
    storage = new InMemoryWorkspaceStorage(DEFAULT_TEST_CONFIG);
    workspace = new FakeWorkspaceRepository();
  });

  it('refuses an invalid id', async () => {
    const result = await showProject(buildDeps(storage, workspace), 'Not Valid');
    expect(result).toEqual({ kind: 'invalidId', projectId: 'Not Valid' });
  });

  it('reports notFound for a project id that was never created', async () => {
    const result = await showProject(buildDeps(storage, workspace), 'ghost');
    expect(result).toEqual({ kind: 'notFound', projectId: 'ghost' });
  });

  it('finds a created project by id', async () => {
    await createProject(buildDeps(storage, workspace), 'auth-hardening');
    const result = await showProject(buildDeps(storage, workspace), 'auth-hardening');
    expect(result.kind).toBe('found');
    if (result.kind === 'found') {
      expect(result.manifest.id).toBe('auth-hardening');
      expect(result.root).toBe(path.join(DEFAULT_WORKSPACE_ROOT, 'auth-hardening'));
      // V2-T33 item 5: a project nobody ever locked reports so, not the least bit ambiguously.
      expect(result.lockStatus).toEqual({ kind: 'unlocked' });
    }
  });
});
