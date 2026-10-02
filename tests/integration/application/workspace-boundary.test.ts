/**
 * V2-T27 item 4: "o git do espaço de trabalho é do seeya, e ele commita o que cria — mas nunca
 * entra aí nada de `~/.seeya/` (estado operacional, locks, config do dispositivo). A separação é
 * explícita e testada." This is that test — a real `StorageAdapter` (`~/.seeya/`) and a real
 * `FsWorkspaceRepository` (the workspace's own git repository), both against the same real
 * `tmpdir`, with genuine sibling `~/.seeya/` operational files already present before
 * `createProject` ever runs. Proven by execution, not by argument: the workspace's own `git
 * ls-files` is inspected directly, not just "the default path is a subdirectory so it should be
 * fine".
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StorageAdapter } from '@seeya-ai/engine/adapters/storage/index.js';
import { FsWorkspaceRepository, FsProjectLock } from '@seeya-ai/engine/adapters/workspace/index.js';
import { processControl } from '@seeya-ai/engine/adapters/process/index.js';
import { runGit } from '@seeya-ai/engine/adapters/git/run-git.js';
import { createProject } from '@seeya-ai/engine/application/workspace.js';
import type { WorkspaceCommandDeps } from '@seeya-ai/engine/application/workspace.js';

// V2-T34 item 1: `createProject` now installs a REAL commit-msg hook (`ensureWorkspaceHooksInstalled`)
// before its own `commitAll` — a fake `cliEntryPath` would make that real `git commit` genuinely
// fail (the hook itself fails to even run `node <fake path>`), so this points at the real, compiled
// CLI entry, same technique `tests/integration/workspace/commit-msg-hook.test.ts` uses.
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CLI_ENTRY_PATH = path.join(REPO_ROOT, 'packages', 'cli', 'dist', 'index.js');

/**
 * V2-T78: each case here runs `createProject` end to end — `git init`, two `git config --local`,
 * the hook install, `git add`, `git diff --cached --quiet`, then `git commit`, whose own
 * commit-msg hook shells out to a SECOND real Node process (the compiled CLI, `verify-commit`,
 * which itself spawns a third `git diff` to read the staged files). Measured on this machine,
 * isolated, no other load: ~0.8-2.5s per case — already more than half of vitest's 5000ms
 * default with zero contention. Confirmed as the real cause, not guessed: this file's own CI/local
 * failures (`docs/QUESTOES.md`, this task) always paired "Test timed out in 5000ms" with the
 * `EBUSY` on the `afterEach` `rm` below — reproduced deterministically here by temporarily giving
 * one case an artificially tiny timeout (50ms) and observing both errors fire together. A vitest
 * test timeout does not stop the test function's own execution (there is no real cancellation of a
 * running `await` chain); the still-running `git commit`/hook/CLI process chain keeps the tmpdir
 * busy for a little longer, and `afterEach`'s `rm` loses that race. 20000ms gives this file's
 * legitimate, measured per-case cost (≤2.5s unloaded) a wide margin under the same kind of
 * multi-project CPU contention `tests/integration/guards/_support.ts#CHILD_PROCESS_BUDGET_MS`
 * documents for a real ESLint child process (measured there up to ~12s under load, for a lighter
 * operation than this one) — generous, but still far short of "never times out" (AGENTS.md: don't
 * trade away the ability to catch a real hang).
 */
const WORKSPACE_CASE_TIMEOUT_MS = 20_000;

function buildDeps(
  storage: StorageAdapter,
  workspace: FsWorkspaceRepository,
  seeyaHome: string,
): WorkspaceCommandDeps {
  return {
    storage,
    workspace,
    projectLock: new FsProjectLock(),
    processControl,
    seeyaHome,
    // The SAME source `packages/cli/src/composition.ts#readCurrentSessionId` reads in production
    // — never a hardcoded `undefined`. `createProject`'s own commit trailer (`buildProjectCommitMessage`)
    // and the REAL commit-msg hook this test now installs both end up reading THIS exact value
    // (the hook through its own environment, inherited from this very process): a mismatch here
    // would make the hook refuse its own caller's commit as "a contradicting trailer" — genuinely
    // reproduced when running this suite inside a live Claude Code session, whose own
    // CLAUDE_CODE_SESSION_ID would otherwise leak into the spawned `git commit`/hook while this
    // constant claimed `undefined`.
    sessionId: process.env['CLAUDE_CODE_SESSION_ID'],
    nodePath: process.execPath,
    cliEntryPath: CLI_ENTRY_PATH,
  };
}

async function makeTmpDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'seeya-workspace-boundary-'));
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

