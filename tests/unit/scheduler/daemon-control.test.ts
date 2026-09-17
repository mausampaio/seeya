/**
 * `scheduler/daemon-control.ts#runDaemonStop` (moved out of `packages/cli/src/daemon-command.ts`
 * in V2-T5b item 3). `tests/unit/cli/daemon-command.test.ts` (importing the SAME function,
 * re-exported unchanged) already covers the graceful/no-lock/stale-lock/unknown states over the
 * CLI's own `ScriptedProcessControl` — this suite's own job is the forced-stop path (Windows, and
 * POSIX escalation after a graceful timeout), which THAT file's own comment explicitly deferred
 * because `terminateAbruptly` used to be a raw, uninjected OS call. Now that it's a
 * `ProcessControl` port method (this task), `ControllableProcessControl`'s own `abruptResult` makes
 * it fully unit-testable — no real OS process touched here at all; that real-process proof stays
 * `tests/integration/cli/daemon-command.test.ts`'s "real abrupt stop" describe block.
 */
import { describe, expect, it } from 'vitest';
import { runDaemonStop } from '@seeya-ai/engine/scheduler/daemon-control.js';
import { createConfig } from '../core/_fixtures.js';
import { InMemoryDaemonStorage, ControllableProcessControl } from './_fakes.js';
import type { DaemonStateDeps } from '@seeya-ai/engine/scheduler/daemon-state.js';
import type { ProcessControl } from '@seeya-ai/engine/core/ports.js';

const LOCK = { pid: 4242, startedAt: new Date('2026-09-05T10:00:00.000Z'), procStart: '123-456' };

function buildDeps(
  storage: InMemoryDaemonStorage,
  processControl: ProcessControl,
): DaemonStateDeps {
  return {
    storage,
    processControl,
    clock: { now: () => new Date(), sleep: () => Promise.resolve() },
  };
}

/** `isAlive` reports `true` until `terminateGracefully`/`terminateAbruptly` is actually called,
 * then `false` from that point on — unlike `ControllableProcessControl`'s own static
 * `aliveByPid` map (fine for every OTHER test in this suite, which only cares about ONE point in
 * time), this test needs the check BEFORE the kill (`checkLiveLock`, still alive) and the
 * confirmation AFTER it (`waitUntilDead`, now dead) to disagree, which a fixed map cannot express. */
class KillableProcessControl implements ProcessControl {
  private alive = true;
  readonly abruptCalls: number[] = [];

  isAlive(): Promise<boolean> {
    return Promise.resolve(this.alive);
  }

  terminateGracefully(): Promise<boolean> {
    // Graceful is scripted to fail in the one test that uses this fake — `runDaemonStop` then
    // escalates to `terminateAbruptly` below, which IS what actually kills it.
    return Promise.resolve(false);
  }

  terminateAbruptly(pid: number): Promise<void> {
    this.abruptCalls.push(pid);
    this.alive = false;
    return Promise.resolve();
  }
}

describe('runDaemonStop — Windows: no graceful path exists, always forced', () => {
  it('a confirmed-dead abrupt stop clears the lock and reports success, without a Windows-mechanism explanation on screen', async () => {
    const storage = new InMemoryDaemonStorage(createConfig());
    await storage.writeDaemonLock(LOCK);
    const processControl = new KillableProcessControl();

    const report = await runDaemonStop(buildDeps(storage, processControl), 'win32');

    expect(report).toBe(
      'Stopped the daemon (pid 4242) forcibly. Nothing was lost: it saves its state after every ' +
        'poll cycle, so the next "seeya daemon" picks up exactly where this one left off.',
    );
    expect(report).not.toContain('AttachConsole');
    expect(report).not.toContain('CTRL_BREAK');
    expect(processControl.abruptCalls).toEqual([4242]);
    expect(await storage.readDaemonLock()).toBeNull();
  });

  it('a pid still observed alive after the forced signal leaves the lock in place (D-025: never guess it died)', async () => {
    const storage = new InMemoryDaemonStorage(createConfig());
    await storage.writeDaemonLock(LOCK);
    // aliveByPid never flips to false — the abrupt stop is "sent" but the pid stays reported alive.
    const processControl = new ControllableProcessControl(new Map([[4242, true]]));

    const report = await runDaemonStop(buildDeps(storage, processControl), 'win32');

    expect(report).toContain('still appears to be alive');
    expect(report).toContain('check manually');
    expect(await storage.readDaemonLock()).not.toBeNull();
  });

  it('a forced stop that could not even be sent leaves the lock in place and names the error', async () => {
    const storage = new InMemoryDaemonStorage(createConfig());
    await storage.writeDaemonLock(LOCK);
    const processControl = new ControllableProcessControl(
      new Map([[4242, true]]),
      undefined,
      () => {
        throw new Error('EPERM: operation not permitted');
      },
    );

    const report = await runDaemonStop(buildDeps(storage, processControl), 'win32');

    expect(report).toContain('Could not send a forced stop to pid 4242');
    expect(report).toContain('EPERM: operation not permitted');
    expect(report).toContain('Nothing was cleared');
    expect(await storage.readDaemonLock()).not.toBeNull();
  });
});

describe('runDaemonStop — POSIX: escalates to forced only after a graceful signal times out', () => {
  it('terminateGracefully succeeding never touches terminateAbruptly at all', async () => {
    const storage = new InMemoryDaemonStorage(createConfig());
    await storage.writeDaemonLock(LOCK);
    const processControl = new ControllableProcessControl(new Map([[4242, true]]), () => true);

    const report = await runDaemonStop(buildDeps(storage, processControl), 'linux');

    expect(report).toContain('gracefully');
    expect(processControl.terminateAbruptlyCalls).toEqual([]);
    expect(await storage.readDaemonLock()).toBeNull();
  });

  it('terminateGracefully failing escalates to the same forced path Windows always takes', async () => {
    const storage = new InMemoryDaemonStorage(createConfig());
    await storage.writeDaemonLock(LOCK);
    const processControl = new KillableProcessControl();

    const report = await runDaemonStop(buildDeps(storage, processControl), 'linux');

    expect(report).toContain('forcibly');
    expect(processControl.abruptCalls).toEqual([4242]);
    expect(await storage.readDaemonLock()).toBeNull();
  });
});
