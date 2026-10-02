/**
 * V2-T82 item 4: a project's pending-change listings must name exactly what `commitAll` will
 * commit. Found in a real adoption: the review said "9 files" (including `.claude/settings.json`
 * and `.seeya-audit`) while the commit had 7, because the workspace's `.gitignore` only gained the
 * ignore patterns inside `commitAll` — a listing that ran BEFORE it (on a workspace whose
 * `.gitignore` predates those patterns) saw them as plain untracked files. Real `git`, real tmpdir.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { FsWorkspaceRepository } from '@seeya-ai/engine/adapters/workspace/index.js';
import { runGit } from '@seeya-ai/engine/adapters/git/run-git.js';
import { buildProjectSkeleton } from '@seeya-ai/engine/core/project-skeleton.js';
import { removeTempDir } from '../../_remove-temp-dir.js';

const PROJECT = 'auth-hardening';

/** A workspace whose `.gitignore` is the OLD one (no `.seeya-audit`, no the `.claude/` directory
 * pattern), with a committed project plus one real change and the two operational files present
 * on disk. */
async function buildOldWorkspace(): Promise<{ root: string; workspace: FsWorkspaceRepository }> {
  const root = await mkdtemp(path.join(tmpdir(), 'seeya-listing-matches-commit-'));
  const workspace = new FsWorkspaceRepository();
  await workspace.initialize(root);
  await workspace.writeProjectSkeleton(root, PROJECT, buildProjectSkeleton(PROJECT));
  await workspace.commitAll(root, PROJECT, 'Create project');
  await writeFile(path.join(root, '.gitignore'), '.seeya-lock\n', 'utf8');
  await runGit(root, ['add', '.gitignore']);
  await runGit(root, ['commit', '-m', 'old gitignore'], {
    ...process.env,
    GIT_AUTHOR_NAME: 't',
    GIT_AUTHOR_EMAIL: 't@example.invalid',
    GIT_COMMITTER_NAME: 't',
    GIT_COMMITTER_EMAIL: 't@example.invalid',
  });
  await writeFile(path.join(root, PROJECT, 'context', 'know-how.md'), 'a\nb\n', 'utf8');
  await mkdir(path.join(root, PROJECT, '.claude'), { recursive: true });
  await writeFile(path.join(root, PROJECT, '.claude', 'settings.json'), '{}\n', 'utf8');
  await writeFile(path.join(root, PROJECT, '.seeya-audit'), 'abc\n', 'utf8');
  return { root, workspace };
}

describe('pending-change listings match what commitAll commits', () => {
  let root: string | undefined;
  afterEach(async () => {
    if (root !== undefined) {
      await removeTempDir(root);
      root = undefined;
    }
  }, 60_000);

  const know = path.posix.join(PROJECT, 'context', 'know-how.md');

  it('listChangedFilesWithStats leaves out ignored operational files', async () => {
    const built = await buildOldWorkspace();
    root = built.root;
    const entries = await built.workspace.listChangedFilesWithStats(root, PROJECT);
    expect(entries.map((entry) => entry.path)).toEqual([know]);
  }, 60_000);

  it('listChangedFiles and listChangedFilesWithStatus agree', async () => {
    const built = await buildOldWorkspace();
    root = built.root;
    expect(await built.workspace.listChangedFiles(root, PROJECT)).toEqual([know]);
    const withStatus = await built.workspace.listChangedFilesWithStatus(root, PROJECT);
    expect(withStatus.map((entry) => entry.path)).toEqual([know]);
  }, 60_000);

  it('the listing equals the files the commit actually contains', async () => {
    const built = await buildOldWorkspace();
    root = built.root;
    const listed = (await built.workspace.listChangedFilesWithStats(root, PROJECT)).map(
      (entry) => entry.path,
    );
    await built.workspace.commitAll(root, PROJECT, 'Adopt');
    const shown = await runGit(root, ['show', '--name-only', '--format=', 'HEAD']);
    const committed = shown.ran
      ? shown.stdout.split('\n').filter((line) => line.length > 0 && line !== '.gitignore')
      : [];
    expect(committed).toEqual(listed);
  }, 60_000);
});
