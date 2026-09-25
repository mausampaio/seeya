/**
 * REAL execution of the workspace's own `commit-msg` git hook (V2-T34 item 1, D-047 item 5) — not a
 * simulation of `decideCommitGuard` (that's `tests/unit/core/workspace-commit-guard.test.ts`'s job),
 * but the actual generated shell script, installed by `FsWorkspaceRepository#installCommitMsgHook`
 * into a real, disposable git repository, invoked by a real `git commit`, calling back into the
 * REAL compiled `seeya` CLI (`packages/cli/dist/index.js`, `npm run build` before this suite runs —
 * same "this is the one thing whose entire job is to shell out, a fake would test nothing real"
 * reasoning `fs-workspace-repository.test.ts` already documents for its own git calls).
 *
 * Every scenario the task's own item 1 names: the permitted case (AGENTS.md § "Teste o caso
 * permitido"), and each refusal — two projects in one commit, the lock file staged, a contradicting
 * trailer, and a project locked by a DIFFERENT live session (a real spawned child process, same
 * technique `tests/integration/application/project-lock.test.ts` already uses for its own liveness
 * proof).
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FsWorkspaceRepository } from '@seeya-ai/engine/adapters/workspace/index.js';
import { runGit } from '@seeya-ai/engine/adapters/git/run-git.js';
import { buildProjectSkeleton } from '@seeya-ai/engine/core/project-skeleton.js';
import { buildProjectCommitMessage } from '@seeya-ai/engine/core/project-commit.js';
import { buildCommitMsgHookScript } from '@seeya-ai/engine/core/workspace-hooks.js';

// `tests/integration/` runs from the monorepo root — `packages/cli/dist/index.js` is the exact
// entry `packages/cli/src/composition.ts#resolveCliEntryPath` resolves in production, built by
// `npm run build` (part of `npm run verificar`, and run once before this file's own suite below).
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CLI_ENTRY_PATH = path.join(REPO_ROOT, 'packages', 'cli', 'dist', 'index.js');

async function makeTmpDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'seeya-hook-'));
}

interface CommitAttempt {
  readonly exitCode: number;
  readonly stderr: string;
}

/** A real, plain `git commit -m message`, run against the ALREADY-STAGED index — the hook has to
 * fire from git's own machinery, never simulated. */
