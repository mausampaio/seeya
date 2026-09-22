/**
 * `application/project-lock.ts` (V2-T33, D-047 items 1/2) wired to the REAL `adapters/process` and
 * a real `FsProjectLock` over `tmpdir` — same technique `tests/integration/scheduler/lock.test.ts`
 * already established for `daemon.lock`'s own recycled-pid tie-break: a real spawned child stands
 * in for "the process the lock currently points at", proving the SAME vivacity check this module's
 * own docstring says is reused, not reimplemented (D-047 item 2).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  acquireProjectLock,
  checkProjectLock,
  releaseProjectLock,
} from '@seeya-ai/engine/application/project-lock.js';
import { FsProjectLock } from '@seeya-ai/engine/adapters/workspace/project-lock.js';
import { processControl } from '@seeya-ai/engine/adapters/process/index.js';
import { captureObservedProcStart } from '@seeya-ai/engine/adapters/process/proc-start.js';
import { processExists } from '@seeya-ai/engine/adapters/process/existence.js';

const CHILD_SCRIPT = fileURLToPath(
  new URL('../../fixtures/process/graceful-child.mjs', import.meta.url),
);

let spawned: ChildProcess[] = [];
let root: string | undefined;

function spawnTrivialChild(): ChildProcess {
  const child = spawn(process.execPath, [CHILD_SCRIPT], { stdio: 'ignore' });
  spawned.push(child);
  return child;
}

async function readRealProcStart(pid: number): Promise<string> {
  const capture = await captureObservedProcStart(pid, processExists);
  if (capture.kind !== 'value') {
    throw new Error(`expected a real procStart capture, got ${JSON.stringify(capture)}`);
  }
  return capture.value;
}

afterEach(async () => {
  for (const child of spawned) {
    try {
      child.kill('SIGKILL');
    } catch {
      // Already dead — fine, this is test cleanup, not the product's own termination policy.
    }
  }
  spawned = [];
  if (root !== undefined) {
    await rm(root, { recursive: true, force: true });
    root = undefined;
  }
});

async function makeProjectDir(): Promise<string> {
  root = await mkdtemp(path.join(tmpdir(), 'seeya-project-lock-app-'));
  await mkdir(path.join(root, 'auth-hardening'), { recursive: true });
  return root;
}

describe('checkProjectLock / acquireProjectLock — against real adapters/process', () => {
  it('a live pid whose recorded procStart no longer matches is treated as a DEAD lock (recycled pid) — reused tie-break, not a project-lock-specific one', async () => {
    const workspaceRoot = await makeProjectDir();
    const child = spawnTrivialChild();
    const pid = child.pid as number;
    const projectLock = new FsProjectLock();
    await projectLock.write(workspaceRoot, 'auth-hardening', {
      sessionId: 'stale-session',
      pid,
      procStart: 'this-will-never-equal-a-real-capture',
      acquiredAt: new Date('2026-09-01T00:00:00.000Z'),
    });

    const decision = await checkProjectLock(
      { projectLock, processControl },
      workspaceRoot,
      'auth-hardening',
    );

    expect(decision).toStrictEqual({ kind: 'acquire' });
  });

  it('a live pid whose recorded procStart DOES match refuses, naming the real holder', async () => {
    const workspaceRoot = await makeProjectDir();
    const child = spawnTrivialChild();
    const pid = child.pid as number;
    const realProcStart = await readRealProcStart(pid);
    const projectLock = new FsProjectLock();
    const holder = {
      sessionId: 'live-session',
      pid,
      procStart: realProcStart,
      acquiredAt: new Date('2026-09-01T00:00:00.000Z'),
    };
    await projectLock.write(workspaceRoot, 'auth-hardening', holder);

    const decision = await checkProjectLock(
      { projectLock, processControl },
      workspaceRoot,
      'auth-hardening',
    );

    expect(decision).toStrictEqual({ kind: 'refuse', heldBy: holder });
  });

  it('a genuinely dead pid acquires regardless of any recorded procStart (ordinary stale-lock case)', async () => {
    const workspaceRoot = await makeProjectDir();
    const child = spawnTrivialChild();
    const pid = child.pid as number;
    child.kill('SIGKILL');
    await new Promise<void>((resolve) => child.once('exit', () => resolve()));

    const projectLock = new FsProjectLock();
    await projectLock.write(workspaceRoot, 'auth-hardening', {
      sessionId: 'dead-session',
      pid,
      procStart: 'whatever-was-recorded-does-not-matter-here',
      acquiredAt: new Date('2026-09-01T00:00:00.000Z'),
    });

    const decision = await checkProjectLock(
      { projectLock, processControl },
      workspaceRoot,
      'auth-hardening',
    );

    expect(decision).toStrictEqual({ kind: 'acquire' });
  });

  it('acquireProjectLock writes a real, self-captured procStart on acquire, and it round-trips through FsProjectLock', async () => {
    const workspaceRoot = await makeProjectDir();
    const projectLock = new FsProjectLock();
    // Stand-in for the CLI composition root's own self-capture — captured for the TEST RUNNER's
    // own pid, since that's the only pid this test can guarantee is alive throughout.
    const ownProcStart = await readRealProcStart(process.pid);
    const now = new Date('2026-09-05T10:00:00.000Z');

    const outcome = await acquireProjectLock(
      { projectLock, processControl },
      workspaceRoot,
      'auth-hardening',
      { pid: process.pid, procStart: ownProcStart, sessionId: 'this-session' },
      now,
    );

    expect(outcome).toStrictEqual({ decision: { kind: 'acquire' }, reclaimedStale: null });
    expect(await projectLock.read(workspaceRoot, 'auth-hardening')).toStrictEqual({
      sessionId: 'this-session',
      pid: process.pid,
      procStart: ownProcStart,
      acquiredAt: now,
    });
  });

  it('a live holder refuses acquisition and releaseProjectLock refuses to clear a lock this pid never took', async () => {
    const workspaceRoot = await makeProjectDir();
    const child = spawnTrivialChild();
    const pid = child.pid as number;
    const realProcStart = await readRealProcStart(pid);
    const projectLock = new FsProjectLock();
    const holder = {
      sessionId: 'live-session',
      pid,
      procStart: realProcStart,
      acquiredAt: new Date('2026-09-01T00:00:00.000Z'),
    };
    await projectLock.write(workspaceRoot, 'auth-hardening', holder);

    const outcome = await acquireProjectLock(
      { projectLock, processControl },
      workspaceRoot,
      'auth-hardening',
      { pid: process.pid, procStart: undefined, sessionId: 'this-session' },
      new Date('2026-09-05T10:00:00.000Z'),
    );
    expect(outcome).toStrictEqual({
      decision: { kind: 'refuse', heldBy: holder },
      reclaimedStale: null,
    });

    // This test runner's own pid never held the lock — releasing with it has to refuse, not
    // silently clear someone else's live lock (D-047 item 1).
    const release = await releaseProjectLock(
      { projectLock },
      workspaceRoot,
      'auth-hardening',
      process.pid,
    );
    expect(release).toStrictEqual({ kind: 'refuse', heldBy: holder });
    expect(await projectLock.read(workspaceRoot, 'auth-hardening')).toStrictEqual(holder);
  });
});
