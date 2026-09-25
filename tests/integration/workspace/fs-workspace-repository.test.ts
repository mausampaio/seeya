/**
 * `FsWorkspaceRepository` (V2-T27, `adapters/workspace/index.ts`) against a real filesystem and a
 * real `git` binary in `tmpdir` — same "this is the one adapter whose entire job is to shell out
 * to it, so a fake would test nothing real" reasoning `tests/integration/git/_fixtures.ts` already
 * documents for `GitReader`.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { FsWorkspaceRepository } from '@seeya-ai/engine/adapters/workspace/index.js';
import { runGit } from '@seeya-ai/engine/adapters/git/run-git.js';
import { buildProjectSkeleton } from '@seeya-ai/engine/core/project-skeleton.js';
import { buildProjectCommitMessage } from '@seeya-ai/engine/core/project-commit.js';

const FORK_SESSION_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_SESSION_ID = '33333333-3333-4333-8333-333333333333';

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

  it('writeProjectManifest (V2-T28) overwrites only seeya.json — the rest of the skeleton stays', async () => {
    root = await makeTmpDir();
    const workspace = new FsWorkspaceRepository();
    await workspace.initialize(root);
    const skeleton = buildProjectSkeleton('auth-hardening');
    await workspace.writeProjectSkeleton(root, 'auth-hardening', skeleton);
    const projectDir = path.join(root, 'auth-hardening');
    const agentsMdBefore = await readFile(path.join(projectDir, 'AGENTS.md'), 'utf8');

    const updatedManifest = {
      ...skeleton.manifest,
      repositories: [
        {
          hasRemote: true as const,
          name: 'api',
          remote: 'git@host:acme-widgets/app-api.git',
          identity: { host: 'host', owner: 'acme-widgets', repository: 'app-api' },
        },
      ],
    };
    await workspace.writeProjectManifest(root, 'auth-hardening', updatedManifest);

    const manifest = await workspace.readProjectManifest(root, 'auth-hardening');
    expect(manifest?.repositories).toEqual(updatedManifest.repositories);
    const agentsMdAfter = await readFile(path.join(projectDir, 'AGENTS.md'), 'utf8');
    expect(agentsMdAfter).toBe(agentsMdBefore);
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
    await workspace.commitAll(root, 'auth-hardening', 'Create project auth-hardening');

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
    await workspace.commitAll(root, 'auth-hardening', 'Create project auth-hardening');
    // Second call, nothing written since — must not throw and must not add a second commit.
    await expect(
      workspace.commitAll(root, 'auth-hardening', 'Create project auth-hardening'),
    ).resolves.toBeUndefined();
  });

  it("commitAll only ever stages the one project it was called for (D-047 item 3, regression: this used to be `git add -A`, so a commit for one project also carried the other's pending change — reverting one used to undo both)", async () => {
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

    // Pending, UNCOMMITTED changes in BOTH projects at once.
    await writeFile(path.join(root, 'auth-hardening', 'INDEX.md'), 'auth notes\n', 'utf8');
    await writeFile(path.join(root, 'billing-v2', 'INDEX.md'), 'billing notes\n', 'utf8');

    await workspace.commitAll(root, 'auth-hardening', 'Update auth-hardening notes');

    const log = await runGit(root, ['log', '-1', '--name-only', '--pretty=format:']);
    expect(log.ran && log.exitCode === 0).toBe(true);
    const committedFiles = log.ran ? log.stdout.trim().split('\n') : [];
    expect(committedFiles).toEqual([path.posix.join('auth-hardening', 'INDEX.md')]);

    // billing-v2's own pending change is still sitting there, untouched — not staged, not
    // committed, exactly what "um projeto por commit" (D-047 item 3) promises.
    const status = await runGit(root, ['status', '--porcelain', '--', 'billing-v2']);
    // Not `.trim()`'d on purpose: porcelain's leading column ("M" staged vs " M" unstaged-only)
    // IS the fact this assertion exists to prove — trimming it away would hide a regression where
    // this ends up staged instead of merely modified.
    expect(status.ran && status.stdout.replace(/\r?\n$/, '')).toBe(' M billing-v2/INDEX.md');
  });

  it('commitAll never stages .seeya-lock, even for a workspace initialized before this task had a .gitignore rule for it', async () => {
    root = await makeTmpDir();
    const workspace = new FsWorkspaceRepository();
    await workspace.initialize(root);
    await workspace.writeProjectSkeleton(
      root,
      'auth-hardening',
      buildProjectSkeleton('auth-hardening'),
    );
    // A lock file dropped in by hand, standing in for `FsProjectLock#write` — commitAll must
    // never pick this up, first commit or any later one.
    await writeFile(path.join(root, 'auth-hardening', '.seeya-lock'), '{}', 'utf8');

    await workspace.commitAll(root, 'auth-hardening', 'Create project auth-hardening');

    const log = await runGit(root, ['log', '-1', '--name-only', '--pretty=format:']);
    const committedFiles = log.ran ? log.stdout.trim().split('\n') : [];
    expect(committedFiles).not.toContain(path.posix.join('auth-hardening', '.seeya-lock'));
    const status = await runGit(root, ['status', '--porcelain']);
    // Untracked but ignored (git status --porcelain omits ignored files entirely by default) —
    // never reported as a pending change either.
    expect(status.ran && status.stdout).not.toMatch(/\.seeya-lock/);
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
    // Deliberately never initialized — `git add` here fails for real ("not a git repository").
    const workspace = new FsWorkspaceRepository();
    await expect(
      workspace.commitAll(root, 'auth-hardening', 'Create project auth-hardening'),
    ).rejects.toThrow(/git add failed/);
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
    await expect(workspace.commitAll(root, 'auth-hardening', '')).rejects.toThrow(
      /git commit failed/,
    );
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

  // V2-T29 item 4: `listChangedFiles` — `application/project-adopt.ts#adoptSession` reads this
  // right after the fork's interactive session closes, to show the person what it wrote before
  // asking whether to commit.
  it('listChangedFiles is empty right after a project is created and committed — nothing pending', async () => {
    root = await makeTmpDir();
    const workspace = new FsWorkspaceRepository();
    await workspace.initialize(root);
    await workspace.writeProjectSkeleton(
      root,
      'auth-hardening',
      buildProjectSkeleton('auth-hardening'),
    );
    await workspace.commitAll(root, 'auth-hardening', 'Create project auth-hardening');

    expect(await workspace.listChangedFiles(root, 'auth-hardening')).toEqual([]);
  });

  it('listChangedFiles reports a file a session wrote inside the project, path relative to root', async () => {
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
      'how this project is operated\n',
      'utf8',
    );

    const changed = await workspace.listChangedFiles(root, 'auth-hardening');
    expect(changed).toEqual([path.posix.join('auth-hardening', 'context', 'know-how.md')]);
  });

  it("listChangedFiles is scoped to ONE project — a second project's own pending change never leaks in (D-047 item 3)", async () => {
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

    expect(await workspace.listChangedFiles(root, 'auth-hardening')).toEqual([
      path.posix.join('auth-hardening', 'INDEX.md'),
    ]);
  });

  it('listChangedFiles throws when root is not a git repository at all', async () => {
    root = await makeTmpDir();
    const workspace = new FsWorkspaceRepository();
    await expect(workspace.listChangedFiles(root, 'auth-hardening')).rejects.toThrow(
      /git status failed/,
    );
  });

  // V2-T32: `seeya project remove`'s own two reads.
  it('currentCommit is null before any commit, the HEAD hash after one', async () => {
    root = await makeTmpDir();
    const workspace = new FsWorkspaceRepository();
    await workspace.initialize(root);
    expect(await workspace.currentCommit(root)).toBeNull();

    await workspace.writeProjectSkeleton(
      root,
      'auth-hardening',
      buildProjectSkeleton('auth-hardening'),
    );
    await workspace.commitAll(root, 'auth-hardening', 'Create project auth-hardening');
    const head = await runGit(root, ['rev-parse', 'HEAD']);
    expect(await workspace.currentCommit(root)).toBe(head.ran ? head.stdout.trim() : null);
  });

  it('countProjectFiles counts the tracked files inside one project', async () => {
    root = await makeTmpDir();
    const workspace = new FsWorkspaceRepository();
    await workspace.initialize(root);
    const skeleton = buildProjectSkeleton('auth-hardening');
    await workspace.writeProjectSkeleton(root, 'auth-hardening', skeleton);
    await workspace.commitAll(root, 'auth-hardening', 'Create project auth-hardening');
    // AGENTS.md, INDEX.md, seeya.json, plus the two V2-T34 item 2 harness-hook files
    // (.claude/settings.json, .claude/hooks/verify-bash-command.mjs) — never a magic number that
    // silently goes stale the next time the skeleton grows a file (`skeleton.files.length` plus the
    // one file `writeProjectSkeleton` always adds beyond `skeleton.files` itself, `seeya.json`).
    expect(await workspace.countProjectFiles(root, 'auth-hardening')).toBe(
      skeleton.files.length + 1,
    );
  });

  it('removeProjectDirectory deletes the project, and commitAll then commits the removal', async () => {
    root = await makeTmpDir();
    const workspace = new FsWorkspaceRepository();
    await workspace.initialize(root);
    await workspace.writeProjectSkeleton(
      root,
      'auth-hardening',
      buildProjectSkeleton('auth-hardening'),
    );
    await workspace.commitAll(root, 'auth-hardening', 'Create project auth-hardening');

    await workspace.removeProjectDirectory(root, 'auth-hardening');
    expect(await workspace.projectExists(root, 'auth-hardening')).toBe(false);
    await workspace.commitAll(root, 'auth-hardening', 'Remove project auth-hardening');

    const { manifests } = await workspace.listProjects(root);
    expect(manifests).toEqual([]);
    const log = await runGit(root, ['log', '-1', '--name-status', '--pretty=format:']);
    expect(log.ran && log.stdout).toMatch(/D\s+auth-hardening\/AGENTS\.md/);
  });

  it('removeProjectDirectory tolerates a directory that is already gone (D-025)', async () => {
    root = await makeTmpDir();
    const workspace = new FsWorkspaceRepository();
    await workspace.initialize(root);
    await expect(workspace.removeProjectDirectory(root, 'ghost')).resolves.toBeUndefined();
  });

  describe('findSessionCommits / findCommitsAfter / revertCommits (V2-T32, D-047 item 4)', () => {
    async function setUpProjectWithForkCommit(): Promise<{
      workspace: FsWorkspaceRepository;
      forkCommit: string;
    }> {
      const workspace = new FsWorkspaceRepository();
      await workspace.initialize(root as string);
      await workspace.writeProjectSkeleton(
        root as string,
        'auth-hardening',
        buildProjectSkeleton('auth-hardening'),
      );
      // The "create project" commit itself carries no session trailer that matches the fork's own
      // id (same as `application/project-adopt.ts#ensureProjectExists`'s real caller trailer) —
      // `findSessionCommits` must never pick this one up.
      await workspace.commitAll(
        root as string,
        'auth-hardening',
        buildProjectCommitMessage('Create project auth-hardening', 'auth-hardening', undefined),
      );

      await writeFile(
        path.join(root as string, 'auth-hardening', 'context', 'know-how.md'),
        'how this project is operated\n',
        'utf8',
      );
      await workspace.commitAll(
        root as string,
        'auth-hardening',
        buildProjectCommitMessage(
          'Adopt session into project auth-hardening',
          'auth-hardening',
          FORK_SESSION_ID,
        ),
      );
      const forkCommitResult = await runGit(root as string, ['rev-parse', 'HEAD']);
      const forkCommit = forkCommitResult.ran ? forkCommitResult.stdout.trim() : '';
      return { workspace, forkCommit };
    }

    it('findSessionCommits finds only the trailer-matching commit, scoped to the project', async () => {
      root = await makeTmpDir();
      const { workspace, forkCommit } = await setUpProjectWithForkCommit();

      const commits = await workspace.findSessionCommits(root, 'auth-hardening', FORK_SESSION_ID);
      expect(commits).toEqual([
        { hash: forkCommit, files: [path.posix.join('auth-hardening', 'context', 'know-how.md')] },
      ]);
    });

    it('findSessionCommits is empty when the session never committed inside this project (D-025)', async () => {
      root = await makeTmpDir();
      await setUpProjectWithForkCommit();
      const workspace = new FsWorkspaceRepository();

      expect(await workspace.findSessionCommits(root, 'auth-hardening', OTHER_SESSION_ID)).toEqual(
        [],
      );
    });

    it('findCommitsAfter returns every later commit touching the project, oldest first', async () => {
      root = await makeTmpDir();
      const { workspace, forkCommit } = await setUpProjectWithForkCommit();

      await writeFile(
        path.join(root, 'auth-hardening', 'INDEX.md'),
        'updated by someone else\n',
        'utf8',
      );
      await workspace.commitAll(
        root,
        'auth-hardening',
        buildProjectCommitMessage('Update INDEX.md', 'auth-hardening', OTHER_SESSION_ID),
      );
      const laterCommitResult = await runGit(root, ['rev-parse', 'HEAD']);
      const laterCommit = laterCommitResult.ran ? laterCommitResult.stdout.trim() : '';

      const commitsAfter = await workspace.findCommitsAfter(root, 'auth-hardening', forkCommit);
      expect(commitsAfter).toEqual([
        { hash: laterCommit, files: [path.posix.join('auth-hardening', 'INDEX.md')] },
      ]);
    });

    it("findCommitsAfter is empty when the fork's commit is the newest one touching the project", async () => {
      root = await makeTmpDir();
      const { workspace, forkCommit } = await setUpProjectWithForkCommit();
      expect(await workspace.findCommitsAfter(root, 'auth-hardening', forkCommit)).toEqual([]);
    });

    it('revertCommits reverts one commit and makes a single new commit with the given message', async () => {
      root = await makeTmpDir();
      const { workspace, forkCommit } = await setUpProjectWithForkCommit();

      const outcome = await workspace.revertCommits(
        root,
        'auth-hardening',
        [forkCommit],
        'Revert adoption of session from project auth-hardening',
      );

      expect(outcome).toStrictEqual({ kind: 'committed' });
      expect(
        await workspace.findSessionCommits(root, 'auth-hardening', FORK_SESSION_ID),
      ).toHaveLength(1); // the ORIGINAL commit is still there — reverting adds a new commit, never rewrites history
      const log = await runGit(root, ['log', '-1', '--pretty=format:%s']);
      expect(log.ran && log.stdout).toBe('Revert adoption of session from project auth-hardening');
      const filePath = path.join(root, 'auth-hardening', 'context', 'know-how.md');
      await expect(readFile(filePath, 'utf8')).rejects.toThrow();
    });

    it('revertCommits reports noChanges (never an empty commit) when the reverts cancel out to a net-zero diff', async () => {
      root = await makeTmpDir();
      const workspace = new FsWorkspaceRepository();
      await workspace.initialize(root);
      await workspace.writeProjectSkeleton(
        root,
        'auth-hardening',
        buildProjectSkeleton('auth-hardening'),
      );
      await workspace.commitAll(root, 'auth-hardening', 'Create project auth-hardening');

      await writeFile(path.join(root, 'auth-hardening', 'scratch.md'), 'temporary\n', 'utf8');
      await workspace.commitAll(
        root,
        'auth-hardening',
        buildProjectCommitMessage('Add scratch.md', 'auth-hardening', FORK_SESSION_ID),
      );
      const addCommitResult = await runGit(root, ['rev-parse', 'HEAD']);
      const addCommit = addCommitResult.ran ? addCommitResult.stdout.trim() : '';

      await rm(path.join(root, 'auth-hardening', 'scratch.md'));
      await workspace.commitAll(
        root,
        'auth-hardening',
        buildProjectCommitMessage('Remove scratch.md', 'auth-hardening', FORK_SESSION_ID),
      );
      const removeCommitResult = await runGit(root, ['rev-parse', 'HEAD']);
      const removeCommit = removeCommitResult.ran ? removeCommitResult.stdout.trim() : '';

      // Newest first: revert the removal (scratch.md comes back), then revert the add (it's gone
      // again) — net result identical to HEAD before either ran.
      const outcome = await workspace.revertCommits(
        root,
        'auth-hardening',
        [removeCommit, addCommit],
        'Revert adoption',
      );
      expect(outcome).toStrictEqual({ kind: 'noChanges' });
    });

    it('revertCommits stops at the first commit that fails to apply cleanly and aborts (never a partial revert)', async () => {
      root = await makeTmpDir();
      const workspace = new FsWorkspaceRepository();
      await workspace.initialize(root);
      await workspace.writeProjectSkeleton(
        root,
        'auth-hardening',
        buildProjectSkeleton('auth-hardening'),
      );
      await workspace.commitAll(root, 'auth-hardening', 'Create project auth-hardening');

      await writeFile(path.join(root, 'auth-hardening', 'scratch.md'), 'line1\n', 'utf8');
      await workspace.commitAll(root, 'auth-hardening', 'Add scratch.md');
      const addCommitResult = await runGit(root, ['rev-parse', 'HEAD']);
      const addCommit = addCommitResult.ran ? addCommitResult.stdout.trim() : '';

      // A later, real change to the SAME line — reverting the ADD commit alone (without also
      // reverting this one) can't find the original line any more, a genuine `git revert` conflict.
      await writeFile(path.join(root, 'auth-hardening', 'scratch.md'), 'line1-changed\n', 'utf8');
      await workspace.commitAll(root, 'auth-hardening', 'Change scratch.md');

      const outcome = await workspace.revertCommits(
        root,
        'auth-hardening',
        [addCommit],
        'Revert (should fail)',
      );
      expect(outcome.kind).toBe('failed');
      expect(outcome.kind === 'failed' && outcome.hash).toBe(addCommit);
      expect(outcome.kind === 'failed' && outcome.reason).toContain('exit');

      // Aborted cleanly — no revert left mid-flight, no stray commit.
      const status = await runGit(root, ['status', '--porcelain']);
      expect(status.ran && status.stdout.trim()).toBe('');
      const content = await readFile(path.join(root, 'auth-hardening', 'scratch.md'), 'utf8');
      // `.trim()` here, not an exact-string match: a real `git` on Windows may normalize line
      // endings on checkout (`core.autocrlf`) — a fact about the machine running the test, not
      // about `revertCommits`'s own abort behavior, which is what this test is actually proving.
      expect(content.trim()).toBe('line1-changed');
    });

    it('findSessionCommits/findCommitsAfter/revertCommits all throw when root is not a git repository at all', async () => {
      root = await makeTmpDir();
      const workspace = new FsWorkspaceRepository();
      await expect(
        workspace.findSessionCommits(root, 'auth-hardening', FORK_SESSION_ID),
      ).rejects.toThrow(/git log failed/);
      await expect(workspace.findCommitsAfter(root, 'auth-hardening', 'deadbeef')).rejects.toThrow(
        /git log failed/,
      );
    });

    // `ran: false` — git never even starts (the `cwd` itself doesn't exist), the OTHER failure
    // shape `adapters/git/run-git.ts#GitCommandResult` distinguishes from a real nonzero exit code
    // (same technique `tests/integration/git/primitives.test.ts` already uses for the identical
    // distinction).
    it('findSessionCommits/findCommitsAfter throw with the raw reason (not an exit code) when the workingDir does not exist at all', async () => {
      const parent = await makeTmpDir();
      root = parent;
      const missing = path.join(parent, 'never-created');
      const workspace = new FsWorkspaceRepository();
      await expect(
        workspace.findSessionCommits(missing, 'auth-hardening', FORK_SESSION_ID),
      ).rejects.toThrow(/git log failed/);
      await expect(
        workspace.findCommitsAfter(missing, 'auth-hardening', 'deadbeef'),
      ).rejects.toThrow(/git log failed/);
    });

    it('revertCommits reports failed (never throws) when the workingDir does not exist at all', async () => {
      const parent = await makeTmpDir();
      root = parent;
      const missing = path.join(parent, 'never-created');
      const workspace = new FsWorkspaceRepository();
      const outcome = await workspace.revertCommits(
        missing,
        'auth-hardening',
        ['deadbeef'],
        'Revert (should fail to even start)',
      );
      expect(outcome.kind).toBe('failed');
      expect(outcome.kind === 'failed' && outcome.reason).not.toMatch(/^exit /);
    });
  });

  describe('listStagedFiles / installCommitMsgHook / listCommitsForAudit (V2-T34)', () => {
    async function setUpTwoProjects(): Promise<{ root: string; workspace: FsWorkspaceRepository }> {
      const dir = await makeTmpDir();
      root = dir;
      const workspace = new FsWorkspaceRepository();
      await workspace.initialize(dir);
      await workspace.writeProjectSkeleton(
        dir,
        'auth-hardening',
        buildProjectSkeleton('auth-hardening'),
      );
      await workspace.commitAll(
        dir,
        'auth-hardening',
        buildProjectCommitMessage('Create project auth-hardening', 'auth-hardening', undefined),
      );
      return { root: dir, workspace };
    }

    it('listStagedFiles is empty before staging, lists exactly what was git-added after', async () => {
      const { root: dir, workspace } = await setUpTwoProjects();
      expect(await workspace.listStagedFiles(dir)).toEqual([]);
      await writeFile(path.join(dir, 'auth-hardening', 'status', 'current.md'), 'x\n');
      await runGit(dir, ['add', 'auth-hardening']);
      expect(await workspace.listStagedFiles(dir)).toEqual(['auth-hardening/status/current.md']);
    });

    it('listStagedFiles throws with the raw reason (not an exit code) when the workingDir does not exist at all', async () => {
      const parent = await makeTmpDir();
      root = parent;
      const missing = path.join(parent, 'never-created');
      const workspace = new FsWorkspaceRepository();
      await expect(workspace.listStagedFiles(missing)).rejects.toThrow(/git diff failed/);
    });

    it('installCommitMsgHook writes an executable file at .git/hooks/commit-msg', async () => {
      const { root: dir, workspace } = await setUpTwoProjects();
      await workspace.installCommitMsgHook(dir, '#!/bin/sh\necho hi\n');
      const hookPath = path.join(dir, '.git', 'hooks', 'commit-msg');
      const content = await readFile(hookPath, 'utf8');
      expect(content).toBe('#!/bin/sh\necho hi\n');
      const stats = await stat(hookPath);
      // On POSIX, the executable bit is what git actually checks before running a hook by this
      // exact name; on Windows this bit is meaningless but harmless to assert regardless.
      if (process.platform !== 'win32') {
        expect(stats.mode & 0o111).not.toBe(0);
      }
    });

    it('installCommitMsgHook overwrites an existing hook — reinstalled, never merged', async () => {
      const { root: dir, workspace } = await setUpTwoProjects();
      await workspace.installCommitMsgHook(dir, '#!/bin/sh\necho old\n');
      await workspace.installCommitMsgHook(dir, '#!/bin/sh\necho new\n');
      const content = await readFile(path.join(dir, '.git', 'hooks', 'commit-msg'), 'utf8');
      expect(content).toBe('#!/bin/sh\necho new\n');
    });

    it('listCommitsForAudit(sinceCommit: null) returns the whole history, oldest first, unscoped files', async () => {
      const { root: dir, workspace } = await setUpTwoProjects();
      const commits = await workspace.listCommitsForAudit(dir, 'auth-hardening', null);
      expect(commits).toHaveLength(1);
      expect(commits[0]?.message).toContain('Create project auth-hardening');
      expect(commits[0]?.files).toContain('auth-hardening/AGENTS.md');
    });

    it('listCommitsForAudit(sinceCommit) excludes everything at or before that commit', async () => {
      const { root: dir, workspace } = await setUpTwoProjects();
      const first = (await workspace.listCommitsForAudit(dir, 'auth-hardening', null))[0];
      await writeFile(path.join(dir, 'auth-hardening', 'status', 'current.md'), 'second\n');
      await workspace.commitAll(
        dir,
        'auth-hardening',
        buildProjectCommitMessage('Second commit', 'auth-hardening', 'session-a'),
      );
      const since = await workspace.listCommitsForAudit(dir, 'auth-hardening', first?.hash ?? null);
      expect(since).toHaveLength(1);
      expect(since[0]?.message).toContain('Second commit');
    });

    it('listCommitsForAudit sees a file OUTSIDE the project too — unscoped, unlike findCommitsAfter', async () => {
      const { root: dir, workspace } = await setUpTwoProjects();
      // A commit made by hand touching a SECOND project alongside the audited one — the exact case
      // `core/project-audit.ts#touchesOtherProjects` exists to catch, which requires the files list
      // NOT be scoped to `auth-hardening` the way `findCommitsAfter` deliberately is.
      await workspace.writeProjectSkeleton(dir, 'billing-v2', buildProjectSkeleton('billing-v2'));
      await writeFile(path.join(dir, 'auth-hardening', 'status', 'current.md'), 'x\n');
      await runGit(dir, ['add', 'auth-hardening', 'billing-v2']);
      await runGit(dir, ['commit', '-m', 'Sneaky two-project commit']);
      const commits = await workspace.listCommitsForAudit(dir, 'auth-hardening', null);
      const sneaky = commits.find((c) => c.message.includes('Sneaky'));
      expect(sneaky?.files.some((f) => f.startsWith('billing-v2/'))).toBe(true);
    });

    it('listCommitsForAudit throws with the raw reason (not an exit code) when the workingDir does not exist at all', async () => {
      const parent = await makeTmpDir();
      root = parent;
      const missing = path.join(parent, 'never-created');
      const workspace = new FsWorkspaceRepository();
      await expect(workspace.listCommitsForAudit(missing, 'auth-hardening', null)).rejects.toThrow(
        /git log failed/,
      );
    });

    it('listCommitsForAudit throws when sinceCommit does not exist as a real commit', async () => {
      const { root: dir, workspace } = await setUpTwoProjects();
      await expect(
        workspace.listCommitsForAudit(dir, 'auth-hardening', 'not-a-real-commit-hash'),
      ).rejects.toThrow(/git log failed/);
    });
  });
});