async function realCommit(
  root: string,
  message: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<CommitAttempt> {
  return new Promise((resolve) => {
    const child = spawn('git', ['commit', '-m', message], {
      cwd: root,
      env: {
        ...env,
        GIT_AUTHOR_NAME: 'seeya-test',
        GIT_AUTHOR_EMAIL: 'seeya-test@localhost',
        GIT_COMMITTER_NAME: 'seeya-test',
        GIT_COMMITTER_EMAIL: 'seeya-test@localhost',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('close', (code) => resolve({ exitCode: code ?? -1, stderr }));
  });
}

async function headMessage(root: string): Promise<string> {
  const result = await runGit(root, ['log', '-1', '--format=%B']);
  return result.ran ? result.stdout : '';
}

async function headHash(root: string): Promise<string> {
  const result = await runGit(root, ['rev-parse', 'HEAD']);
  return result.ran ? result.stdout.trim() : '';
}

describe('the workspace commit-msg hook — real execution', () => {
  let root: string | undefined;

  beforeAll(async () => {
    // Fails loudly, with a clear message, rather than every scenario below failing mysteriously
    // with ENOENT — a missing build is a setup problem, not a hook problem.
    await readFile(CLI_ENTRY_PATH, 'utf8').catch(() => {
      throw new Error(
        `${CLI_ENTRY_PATH} does not exist — run "npm run build" before this suite (same as ` +
          '"npm run verificar" already does).',
      );
    });
  }, 30_000);

  afterEach(async () => {
    if (root !== undefined) {
      await rm(root, { recursive: true, force: true });
      root = undefined;
    }
  });

  async function setUpWorkspaceWithProject(): Promise<{
    readonly root: string;
    readonly workspace: FsWorkspaceRepository;
  }> {
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
    await workspace.writeProjectSkeleton(dir, 'billing-v2', buildProjectSkeleton('billing-v2'));
    await workspace.commitAll(
      dir,
      'billing-v2',
      buildProjectCommitMessage('Create project billing-v2', 'billing-v2', undefined),
    );
    await workspace.installCommitMsgHook(
      dir,
      buildCommitMsgHookScript(process.execPath, CLI_ENTRY_PATH),
    );
    return { root: dir, workspace };
  }

  it('allows a plain commit into one project and completes both trailers for real', async () => {
    const { root: dir } = await setUpWorkspaceWithProject();
    await writeFile(path.join(dir, 'auth-hardening', 'status', 'current.md'), 'Working on X.\n');
    await runGit(dir, ['add', 'auth-hardening']);

    // No CLAUDE_CODE_SESSION_ID in the environment: attributed to "unknown" (D-025).
    const cleanEnv = { ...process.env };
    delete cleanEnv['CLAUDE_CODE_SESSION_ID'];
    const attempt = await realCommit(dir, 'Write current status', cleanEnv);

    expect(attempt.exitCode).toBe(0);
    const message = await headMessage(dir);
    expect(message).toContain('Seeya-Project-Id: auth-hardening');
    expect(message).toContain('Seeya-Session-Id: unknown');
  }, 30_000);

  it('completes trailers with the real CLAUDE_CODE_SESSION_ID from the environment', async () => {
    const { root: dir } = await setUpWorkspaceWithProject();
    await writeFile(path.join(dir, 'auth-hardening', 'status', 'current.md'), 'Update.\n');
    await runGit(dir, ['add', 'auth-hardening']);

    const sessionEnv = { ...process.env, CLAUDE_CODE_SESSION_ID: 'session-real-123' };
    const attempt = await realCommit(dir, 'Update status', sessionEnv);

    expect(attempt.exitCode).toBe(0);
    const message = await headMessage(dir);
    expect(message).toContain('Seeya-Session-Id: session-real-123');
  }, 30_000);

  it('refuses a commit staging files from two projects', async () => {
    const { root: dir } = await setUpWorkspaceWithProject();
    const beforeHash = await headHash(dir);
    await writeFile(path.join(dir, 'auth-hardening', 'status', 'current.md'), 'a\n');
    await writeFile(path.join(dir, 'billing-v2', 'status', 'current.md'), 'b\n');
    await runGit(dir, ['add', 'auth-hardening', 'billing-v2']);

    const attempt = await realCommit(dir, 'Touch two projects', process.env);

    expect(attempt.exitCode).not.toBe(0);
    expect(attempt.stderr).toContain('one project per commit');
    expect(await headHash(dir)).toBe(beforeHash); // nothing landed
  }, 30_000);

  it('refuses a commit staging the project lock file', async () => {
    const { root: dir } = await setUpWorkspaceWithProject();
    const beforeHash = await headHash(dir);
    await writeFile(path.join(dir, 'auth-hardening', '.seeya-lock'), '{}');
    // The workspace's own .gitignore already excludes .seeya-lock — force-add it, the way someone
    // trying to work around the guard by hand would have to.
    await runGit(dir, ['add', '--force', 'auth-hardening/.seeya-lock']);

    const attempt = await realCommit(dir, 'Sneak the lock in', process.env);

    expect(attempt.exitCode).not.toBe(0);
    expect(attempt.stderr).toContain('.seeya-lock');
    expect(await headHash(dir)).toBe(beforeHash);
  }, 30_000);

  it('refuses a commit message with a project trailer that contradicts the real project', async () => {
    const { root: dir } = await setUpWorkspaceWithProject();
    const beforeHash = await headHash(dir);
    await writeFile(path.join(dir, 'auth-hardening', 'status', 'current.md'), 'x\n');
    await runGit(dir, ['add', 'auth-hardening']);

    const attempt = await realCommit(
      dir,
      'Edit\n\nSeeya-Project-Id: some-other-project',
      process.env,
    );

    expect(attempt.exitCode).not.toBe(0);
    expect(attempt.stderr).toContain('some-other-project');
    expect(await headHash(dir)).toBe(beforeHash);
  }, 30_000);

  it('refuses a commit into a project locked by a DIFFERENT, live session (real child process)', async () => {
    const { root: dir } = await setUpWorkspaceWithProject();
    const beforeHash = await headHash(dir);

    // A real, live process this test controls — same technique
    // tests/integration/application/project-lock.test.ts already uses for the identical reason
    // (a fake pid can't prove the REAL ProcessControl.isAlive check).
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      stdio: 'ignore',
    });
    try {
      await new Promise((resolve) => setTimeout(resolve, 200)); // let it actually start
      const lockPath = path.join(dir, 'auth-hardening', '.seeya-lock');
      await writeFile(
        lockPath,
        JSON.stringify({
          schemaVersion: 1,
          sessionId: 'holder-session',
          pid: child.pid,
          acquiredAt: new Date().toISOString(),
        }),
      );

      await writeFile(path.join(dir, 'auth-hardening', 'status', 'current.md'), 'sneaky\n');
      await runGit(dir, ['add', 'auth-hardening']);
      const outsiderEnv = { ...process.env, CLAUDE_CODE_SESSION_ID: 'outsider-session' };
      const attempt = await realCommit(dir, 'Sneaky edit while locked', outsiderEnv);

      expect(attempt.exitCode).not.toBe(0);
      expect(attempt.stderr).toContain('holder-session');
      expect(await headHash(dir)).toBe(beforeHash);
    } finally {
      child.kill();
    }
  }, 30_000);
});