describe('the workspace repository never tracks ~/.seeya/ operational state', () => {
  let seeyaHome: string | undefined;

  afterEach(async () => {
    if (seeyaHome !== undefined) {
      // V2-T78: `maxRetries`/`retryDelay` — `fs.rm`'s own documented mechanism for a transient
      // Windows `EBUSY`/`ENOTEMPTY` right after a spawned process's `close` event already fired,
      // same technique and same reasoning `tests/e2e/_harness.ts#removeE2eHome` already uses for
      // an identical real `EBUSY` it observed on this exact kind of cleanup (a directory a child
      // process just finished writing into). Here it's a backstop underneath the real fix
      // (`WORKSPACE_CASE_TIMEOUT_MS` above, which keeps the test from timing out and abandoning
      // the still-running process chain in the first place) — belt and suspenders, not a
      // replacement for it.
      await rm(seeyaHome, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      seeyaHome = undefined;
    }
  });

  it(
    'git ls-files inside the workspace never names an operational file from ~/.seeya/',
    async () => {
      seeyaHome = await makeTmpDir();
      // Genuine ~/.seeya/ operational content, present BEFORE the workspace is ever created —
      // exactly the layout a real machine has (config.json/estado.json/daemon.lock siblings of the
      // workspace/ subdirectory). Anonymized fixture content only (AGENTS.md § "Este projeto é de
      // código aberto") — no real path, token or session data.
      await writeFile(
        path.join(seeyaHome, 'config.json'),
        JSON.stringify({ schemaVersion: 1 }),
        'utf8',
      );
      await writeFile(
        path.join(seeyaHome, 'estado.json'),
        JSON.stringify({ schemaVersion: 1 }),
        'utf8',
      );
      await writeFile(path.join(seeyaHome, 'daemon.lock'), JSON.stringify({ pid: 1234 }), 'utf8');

      const storage = new StorageAdapter(seeyaHome);
      const workspace = new FsWorkspaceRepository();
      const result = await createProject(
        buildDeps(storage, workspace, seeyaHome),
        'auth-hardening',
      );
      expect(result.kind).toBe('created');

      const workspaceRoot = path.join(seeyaHome, 'workspace');
      const lsFiles = await runGit(workspaceRoot, ['ls-files']);
      if (!lsFiles.ran) {
        throw new Error(`git ls-files never ran: ${lsFiles.reason}`);
      }
      expect(lsFiles.exitCode).toBe(0);
      const trackedFiles = lsFiles.stdout
        .trim()
        .split(/\r?\n/)
        .filter((line: string) => line.length > 0);

      // Every tracked path belongs to the project just created, except `.gitignore` itself — the
      // one shared, workspace-root file `commitAll` also stages (V2-T33, D-047 item 2: it's what
      // keeps `.seeya-lock` out of every project's own commits, so it has to be tracked too).
      expect(trackedFiles.length).toBeGreaterThan(0);
      for (const file of trackedFiles) {
        expect(file === '.gitignore' || file.startsWith('auth-hardening/')).toBe(true);
      }
      // The operational files by name, explicitly — the strongest form of this assertion.
      expect(trackedFiles).not.toContain('config.json');
      expect(trackedFiles).not.toContain('estado.json');
      expect(trackedFiles).not.toContain('daemon.lock');
      expect(trackedFiles).not.toContain('workspace.json');
      expect(trackedFiles).toContain('.gitignore');
    },
    WORKSPACE_CASE_TIMEOUT_MS,
  );

  it(
    'the workspace git repository root is the workspace/ subdirectory, not ~/.seeya/ itself',
    async () => {
      seeyaHome = await makeTmpDir();
      const storage = new StorageAdapter(seeyaHome);
      const workspace = new FsWorkspaceRepository();
      await createProject(buildDeps(storage, workspace, seeyaHome), 'auth-hardening');

      // `.git` lives one level down — ~/.seeya/ itself is never a git working tree, so nothing
      // outside workspace/ could ever be tracked no matter what a future writeProjectSkeleton call
      // does.
      expect(await pathExists(path.join(seeyaHome, '.git'))).toBe(false);
      expect(await pathExists(path.join(seeyaHome, 'workspace', '.git'))).toBe(true);
    },
    WORKSPACE_CASE_TIMEOUT_MS,
  );

  it(
    'workspace.json (the pointer to where the workspace lives) is written outside the workspace itself',
    async () => {
      seeyaHome = await makeTmpDir();
      const storage = new StorageAdapter(seeyaHome);
      const workspace = new FsWorkspaceRepository();
      await createProject(buildDeps(storage, workspace, seeyaHome), 'auth-hardening');

      expect(await pathExists(path.join(seeyaHome, 'workspace.json'))).toBe(true);
      expect(await pathExists(path.join(seeyaHome, 'workspace', 'workspace.json'))).toBe(false);
    },
    WORKSPACE_CASE_TIMEOUT_MS,
  );
});
