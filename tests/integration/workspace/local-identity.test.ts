/**
 * REAL execution of the workspace's own local git identity (V2-T58, D-047's own 2026-09-25
 * emendment) — a disposable workspace, with no GLOBAL git identity available at all (`GIT_CONFIG_
 * GLOBAL` pointing at an empty file, `GIT_CONFIG_NOSYSTEM=1`, same technique the task's own item 3
 * names) and the REAL compiled `commit-msg` hook installed (`packages/cli/dist/index.js`, same
 * "actual generated shell script against a real, disposable git repository" reasoning
 * `commit-msg-hook.test.ts` already documents for the sibling suite).
 *
 * Reproduces the maintainer's own Ubuntu incident (this task's own description): a machine whose
 * global git identity has a name but no email made a session's own plain `git commit` — no
 * `GIT_AUTHOR_*`/`GIT_COMMITTER_*` override, unlike `WorkspaceRepository.commitAll` — fail, and the
 * session fixed this itself by writing a LOCAL identity. `FsWorkspaceRepository#configureIdentity`
 * is what now does that instead, before any session ever gets the chance to.
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

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CLI_ENTRY_PATH = path.join(REPO_ROOT, 'packages', 'cli', 'dist', 'index.js');

async function makeTmpDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'seeya-local-identity-'));
}

interface CommitAttempt {
  readonly exitCode: number;
  readonly stderr: string;
}

/**
 * A plain `git commit -m message` with NO identity override at all — unlike `commit-msg-
 * hook.test.ts#realCommit` (which always forces `GIT_AUTHOR_*`/`GIT_COMMITTER_*` so unrelated
 * scenarios never depend on the machine's own git config), this is exactly what a session's own
 * `git commit` looks like: whatever `env` says, nothing more.
 */
async function sessionCommit(
  root: string,
  message: string,
  env: NodeJS.ProcessEnv,
): Promise<CommitAttempt> {
  return new Promise((resolve) => {
    const child = spawn('git', ['commit', '-m', message], {
      cwd: root,
      env,
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

async function headAuthor(root: string): Promise<string> {
  const result = await runGit(root, ['log', '-1', '--format=%an <%ae>']);
  return result.ran ? result.stdout.trim() : '';
}

async function headMessage(root: string): Promise<string> {
  const result = await runGit(root, ['log', '-1', '--format=%B']);
  return result.ran ? result.stdout : '';
}

/** The "empty" global config is not quite empty: `user.useConfigOnly = true` turns off git's own
 * identity auto-detection. Without it, git on macOS guesses `<user>@<host>.local` from the machine
 * and a commit with no configured identity succeeds anyway — the negative case below passed on
 * Windows and Ubuntu and failed on the macOS CI runner (run 36314424566). With it, "no identity
 * configured" means the same thing on all three systems. */
const NO_IDENTITY_GLOBAL_CONFIG = '[user]\n\tuseConfigOnly = true\n';

/** No global (and no system) git identity available anywhere, and no env-var override either —
 * the exact absence the maintainer's own Ubuntu machine had, minus the "has a name but no email"
 * detail: absence of email alone is already enough to make a plain `git commit` refuse. */
function envWithNoGitIdentityAnywhere(emptyGlobalConfigPath: string): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env['GIT_AUTHOR_NAME'];
  delete env['GIT_AUTHOR_EMAIL'];
  delete env['GIT_COMMITTER_NAME'];
  delete env['GIT_COMMITTER_EMAIL'];
  delete env['CLAUDE_CODE_SESSION_ID'];
  env['GIT_CONFIG_GLOBAL'] = emptyGlobalConfigPath;
  env['GIT_CONFIG_NOSYSTEM'] = '1';
  return env;
}

describe('the workspace-own local git identity — real execution (V2-T58, D-047 emendment)', () => {
  let root: string | undefined;

  beforeAll(async () => {
    // Same "fails loudly with a clear message" guard `commit-msg-hook.test.ts` already has — a
    // missing build is a setup problem, not a hook problem.
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

  it('lets a session commit with no identity in its own environment, author = seeya, trailers present', async () => {
    const dir = await makeTmpDir();
    root = dir;
    const workspace = new FsWorkspaceRepository();
    await workspace.initialize(dir);
    await workspace.writeProjectSkeleton(
      dir,
      'auth-hardening',
      buildProjectSkeleton('auth-hardening'),
    );
    // `commitAll` carries its own identity override (`COMMIT_IDENTITY_ENV`) regardless of the
    // machine's own git config — this first commit is `seeya`'s own, not the session's, so it
    // succeeds either way and is not what this test is about.
    await workspace.commitAll(
      dir,
      'auth-hardening',
      buildProjectCommitMessage('Create project auth-hardening', 'auth-hardening', undefined),
    );
    await workspace.installCommitMsgHook(
      dir,
      buildCommitMsgHookScript(process.execPath, CLI_ENTRY_PATH),
    );

    const emptyGlobalConfig = path.join(dir, 'empty-global-gitconfig');
    await writeFile(emptyGlobalConfig, NO_IDENTITY_GLOBAL_CONFIG);
    const noIdentityEnv = envWithNoGitIdentityAnywhere(emptyGlobalConfig);

    // THE FIX under test: without it, this workspace has no identity anywhere — no global (the
    // empty file above), no system (`GIT_CONFIG_NOSYSTEM=1`), no local (never configured), and
    // no env-var override (a plain session commit, unlike `commitAll`). Confirmed by hand,
    // before this method existed, that the commit below fails with git's own "Author identity
    // unknown" refusal — exactly the maintainer's own Ubuntu incident this task describes.
    await workspace.configureIdentity(dir);

    await writeFile(path.join(dir, 'auth-hardening', 'status', 'current.md'), 'Working on X.\n');
    await runGit(dir, ['add', 'auth-hardening']);
    const attempt = await sessionCommit(dir, 'Write current status', noIdentityEnv);

    expect(attempt.exitCode, `commit failed: ${attempt.stderr}`).toBe(0);
    expect(await headAuthor(dir)).toBe('seeya <seeya@localhost>');
    const message = await headMessage(dir);
    expect(message).toContain('Seeya-Project-Id: auth-hardening');
    expect(message).toContain('Seeya-Session-Id: unknown');
  }, 30_000);

  it('without configureIdentity, the same session commit fails for lack of any identity at all', async () => {
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
    await workspace.installCommitMsgHook(
      dir,
      buildCommitMsgHookScript(process.execPath, CLI_ENTRY_PATH),
    );
    // `configureIdentity` is deliberately NOT called here — this is what every workspace looked
    // like before V2-T58, and it is what the test above would look like without the fix under
    // test (confirmed by hand: removing the `configureIdentity` call from the test above
    // reproduces exactly this failure).

    const emptyGlobalConfig = path.join(dir, 'empty-global-gitconfig');
    await writeFile(emptyGlobalConfig, NO_IDENTITY_GLOBAL_CONFIG);
    const noIdentityEnv = envWithNoGitIdentityAnywhere(emptyGlobalConfig);

    await writeFile(path.join(dir, 'auth-hardening', 'status', 'current.md'), 'Working on X.\n');
    await runGit(dir, ['add', 'auth-hardening']);
    const attempt = await sessionCommit(dir, 'Write current status', noIdentityEnv);

    expect(attempt.exitCode).not.toBe(0);
    expect(attempt.stderr).toContain('Author identity unknown');
  }, 30_000);
});
