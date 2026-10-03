/**
 * `FsWorkspaceRepository.listChangedFilesWithStats` (V2-T70, `docs/INTERFACE.md` § 7 item 2)
 * against a real `git` binary in `tmpdir` — same "a fake would test nothing real" reasoning
 * `fs-workspace-repository.test.ts` already documents for `listChangedFiles`.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { FsWorkspaceRepository } from '@seeya-ai/engine/adapters/workspace/index.js';
import { runGit } from '@seeya-ai/engine/adapters/git/run-git.js';
import { buildProjectSkeleton } from '@seeya-ai/engine/core/project-skeleton.js';
import { removeTempDir } from '../../_remove-temp-dir.js';

async function makeTmpDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'seeya-changed-file-stats-'));
}

describe('FsWorkspaceRepository.listChangedFilesWithStats', () => {
  let root: string | undefined;

  afterEach(async () => {
    if (root !== undefined) {
      await removeTempDir(root);
      root = undefined;
    }
  });

  it('is empty right after a project is created and committed — nothing pending', async () => {
    root = await makeTmpDir();
    const workspace = new FsWorkspaceRepository();
    await workspace.initialize(root);
    await workspace.writeProjectSkeleton(
      root,
      'auth-hardening',
      buildProjectSkeleton('auth-hardening'),
    );
    await workspace.commitAll(root, 'auth-hardening', 'Create project auth-hardening');

    expect(await workspace.listChangedFilesWithStats(root, 'auth-hardening')).toEqual([]);
  });

  it('reports a brand-new untracked file as added, with lines counted by reading it directly', async () => {
    root = await makeTmpDir();
    const workspace = new FsWorkspaceRepository();
    await workspace.initialize(root);
    await workspace.writeProjectSkeleton(
      root,
      'auth-hardening',
      buildProjectSkeleton('auth-hardening'),
    );
    await workspace.commitAll(root, 'auth-hardening', 'Create project auth-hardening');

    await writeFile(
      path.join(root, 'auth-hardening', 'context', 'know-how.md'),
      'line one\nline two\nline three\n',
      'utf8',
    );

    const entries = await workspace.listChangedFilesWithStats(root, 'auth-hardening');
    expect(entries).toEqual([
      {
        kind: 'added',
        path: path.posix.join('auth-hardening', 'context', 'know-how.md'),
        lines: { added: 3, removed: 0 },
      },
    ]);
  });

  it('reports a modified TRACKED file via git diff --numstat', async () => {
    root = await makeTmpDir();
    const workspace = new FsWorkspaceRepository();
    await workspace.initialize(root);
    await workspace.writeProjectSkeleton(
      root,
      'auth-hardening',
      buildProjectSkeleton('auth-hardening'),
    );
    await workspace.commitAll(root, 'auth-hardening', 'Create project auth-hardening');
    const tracked = path.join(root, 'auth-hardening', 'context', 'know-how.md');
    await writeFile(tracked, 'line one\nline two\n', 'utf8');
    await workspace.commitAll(root, 'auth-hardening', 'Add know-how notes');

    // No line in the replacement matches a line in the original — a clean 2-removed/5-added
    // diff, never git collapsing it into something ambiguous to assert against.
    await writeFile(tracked, 'alpha\nbeta\ngamma\ndelta\nepsilon\n', 'utf8');

    const entries = await workspace.listChangedFilesWithStats(root, 'auth-hardening');
    expect(entries).toEqual([
      {
        kind: 'modified',
        path: path.posix.join('auth-hardening', 'context', 'know-how.md'),
        lines: { added: 5, removed: 2 },
      },
    ]);
  });

  it('reports a deleted TRACKED file as deleted, with removed lines from numstat and added 0', async () => {
    root = await makeTmpDir();
    const workspace = new FsWorkspaceRepository();
    await workspace.initialize(root);
    await workspace.writeProjectSkeleton(
      root,
      'auth-hardening',
      buildProjectSkeleton('auth-hardening'),
    );
    await workspace.commitAll(root, 'auth-hardening', 'Create project auth-hardening');
    const tracked = path.join(root, 'auth-hardening', 'context', 'know-how.md');
    await writeFile(tracked, 'line one\nline two\nline three\n', 'utf8');
    await workspace.commitAll(root, 'auth-hardening', 'Add know-how notes');

    await rm(tracked);

    const entries = await workspace.listChangedFilesWithStats(root, 'auth-hardening');
    expect(entries).toEqual([
      {
        kind: 'deleted',
        path: path.posix.join('auth-hardening', 'context', 'know-how.md'),
        lines: { added: 0, removed: 3 },
      },
    ]);
  });

  it('reports a STAGED new file (git add, never committed) as added via the --cached numstat', async () => {
    root = await makeTmpDir();
    const workspace = new FsWorkspaceRepository();
    await workspace.initialize(root);
    await workspace.writeProjectSkeleton(
      root,
      'auth-hardening',
      buildProjectSkeleton('auth-hardening'),
    );
    await workspace.commitAll(root, 'auth-hardening', 'Create project auth-hardening');

    const newFile = path.join(root, 'auth-hardening', 'context', 'know-how.md');
    await writeFile(newFile, 'alpha\nbeta\n', 'utf8');
    const add = await runGit(root, [
      'add',
      path.posix.join('auth-hardening', 'context', 'know-how.md'),
    ]);
    expect(add.ran && add.exitCode === 0).toBe(true);

    const entries = await workspace.listChangedFilesWithStats(root, 'auth-hardening');
    expect(entries).toEqual([
      {
        kind: 'added',
        path: path.posix.join('auth-hardening', 'context', 'know-how.md'),
        lines: { added: 2, removed: 0 },
      },
    ]);
  });

  it('reports a brand-new, EMPTY untracked file as added, with lines {0, 0}', async () => {
    root = await makeTmpDir();
    const workspace = new FsWorkspaceRepository();
    await workspace.initialize(root);
    await workspace.writeProjectSkeleton(
      root,
      'auth-hardening',
      buildProjectSkeleton('auth-hardening'),
    );
    await workspace.commitAll(root, 'auth-hardening', 'Create project auth-hardening');

    await writeFile(path.join(root, 'auth-hardening', 'context', 'know-how.md'), '', 'utf8');

    const entries = await workspace.listChangedFilesWithStats(root, 'auth-hardening');
    expect(entries).toEqual([
      {
        kind: 'added',
        path: path.posix.join('auth-hardening', 'context', 'know-how.md'),
        lines: { added: 0, removed: 0 },
      },
    ]);
  });

  it('reports a modified TRACKED file that became binary, lines: null from the numstat dash', async () => {
    root = await makeTmpDir();
    const workspace = new FsWorkspaceRepository();
    await workspace.initialize(root);
    await workspace.writeProjectSkeleton(
      root,
      'auth-hardening',
      buildProjectSkeleton('auth-hardening'),
    );
    await workspace.commitAll(root, 'auth-hardening', 'Create project auth-hardening');
    const tracked = path.join(root, 'auth-hardening', 'context', 'know-how.md');
    await writeFile(tracked, 'line one\nline two\n', 'utf8');
    await workspace.commitAll(root, 'auth-hardening', 'Add know-how notes');

    await writeFile(tracked, Buffer.from([0x00, 0x01, 0x02, 0x03]));

    const entries = await workspace.listChangedFilesWithStats(root, 'auth-hardening');
    expect(entries).toEqual([
      {
        kind: 'modified',
        path: path.posix.join('auth-hardening', 'context', 'know-how.md'),
        lines: null,
      },
    ]);
  });

  it('reports a binary-looking untracked file with lines: null, never a fabricated count', async () => {
    root = await makeTmpDir();
    const workspace = new FsWorkspaceRepository();
    await workspace.initialize(root);
    await workspace.writeProjectSkeleton(
      root,
      'auth-hardening',
      buildProjectSkeleton('auth-hardening'),
    );
    await workspace.commitAll(root, 'auth-hardening', 'Create project auth-hardening');

    await writeFile(
      path.join(root, 'auth-hardening', 'context', 'data.bin'),
      Buffer.from([0x00, 0x01, 0x02, 0x03]),
    );

    const entries = await workspace.listChangedFilesWithStats(root, 'auth-hardening');
    expect(entries).toEqual([
      {
        kind: 'added',
        path: path.posix.join('auth-hardening', 'context', 'data.bin'),
        lines: null,
      },
    ]);
  });

  it("is scoped to ONE project — a second project's own pending change never leaks in (D-047 item 3)", async () => {
    root = await makeTmpDir();
    const workspace = new FsWorkspaceRepository();
    await workspace.initialize(root);
    await workspace.writeProjectSkeleton(
      root,
      'auth-hardening',
      buildProjectSkeleton('auth-hardening'),
    );
    await workspace.commitAll(root, 'auth-hardening', 'Create project auth-hardening');
    await workspace.writeProjectSkeleton(root, 'billing-v2', buildProjectSkeleton('billing-v2'));
    await workspace.commitAll(root, 'billing-v2', 'Create project billing-v2');

    await writeFile(path.join(root, 'auth-hardening', 'INDEX.md'), 'auth notes\n', 'utf8');
    await writeFile(path.join(root, 'billing-v2', 'INDEX.md'), 'billing notes\n', 'utf8');

    const entries = await workspace.listChangedFilesWithStats(root, 'auth-hardening');
    expect(entries.map((entry) => entry.path)).toEqual([
      path.posix.join('auth-hardening', 'INDEX.md'),
    ]);
  });

  it('throws when root is not a git repository at all', async () => {
    root = await makeTmpDir();
    const workspace = new FsWorkspaceRepository();
    await expect(workspace.listChangedFilesWithStats(root, 'auth-hardening')).rejects.toThrow(
      /git status failed/,
    );
  });
});
