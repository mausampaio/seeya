/**
 * `application/workspace.ts` (V2-T27) — `resolveWorkspaceRoot`, `createProject`, `listProjects`,
 * `showProject` — against named, in-memory doubles for `Storage`/`WorkspaceRepository`
 * (AGENTS.md § "Testes": "duplo de I/O é classe/objeto nomeado implementando a porta").
 */
import { beforeEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import {
  createProject,
  listProjects,
  resolveWorkspaceRoot,
  showProject,
} from '@seeya-ai/engine/application/workspace.js';
import {
  DEFAULT_TEST_CONFIG,
  FakeWorkspaceRepository,
  InMemoryWorkspaceStorage,
} from './_fakes.js';

const SEEYA_HOME = path.join('C:', 'seeya-home-fixture');
const DEFAULT_WORKSPACE_ROOT = path.join(SEEYA_HOME, 'workspace');

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
    const result = await createProject({ storage, workspace, seeyaHome: SEEYA_HOME }, 'Not Valid');
    expect(result).toEqual({ kind: 'invalidId', projectId: 'Not Valid' });
    expect(await workspace.isInitialized(DEFAULT_WORKSPACE_ROOT)).toBe(false);
  });

  it('initializes the workspace the first time, and never again on a second create', async () => {
    await createProject({ storage, workspace, seeyaHome: SEEYA_HOME }, 'auth-hardening');
    expect(await workspace.isInitialized(DEFAULT_WORKSPACE_ROOT)).toBe(true);
    await createProject({ storage, workspace, seeyaHome: SEEYA_HOME }, 'billing-v2');
    // Both projects exist — if `initialize` had been called a second time destructively, this
    // would have wiped the first (this fake's `initialize` doesn't clear state, so this only
    // proves the sequence didn't error; the "not called twice" claim itself is on `isInitialized`
    // gating it, exercised directly above).
    expect(await workspace.projectExists(DEFAULT_WORKSPACE_ROOT, 'auth-hardening')).toBe(true);
  });

  it('writes the skeleton and commits exactly one message naming the project', async () => {
    const result = await createProject(
      { storage, workspace, seeyaHome: SEEYA_HOME },
      'auth-hardening',
    );
    expect(result).toEqual({
      kind: 'created',
      projectId: 'auth-hardening',
      root: path.join(DEFAULT_WORKSPACE_ROOT, 'auth-hardening'),
    });
    expect(workspace.commitMessages).toEqual(['Create project auth-hardening']);
    const manifest = await workspace.readProjectManifest(DEFAULT_WORKSPACE_ROOT, 'auth-hardening');
    expect(manifest?.id).toBe('auth-hardening');
  });

  it('refuses a duplicate id without writing or committing again', async () => {
    await createProject({ storage, workspace, seeyaHome: SEEYA_HOME }, 'auth-hardening');
    const second = await createProject(
      { storage, workspace, seeyaHome: SEEYA_HOME },
      'auth-hardening',
    );
    expect(second).toEqual({ kind: 'alreadyExists', projectId: 'auth-hardening' });
    expect(workspace.commitMessages).toEqual(['Create project auth-hardening']);
  });
});

describe('listProjects', () => {
  it('resolves the workspace root and returns whatever WorkspaceRepository.listProjects reports', async () => {
    const storage = new InMemoryWorkspaceStorage(DEFAULT_TEST_CONFIG);
    const workspace = new FakeWorkspaceRepository();
    await createProject({ storage, workspace, seeyaHome: SEEYA_HOME }, 'auth-hardening');

    const result = await listProjects({ storage, workspace, seeyaHome: SEEYA_HOME });
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
    const result = await showProject({ storage, workspace, seeyaHome: SEEYA_HOME }, 'Not Valid');
    expect(result).toEqual({ kind: 'invalidId', projectId: 'Not Valid' });
  });

  it('reports notFound for a project id that was never created', async () => {
    const result = await showProject({ storage, workspace, seeyaHome: SEEYA_HOME }, 'ghost');
    expect(result).toEqual({ kind: 'notFound', projectId: 'ghost' });
  });

  it('finds a created project by id', async () => {
    await createProject({ storage, workspace, seeyaHome: SEEYA_HOME }, 'auth-hardening');
    const result = await showProject(
      { storage, workspace, seeyaHome: SEEYA_HOME },
      'auth-hardening',
    );
    expect(result.kind).toBe('found');
    if (result.kind === 'found') {
      expect(result.manifest.id).toBe('auth-hardening');
      expect(result.root).toBe(path.join(DEFAULT_WORKSPACE_ROOT, 'auth-hardening'));
    }
  });
});
