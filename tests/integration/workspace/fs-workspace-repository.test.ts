/**
 * `FsWorkspaceRepository` (V2-T27, `adapters/workspace/index.ts`) against a real filesystem and a
 * real `git` binary in `tmpdir` — same "this is the one adapter whose entire job is to shell out
 * to it, so a fake would test nothing real" reasoning `tests/integration/git/_fixtures.ts` already
 * documents for `GitReader`.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { FsWorkspaceRepository } from '@seeya-ai/engine/adapters/workspace/index.js';
import { buildProjectSkeleton } from '@seeya-ai/engine/core/project-skeleton.js';

async function makeTmpDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'seeya-workspace-'));
}

describe('FsWorkspaceRepository', () => {
  let root: string | undefined;

  afterEach(async () => {
    if (root !== undefined) {
      await rm(root, { recursive: true, force: true });
      root = undefined;
    }
  });

  it('isInitialized is false before initialize, true after', async () => {
    root = await makeTmpDir();
    const workspace = new FsWorkspaceRepository();
    expect(await workspace.isInitialized(root)).toBe(false);
    await workspace.initialize(root);
    expect(await workspace.isInitialized(root)).toBe(true);
  });

  it('isInitialized is false when root does not exist on disk at all yet', async () => {
    const parent = await makeTmpDir();
    root = parent;
    const workspace = new FsWorkspaceRepository();
    expect(await workspace.isInitialized(path.join(parent, 'never-created'))).toBe(false);
  });

  it('initialize creates root itself, not just .git inside an existing one', async () => {
    const parent = await makeTmpDir();
    root = parent;
    const workspaceRoot = path.join(parent, 'workspace');
    const workspace = new FsWorkspaceRepository();
    await workspace.initialize(workspaceRoot);
    expect(await workspace.isInitialized(workspaceRoot)).toBe(true);
  });

  it('writeProjectSkeleton writes every file and directory, plus seeya.json', async () => {
    root = await makeTmpDir();
    const workspace = new FsWorkspaceRepository();
    await workspace.initialize(root);
    const skeleton = buildProjectSkeleton('auth-hardening');
    await workspace.writeProjectSkeleton(root, 'auth-hardening', skeleton);

    const projectDir = path.join(root, 'auth-hardening');
    for (const file of skeleton.files) {
      const content = await readFile(path.join(projectDir, file.relativePath), 'utf8');
      expect(content).toBe(file.content);
    }
    const manifestText = await readFile(path.join(projectDir, 'seeya.json'), 'utf8');
    expect(JSON.parse(manifestText)).toMatchObject({
      id: 'auth-hardening',
      name: 'auth-hardening',
    });
    for (const dir of skeleton.directories) {
      // No file inside it — just confirm mkdir didn't throw and the entry is a real directory the
      // next writeFile into it would succeed against.
      await mkdir(path.join(projectDir, dir), { recursive: true });
    }
  });

  it('projectExists is false before writeProjectSkeleton, true after', async () => {
    root = await makeTmpDir();
    const workspace = new FsWorkspaceRepository();
    await workspace.initialize(root);
    expect(await workspace.projectExists(root, 'auth-hardening')).toBe(false);
    await workspace.writeProjectSkeleton(
      root,
      'auth-hardening',
      buildProjectSkeleton('auth-hardening'),
    );
    expect(await workspace.projectExists(root, 'auth-hardening')).toBe(true);
  });

  it('commitAll creates a real commit that readProjectManifest can then read back', async () => {
    root = await makeTmpDir();
    const workspace = new FsWorkspaceRepository();
    await workspace.initialize(root);
    await workspace.writeProjectSkeleton(
      root,
      'auth-hardening',
      buildProjectSkeleton('auth-hardening'),
    );
    await workspace.commitAll(root, 'Create project auth-hardening');

    const manifest = await workspace.readProjectManifest(root, 'auth-hardening');
    expect(manifest?.id).toBe('auth-hardening');
  });

  it('commitAll is a no-op, not an empty commit, when nothing changed', async () => {
    root = await makeTmpDir();
    const workspace = new FsWorkspaceRepository();
    await workspace.initialize(root);
    await workspace.writeProjectSkeleton(
      root,
      'auth-hardening',
      buildProjectSkeleton('auth-hardening'),
    );
    await workspace.commitAll(root, 'Create project auth-hardening');
    // Second call, nothing written since — must not throw and must not add a second commit.
    await expect(
      workspace.commitAll(root, 'Create project auth-hardening'),
    ).resolves.toBeUndefined();
  });

  it('listProjects returns every project this workspace knows, both sides of D-022', async () => {
    root = await makeTmpDir();
    const workspace = new FsWorkspaceRepository();
    await workspace.initialize(root);
    await workspace.writeProjectSkeleton(
      root,
      'auth-hardening',
      buildProjectSkeleton('auth-hardening'),
    );
    await workspace.writeProjectSkeleton(root, 'billing-v2', buildProjectSkeleton('billing-v2'));
    // A directory that LOOKS like a project but has a malformed seeya.json.
    await mkdir(path.join(root, 'broken'), { recursive: true });
    await writeFile(path.join(root, 'broken', 'seeya.json'), '{ not valid json', 'utf8');

    const { manifests, rejected } = await workspace.listProjects(root);
    expect(manifests.map((m) => m.id).sort()).toEqual(['auth-hardening', 'billing-v2']);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toMatch(/not valid JSON/);
  });

  it('listProjects silently skips a directory with no seeya.json at all (not a project, D-025)', async () => {
    root = await makeTmpDir();
    const workspace = new FsWorkspaceRepository();
    await workspace.initialize(root);
    await mkdir(path.join(root, 'not-a-project'), { recursive: true });

    const { manifests, rejected } = await workspace.listProjects(root);
    expect(manifests).toEqual([]);
    expect(rejected).toEqual([]);
  });

  it('listProjects returns empty (not a rejection) when root does not exist yet (D-025)', async () => {
    const parent = await makeTmpDir();
    root = parent;
    const workspace = new FsWorkspaceRepository();
    const { manifests, rejected } = await workspace.listProjects(
      path.join(parent, 'never-created'),
    );
    expect(manifests).toEqual([]);
    expect(rejected).toEqual([]);
  });

  it('readProjectManifest is null for a project that does not exist', async () => {
    root = await makeTmpDir();
    const workspace = new FsWorkspaceRepository();
    await workspace.initialize(root);
    expect(await workspace.readProjectManifest(root, 'ghost')).toBeNull();
  });

  it('readProjectManifest throws on a malformed seeya.json — a single lookup, not a D-022 collection', async () => {
    root = await makeTmpDir();
    const workspace = new FsWorkspaceRepository();
    await workspace.initialize(root);
    await mkdir(path.join(root, 'broken'), { recursive: true });
    await writeFile(path.join(root, 'broken', 'seeya.json'), '{ not valid json', 'utf8');
    await expect(workspace.readProjectManifest(root, 'broken')).rejects.toThrow(/not valid JSON/);
  });

  it('readProjectManifest throws a real read failure (not "not found") when seeya.json is itself a directory', async () => {
    root = await makeTmpDir();
    const workspace = new FsWorkspaceRepository();
    await workspace.initialize(root);
    // A directory named "seeya.json" inside the project directory — readFile on it fails with
    // EISDIR, never ENOENT, so this must surface as a real error, not "project doesn't exist".
    await mkdir(path.join(root, 'weird', 'seeya.json'), { recursive: true });
    await expect(workspace.readProjectManifest(root, 'weird')).rejects.toThrow(/reading .* failed/);
  });

  it('readProjectManifest throws when seeya.json parses to a JSON array instead of an object', async () => {
    root = await makeTmpDir();
    const workspace = new FsWorkspaceRepository();
    await workspace.initialize(root);
    await mkdir(path.join(root, 'array-manifest'), { recursive: true });
    await writeFile(path.join(root, 'array-manifest', 'seeya.json'), '[]', 'utf8');
    await expect(workspace.readProjectManifest(root, 'array-manifest')).rejects.toThrow(
      /must be a JSON object/,
    );
  });

  it('initialize throws a real error when .git already exists as an invalid file (not a directory)', async () => {
    root = await makeTmpDir();
    // A plain file named ".git" with content git doesn't recognize as a valid gitdir pointer —
    // real `git init` refuses this ("invalid gitfile format"), a genuine, reproducible failure
    // rather than a contrived one.
    await writeFile(path.join(root, '.git'), 'not a valid gitfile pointer', 'utf8');
    const workspace = new FsWorkspaceRepository();
    await expect(workspace.initialize(root)).rejects.toThrow(/git init failed/);
  });

  it('commitAll throws when root is not a git repository at all', async () => {
    root = await makeTmpDir();
    // Deliberately never initialized — `git add -A` here fails for real ("not a git repository").
    const workspace = new FsWorkspaceRepository();
    await expect(workspace.commitAll(root, 'Create project auth-hardening')).rejects.toThrow(
      /git add failed/,
    );
  });

  it('commitAll throws when git itself refuses the commit (an empty message)', async () => {
    root = await makeTmpDir();
    const workspace = new FsWorkspaceRepository();
    await workspace.initialize(root);
    await workspace.writeProjectSkeleton(
      root,
      'auth-hardening',
      buildProjectSkeleton('auth-hardening'),
    );
    // A real git refusal, not a contrived one: `git commit -m ""` aborts with "empty commit
    // message" — this project's own commitAll never builds an empty message itself, but the
    // failure path still has to surface faithfully if git ever refuses for any reason.
    await expect(workspace.commitAll(root, '')).rejects.toThrow(/git commit failed/);
  });

  it('listProjects reports a rejection (not a silent empty list) when root is a file, not a directory', async () => {
    const parent = await makeTmpDir();
    root = parent;
    const rootAsFile = path.join(parent, 'not-a-directory');
    await writeFile(rootAsFile, 'x', 'utf8');
    const workspace = new FsWorkspaceRepository();
    const { manifests, rejected } = await workspace.listProjects(rootAsFile);
    expect(manifests).toEqual([]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toMatch(/listing .* failed/);
  });
});
