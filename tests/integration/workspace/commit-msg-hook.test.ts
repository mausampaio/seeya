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
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FsWorkspaceRepository } from '@seeya-ai/engine/adapters/workspace/index.js';
import { FsProjectLock } from '@seeya-ai/engine/adapters/workspace/project-lock.js';
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

/** Module-level (V2-T34 hotfix: shared by the original describe block below AND the new
 * same-process-authorization one) — never sets any describe-scoped `root` itself; every caller
 * assigns its own `root = dir` right after, for that describe block's own `afterEach` cleanup. */
async function setUpWorkspaceWithProject(): Promise<{
  readonly root: string;
  readonly workspace: FsWorkspaceRepository;
}> {
  const dir = await makeTmpDir();
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

  it('allows a plain commit into one project and completes both trailers for real', async () => {
    const { root: dir } = await setUpWorkspaceWithProject();
    root = dir;
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
    root = dir;
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
    root = dir;
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
    root = dir;
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
    root = dir;
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
    root = dir;
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

  it('refuses with a clear message (never a raw shell error) when the recorded seeya binary is missing (V2-T34, PO review defect 2)', async () => {
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
    const beforeHash = await headHash(dir);
    // A path that genuinely does not exist on this machine — the real scenario is "seeya moved or
    // was uninstalled since the last open," reproduced here without needing either.
    const missingNodePath = path.join(dir, 'this-node-binary-does-not-exist');
    await workspace.installCommitMsgHook(
      dir,
      buildCommitMsgHookScript(missingNodePath, CLI_ENTRY_PATH),
    );

    await writeFile(path.join(dir, 'auth-hardening', 'status', 'current.md'), 'x\n');
    await runGit(dir, ['add', 'auth-hardening']);
    const attempt = await realCommit(dir, 'Edit with a stale hook', process.env);

    expect(attempt.exitCode).not.toBe(0);
    // The FIX under test: a clear, actionable message — not sh's own raw "No such file or
    // directory" for a plain `exec` on a path that doesn't exist (the pre-fix behavior).
    expect(attempt.stderr).toContain(missingNodePath);
    expect(attempt.stderr).toContain('seeya project open');
    expect(attempt.stderr).not.toContain('No such file or directory');
    expect(await headHash(dir)).toBe(beforeHash);
  }, 30_000);

  it('lets a real commit through when cliEntryPath is inside a real .asar FILE (V2-T34 production defect, PO review 2026-09-25)', async () => {
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
    // A REAL file named exactly like Electron's own asar archive — the production defect: the
    // shell's naive `[ -f "$cliEntryPath" ]` on the FULL inner path always failed against this,
    // even though the .asar file itself is right there. Content is irrelevant (a real `app.asar`
    // is an opaque archive blob to a shell too) — only its existence as a FILE matters here.
    const asarPath = path.join(dir, 'app.asar');
    await writeFile(asarPath, 'not a real asar archive, just needs to exist as a file\n');
    const cliEntryPath = path.join(
      asarPath,
      'node_modules',
      '@seeya-ai',
      'cli',
      'dist',
      'index.js',
    );
    // A stand-in for the packaged `seeya` binary (`nodePath`) — plain node can never actually read
    // INSIDE a real `.asar` (only Electron's own patched `fs` can); this script stands in for that
    // real capability so the test can prove what's actually under test here — the shell's own
    // pre-flight existence check — without needing a full Electron install. It ignores its
    // arguments and always approves, exactly what "verify-commit says yes" looks like from the
    // hook script's own point of view.
    const fakeNodePath = path.join(dir, 'fake-seeya-node');
    await writeFile(fakeNodePath, '#!/bin/sh\nexit 0\n');
    await chmod(fakeNodePath, 0o755);
    await workspace.installCommitMsgHook(dir, buildCommitMsgHookScript(fakeNodePath, cliEntryPath));

    await writeFile(path.join(dir, 'auth-hardening', 'status', 'current.md'), 'x\n');
    await runGit(dir, ['add', 'auth-hardening']);
    const attempt = await realCommit(dir, 'Edit under a packaged (asar) install', process.env);

    // The FIX under test: before it, this always refused with "can't find its seeya binary" — the
    // existence check ran against the full, never-real inner path. Now it passes the check and
    // actually calls the (stand-in) verifier, which approves.
    expect(attempt.stderr).not.toContain("can't find its seeya binary");
    expect(attempt.exitCode).toBe(0);
  }, 30_000);
});

/**
 * V2-T34 hotfix (PO review, 2026-09-25): the maintainer found, on real use right after the asar
 * fix above landed, that EVERY commit `seeya` itself makes while holding a project's own lock was
 * refused by this same hook — the reason finally SHOWED (the asar fix's own point), and it was
 * `core/workspace-commit-guard.ts`'s own session check, which `CLAUDE_CODE_SESSION_ID` can never
 * satisfy for a commit seeya makes on its own. These prove the same-process authorization fix for
 * every real shape of commit that needed it — `commitAll`/`revertCommits` called exactly the way
 * each `application/project-*.ts` flow calls them, against a REAL `.seeya-lock`, through the REAL
 * hook, calling the REAL compiled CLI — under both environments the maintainer named: no
 * `CLAUDE_CODE_SESSION_ID` at all (the packaged app, or a plain terminal) and a DIFFERENT session's
 * `CLAUDE_CODE_SESSION_ID` (seeya invoked from inside another running Claude Code session).
 */
describe('same-process lock-holder authorization — real execution (V2-T34 hotfix, PO review 2026-09-25)', () => {
  let root: string | undefined;
  const projectLock = new FsProjectLock();

  afterEach(async () => {
    if (root !== undefined) {
      await rm(root, { recursive: true, force: true });
      root = undefined;
    }
  });

  /** Mutates THIS test process's own `CLAUDE_CODE_SESSION_ID` for the duration of `fn` —
   * `commitAll`/`revertCommits` spread `process.env` directly (the same environment the workspace's
   * own commit-msg hook, and thus `seeya project verify-commit`, actually inherits from a real
   * `seeya` process), so this is the faithful way to prove both scenarios without inventing a
   * second `runGit`-adjacent parameter no real caller has. Always restored, even on throw. */
  async function withSessionIdEnv<T>(value: string | undefined, fn: () => Promise<T>): Promise<T> {
    const original = process.env['CLAUDE_CODE_SESSION_ID'];
    if (value === undefined) {
      delete process.env['CLAUDE_CODE_SESSION_ID'];
    } else {
      process.env['CLAUDE_CODE_SESSION_ID'] = value;
    }
    try {
      return await fn();
    } finally {
      if (original === undefined) {
        delete process.env['CLAUDE_CODE_SESSION_ID'];
      } else {
        process.env['CLAUDE_CODE_SESSION_ID'] = original;
      }
    }
  }

  const ENV_SCENARIOS: readonly [string, string | undefined][] = [
    ['no CLAUDE_CODE_SESSION_ID at all (the app, or a plain terminal)', undefined],
    [
      "a DIFFERENT session's CLAUDE_CODE_SESSION_ID (seeya invoked from inside another session)",
      'some-other-running-session',
    ],
  ];

  it.each(ENV_SCENARIOS)(
    'adoptSession-shaped commit is accepted while holding the lock under the fork id — %s',
    async (_label, envSessionId) => {
      const { root: dir, workspace } = await setUpWorkspaceWithProject();
      root = dir;
      await projectLock.write(dir, 'auth-hardening', {
        sessionId: 'fork-session-uuid',
        pid: process.pid,
        procStart: undefined,
        acquiredAt: new Date(),
      });
      await writeFile(path.join(dir, 'auth-hardening', 'context', 'know-how.md'), 'learned\n');
      await runGit(dir, ['add', 'auth-hardening']);
      const message = buildProjectCommitMessage(
        'Adopt session 11111111-1111-4111-8111-111111111111 into project auth-hardening',
        'auth-hardening',
        'fork-session-uuid',
      );

      await withSessionIdEnv(envSessionId, () =>
        workspace.commitAll(dir, 'auth-hardening', message, {
          pid: process.pid,
          procStart: undefined,
        }),
      );

      expect(await headMessage(dir)).toContain('Seeya-Session-Id: fork-session-uuid');
    },
    30_000,
  );

  it.each(ENV_SCENARIOS)(
    "openProject's leftover-changes commit is accepted while holding the lock under a freshly launched session id — %s",
    async (_label, envSessionId) => {
      const { root: dir, workspace } = await setUpWorkspaceWithProject();
      root = dir;
      await projectLock.write(dir, 'auth-hardening', {
        sessionId: 'launched-session-uuid',
        pid: process.pid,
        procStart: undefined,
        acquiredAt: new Date(),
      });
      await writeFile(path.join(dir, 'auth-hardening', 'status', 'current.md'), 'left over\n');
      await runGit(dir, ['add', 'auth-hardening']);
      // D-025: nobody present can say whose these were — `undefined`, same as `project-open.ts
      // #handleLeftoverChanges` really passes.
      const message = buildProjectCommitMessage(
        'Commit changes left uncommitted before opening auth-hardening',
        'auth-hardening',
        undefined,
      );

      await withSessionIdEnv(envSessionId, () =>
        workspace.commitAll(dir, 'auth-hardening', message, {
          pid: process.pid,
          procStart: undefined,
        }),
      );

      // The exact production defect (item 2): the trailer says "unknown" and must STAY "unknown"
      // — never recomputed into "launched-session-uuid" from the lock and refused for
      // "contradicting" it.
      const finalMessage = await headMessage(dir);
      expect(finalMessage).toContain('Seeya-Session-Id: unknown');
      expect(finalMessage).not.toContain('launched-session-uuid');
    },
    30_000,
  );

  it.each(ENV_SCENARIOS)(
    'removeProject-shaped commit — %s',
    async (_label, envSessionId) => {
      const { root: dir, workspace } = await setUpWorkspaceWithProject();
      root = dir;
      // A GENUINE finding while writing this test, worth keeping (not the same-process fix at
      // all): `removeProjectDirectory` (`adapters/workspace/index.ts`) `rm -rf`s the WHOLE project
      // directory BEFORE `commitAll` runs — `.seeya-lock` lives inside it, so by the time the
      // commit-msg hook reads the lock, it is already gone (`lock === null`), the exact same "no
      // lock at all" path `createProject`/`addRepository` take. `removeProject`'s own commit was
      // never actually broken by the lock-vs-session defect (item 1) — it just needs its trailer
      // (`deps.sessionId`) to match `currentSessionId` (the SAME env var, read once at the same
      // composition root), which real code already guarantees by construction.
      await rm(path.join(dir, 'auth-hardening'), { recursive: true, force: true });
      const message = buildProjectCommitMessage(
        'Remove project auth-hardening',
        'auth-hardening',
        envSessionId,
      );

      await withSessionIdEnv(envSessionId, () =>
        workspace.commitAll(dir, 'auth-hardening', message),
      );

      expect(await headMessage(dir)).toContain(`Seeya-Session-Id: ${envSessionId ?? 'unknown'}`);
    },
    30_000,
  );

  it.each(ENV_SCENARIOS)(
    'removeRepository-shaped commit is accepted while holding the lock under an unidentified session — %s',
    async (_label, envSessionId) => {
      const { root: dir, workspace } = await setUpWorkspaceWithProject();
      root = dir;
      await projectLock.write(dir, 'auth-hardening', {
        sessionId: undefined,
        pid: process.pid,
        procStart: undefined,
        acquiredAt: new Date(),
      });
      await writeFile(path.join(dir, 'auth-hardening', 'seeya.json'), '{"repositories":[]}\n');
      await runGit(dir, ['add', 'auth-hardening']);
      const message = buildProjectCommitMessage(
        'Remove repository app-api from project auth-hardening',
        'auth-hardening',
        undefined,
      );

      await withSessionIdEnv(envSessionId, () =>
        workspace.commitAll(dir, 'auth-hardening', message, {
          pid: process.pid,
          procStart: undefined,
        }),
      );

      expect(await headMessage(dir)).toContain('Seeya-Session-Id: unknown');
    },
    30_000,
  );

  it.each(ENV_SCENARIOS)(
    'revertAdoption-shaped final commit (via revertCommits) is accepted while holding the lock — %s',
    async (_label, envSessionId) => {
      const { root: dir, workspace } = await setUpWorkspaceWithProject();
      root = dir;
      await writeFile(path.join(dir, 'auth-hardening', 'context', 'know-how.md'), 'from fork\n');
      await runGit(dir, ['add', 'auth-hardening']);
      // Simulates the ADOPTION'S OWN, separate, earlier lock lifetime (a real `seeya project
      // adopt` run, whose commit is authorized by same-process, independent of whatever
      // `envSessionId` a LATER, unrelated `revert-adoption` invocation's environment carries) —
      // wrapped in its own `withSessionIdEnv(undefined, ...)` so it never depends on ambient state.
      await projectLock.write(dir, 'auth-hardening', {
        sessionId: 'fork-session-uuid',
        pid: process.pid,
        procStart: undefined,
        acquiredAt: new Date(),
      });
      await withSessionIdEnv(undefined, () =>
        workspace.commitAll(
          dir,
          'auth-hardening',
          buildProjectCommitMessage(
            'Adopt session 11111111-1111-4111-8111-111111111111 into project auth-hardening',
            'auth-hardening',
            'fork-session-uuid',
          ),
          { pid: process.pid, procStart: undefined },
        ),
      );
      const forkCommit = await headHash(dir);
      // The adoption's own lock is released; a SEPARATE, later `seeya project revert-adoption`
      // takes its own, under `envSessionId` — same value feeding both the lock and the trailer,
      // exactly like `deps.sessionId` does in real code.
      await projectLock.write(dir, 'auth-hardening', {
        sessionId: envSessionId,
        pid: process.pid,
        procStart: undefined,
        acquiredAt: new Date(),
      });
      const message = buildProjectCommitMessage(
        'Revert adoption of session fork-session-uuid from project auth-hardening',
        'auth-hardening',
        envSessionId,
      );

      const outcome = await withSessionIdEnv(envSessionId, () =>
        workspace.revertCommits(dir, 'auth-hardening', [forkCommit], message, {
          pid: process.pid,
          procStart: undefined,
        }),
      );

      expect(outcome.kind).toBe('committed');
      expect(await headMessage(dir)).toContain(`Seeya-Session-Id: ${envSessionId ?? 'unknown'}`);
    },
    30_000,
  );

  it.each(ENV_SCENARIOS)(
    'createProject-shaped commit (no lock at all) still needs no lockHolder — %s',
    async (_label, envSessionId) => {
      const dir = await makeTmpDir();
      root = dir;
      const workspace = new FsWorkspaceRepository();
      await workspace.initialize(dir);
      await workspace.writeProjectSkeleton(dir, 'billing-v2', buildProjectSkeleton('billing-v2'));
      await workspace.installCommitMsgHook(
        dir,
        buildCommitMsgHookScript(process.execPath, CLI_ENTRY_PATH),
      );

      // No `.seeya-lock` was ever written for this brand-new project — `createProject`/
      // `addRepository` never take one (this suite's own module docstring). The trailer mirrors
      // `envSessionId`, same as real code: `deps.sessionId` (read once from the same env var)
      // feeds both the message and `currentSessionId`.
      await withSessionIdEnv(envSessionId, () =>
        workspace.commitAll(
          dir,
          'billing-v2',
          buildProjectCommitMessage('Create project billing-v2', 'billing-v2', envSessionId),
        ),
      );

      expect(await headMessage(dir)).toContain(`Seeya-Session-Id: ${envSessionId ?? 'unknown'}`);
    },
    30_000,
  );

  it('still refuses an outsider process, holding neither the session nor the process identity, against a DIFFERENT live session (the forbidden case stays forbidden)', async () => {
    const { root: dir, workspace } = await setUpWorkspaceWithProject();
    root = dir;
    const beforeHash = await headHash(dir);
    // A real, live process this test controls — not THIS test process — same technique the
    // "refuses a commit into a project locked by a DIFFERENT, live session" scenario above uses.
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      stdio: 'ignore',
    });
    try {
      await new Promise((resolve) => setTimeout(resolve, 200));
      await projectLock.write(dir, 'auth-hardening', {
        sessionId: 'holder-session',
        pid: child.pid as number,
        procStart: undefined,
        acquiredAt: new Date(),
      });
      await writeFile(path.join(dir, 'auth-hardening', 'status', 'current.md'), 'sneaky\n');
      await runGit(dir, ['add', 'auth-hardening']);
      const message = buildProjectCommitMessage('Sneaky edit', 'auth-hardening', undefined);

      await expect(
        withSessionIdEnv('outsider-session', () =>
          // A DIFFERENT pid than the lock's own holder — never authorized by same-process either.
          workspace.commitAll(dir, 'auth-hardening', message, {
            pid: process.pid,
            procStart: undefined,
          }),
        ),
      ).rejects.toThrow(/git commit failed/);
      expect(await headHash(dir)).toBe(beforeHash);
    } finally {
      child.kill();
    }
  }, 30_000);
});
