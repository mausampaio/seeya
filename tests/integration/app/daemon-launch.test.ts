/**
 * V2-T5b item 3: "Start daemon"/"Stop daemon" (`packages/app/src/composition/index.ts#buildAppContext`'s
 * own `startDaemon`/`stopDaemon`), exercised for real — a real `@seeya-ai/cli` bin script resolved
 * via `require.resolve('@seeya-ai/cli/package.json')`, spawned as a real detached child process
 * with `process.execPath` as the Node runtime (this test never runs under real Electron, so
 * `ELECTRON_RUN_AS_NODE` is inert here — the interesting, MEASURED claim this test proves is that
 * the daemon really starts, writes its lock, and that the COMPILED CLI binary — a separate process,
 * against the SAME home — sees it alive, exactly the acceptance `docs/PLANO-DE-ENTREGA.md` V2-T5b
 * asks for ("`seeya status` pela CLI o vê vivo, contra o mesmo home").
 *
 * Reuses `tests/e2e/_harness.ts` (`createE2eHome`/`removeE2eHome`/`runSeeya`) rather than building
 * a second tmpdir-home helper — same real, compiled `packages/cli/dist/index.js` binary this whole
 * suite already spawns for the same purpose elsewhere.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { buildAppContext } from '../../../packages/app/src/composition/index.js';
import { createE2eHome, removeE2eHome, runSeeya, type E2eHome } from '../../e2e/_harness.js';
import { processExists } from '@seeya-ai/engine/adapters/process/existence.js';

let home: E2eHome | undefined;
let lastDaemonPid: number | undefined;
let previousHomeEnv:
  { readonly HOME: string | undefined; readonly USERPROFILE: string | undefined } | undefined;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * `AppContext#startDaemon`'s own `daemonLaunchTarget.env` is built from THIS process's real
 * `process.env` (`composition/index.ts#buildResumptionEnv`) — correct in production, where
 * Electron's own `HOME`/`USERPROFILE` already point at the real user's home. This test runner's
 * `HOME`/`USERPROFILE` do NOT point at the fixture `home.homeDir` on their own, though (nothing
 * about `buildAppContext(home.homeDir)` changes what the SPAWNED child inherits — only what
 * `StorageAdapter`/`DiscoverySessionProvider` themselves read, in THIS process), so without this,
 * the spawned daemon would read/write against the real `~/.seeya` instead of the fixture. Mirrors
 * `tests/e2e/_harness.ts#runSeeya`'s own explicit `HOME`/`USERPROFILE` override for the same
 * reason, just applied to `process.env` here since `spawnDetachedDaemon` (unlike `runSeeya`) is
 * reached indirectly, through the composition root's own already-built `daemonLaunchTarget`.
 */
function pointHomeEnvAt(homeDir: string): void {
  previousHomeEnv = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
  process.env.HOME = homeDir;
  process.env.USERPROFILE = homeDir;
}

function restoreHomeEnv(): void {
  if (previousHomeEnv === undefined) {
    return;
  }
  if (previousHomeEnv.HOME === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = previousHomeEnv.HOME;
  }
  if (previousHomeEnv.USERPROFILE === undefined) {
    delete process.env.USERPROFILE;
  } else {
    process.env.USERPROFILE = previousHomeEnv.USERPROFILE;
  }
  previousHomeEnv = undefined;
}

/** Same "a failing assertion mid-test must never leave a real detached process behind" discipline
 * `tests/e2e/daemon.test.ts`'s own `afterEach` already uses. */
afterEach(async () => {
  restoreHomeEnv();
  if (lastDaemonPid !== undefined) {
    try {
      process.kill(lastDaemonPid, 'SIGKILL');
    } catch {
      // Already gone.
    }
    lastDaemonPid = undefined;
  }
  if (home !== undefined) {
    await removeE2eHome(home);
    home = undefined;
  }
});

function extractPid(message: string): number {
  const match = /pid (\d+)/.exec(message);
  if (match === null) {
    throw new Error(`expected a "pid <N>" in the message, got: ${JSON.stringify(message)}`);
  }
  return Number(match[1]);
}

async function waitForLockFile(seeyaHome: string, timeoutMs: number): Promise<void> {
  const lockPath = path.join(seeyaHome, 'daemon.lock');
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      await readFile(lockPath, 'utf8');
      return;
    } catch {
      if (Date.now() > deadline) {
        throw new Error(`${lockPath} never appeared within ${timeoutMs}ms`);
      }
      await sleep(50);
    }
  }
}

async function waitUntilGone(pid: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (await processExists(pid)) {
    if (Date.now() > deadline) {
      throw new Error(`pid ${pid} was still alive ${timeoutMs}ms after being asked to stop`);
    }
    await sleep(100);
  }
}

describe('AppContext#startDaemon / #stopDaemon — real subprocess, seen by the real CLI', () => {
  it(
    'startDaemon spawns a real, detached seeya daemon; "seeya status" (a SEPARATE, compiled ' +
      'process against the same home) sees it alive; stopDaemon ends it and the lock clears',
    async () => {
      home = await createE2eHome();
      pointHomeEnvAt(home.homeDir);
      const context = await buildAppContext(home.homeDir);

      const startResult = await context.startDaemon();
      expect(startResult).toContain('seeya daemon started');
      const pid = extractPid(startResult);
      lastDaemonPid = pid;
      expect(await processExists(pid)).toBe(true);
      await waitForLockFile(home.seeyaHome, 5_000);

      // The measurement this task's own acceite asks for: a SEPARATE, compiled `seeya status`
      // invocation, against the exact same home, agrees this pid is alive.
      const status = await runSeeya(home, ['status']);
      expect(status.exitCode, `stderr: ${status.stderr}`).toBe(0);
      expect(status.stdout).toContain(`Daemon: running (pid ${pid}`);

      const stopResult = await context.stopDaemon();
      expect(stopResult).toContain(`Stopped the daemon (pid ${pid})`);
      await waitUntilGone(pid, 10_000);
      lastDaemonPid = undefined;

      const statusAfterStop = await runSeeya(home, ['status']);
      expect(statusAfterStop.exitCode, `stderr: ${statusAfterStop.stderr}`).toBe(0);
      expect(statusAfterStop.stdout).toContain('Daemon: not running');
    },
    20_000,
  );

  it('startDaemon refuses (no spawn) when a daemon this home already holds a live lock for', async () => {
    home = await createE2eHome();
    pointHomeEnvAt(home.homeDir);
    const context = await buildAppContext(home.homeDir);

    const first = await context.startDaemon();
    const firstPid = extractPid(first);
    lastDaemonPid = firstPid;
    await waitForLockFile(home.seeyaHome, 5_000);

    const second = await context.startDaemon();

    expect(second).toContain('already running');
    expect(second).toContain(String(firstPid));

    const stopResult = await context.stopDaemon();
    expect(stopResult).toContain('Stopped');
    await waitUntilGone(firstPid, 10_000);
    lastDaemonPid = undefined;
  }, 20_000);
});
