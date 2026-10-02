/**
 * V2-T31: `composition/daemon-start.ts#startDaemonAndWait` — launches, then waits for
 * `daemon.lock` to show up alive before answering. Every dependency is a named double: no real
 * process is spawned and no real time passes (`CountingClock.sleep` resolves immediately and
 * advances a scripted lock timeline instead).
 */
import { describe, expect, it } from 'vitest';
import type { Clock, ProcessControl } from '@seeya-ai/engine/core/ports.js';
import type { LockAcquisitionDecision } from '@seeya-ai/engine/core/daemon-lock.js';
import { runDaemonStop } from '@seeya-ai/engine/scheduler/daemon-control.js';
import { checkLiveLock } from '@seeya-ai/engine/scheduler/daemon-state.js';
import {
  DAEMON_START_DEADLINE_MS,
  DAEMON_START_POLL_INTERVAL_MS,
  formatDaemonStartOutcome,
  startDaemonAndWait,
  type DaemonStartDeps,
} from '../../../../packages/app/src/composition/daemon-start.js';
import { resolveDaemonControlAvailability } from '../../../../packages/app/src/state/daemon-control-panel.js';
import { createConfig } from '../../core/_fixtures.js';
import { InMemoryDaemonStorage } from '../../scheduler/_fakes.js';

const LAUNCHED_PID = 777;
const LOCK_TIME = new Date('2026-10-02T10:00:00.000Z');

/** Resolves `sleep` instantly, counts each call, and writes the daemon's lock into the storage
 * once `appearsAfterSleeps` sleeps have happened (`null` = never) — the slow-boot timeline. */
class CountingClock implements Clock {
  sleeps: number[] = [];
  constructor(
    private readonly storage: InMemoryDaemonStorage,
    private readonly appearsAfterSleeps: number | null,
  ) {}
  now(): Date {
    return LOCK_TIME;
  }
  async sleep(ms: number): Promise<void> {
    this.sleeps.push(ms);
    if (this.appearsAfterSleeps !== null && this.sleeps.length === this.appearsAfterSleeps) {
      await this.storage.writeDaemonLock({
        pid: LAUNCHED_PID,
        startedAt: LOCK_TIME,
        procStart: undefined,
      });
    }
  }
}

/** Every pid is alive — the only thing under test is WHEN the lock file appears. */
class EveryPidAliveProcessControl implements ProcessControl {
  isAlive(): Promise<boolean> {
    return Promise.resolve(true);
  }
  terminateGracefully(): Promise<boolean> {
    return Promise.resolve(true);
  }
  terminateAbruptly(): Promise<void> {
    return Promise.resolve();
  }
}

class SpawnRecorder {
  spawned = 0;
  spawn = (): Promise<number> => {
    this.spawned += 1;
    return Promise.resolve(LAUNCHED_PID);
  };
}

function buildDeps(
  storage: InMemoryDaemonStorage,
  clock: Clock,
  recorder: SpawnRecorder,
  decision: LockAcquisitionDecision = { kind: 'acquire' },
): DaemonStartDeps {
  return {
    storage,
    processControl: new EveryPidAliveProcessControl(),
    clock,
    checkLock: () => Promise.resolve(decision),
    spawnDaemon: recorder.spawn,
  };
}

describe('startDaemonAndWait', () => {
  it('immediate: a lock already there on the first read is confirmed without sleeping', async () => {
    const storage = new InMemoryDaemonStorage(createConfig());
    await storage.writeDaemonLock({
      pid: LAUNCHED_PID,
      startedAt: LOCK_TIME,
      procStart: undefined,
    });
    const clock = new CountingClock(storage, null);

    const outcome = await startDaemonAndWait(buildDeps(storage, clock, new SpawnRecorder()));

    expect(outcome).toEqual({
      kind: 'confirmed',
      launchedPid: LAUNCHED_PID,
      lockPid: LAUNCHED_PID,
    });
    expect(clock.sleeps).toEqual([]);
  });

  it('slow: the lock appearing after a few polls is confirmed, polling at the measured interval', async () => {
    const storage = new InMemoryDaemonStorage(createConfig());
    const clock = new CountingClock(storage, 3);

    const outcome = await startDaemonAndWait(buildDeps(storage, clock, new SpawnRecorder()));

    expect(outcome).toEqual({
      kind: 'confirmed',
      launchedPid: LAUNCHED_PID,
      lockPid: LAUNCHED_PID,
    });
    expect(clock.sleeps).toEqual([
      DAEMON_START_POLL_INTERVAL_MS,
      DAEMON_START_POLL_INTERVAL_MS,
      DAEMON_START_POLL_INTERVAL_MS,
    ]);
  });

  it('deadline: a lock that never appears reports launched-but-unconfirmed, never started and never failed', async () => {
    const storage = new InMemoryDaemonStorage(createConfig());
    const clock = new CountingClock(storage, null);

    const outcome = await startDaemonAndWait(buildDeps(storage, clock, new SpawnRecorder()));

    expect(outcome).toEqual({
      kind: 'launchedUnconfirmed',
      launchedPid: LAUNCHED_PID,
      waitedMs: DAEMON_START_DEADLINE_MS,
    });
    expect(clock.sleeps).toHaveLength(DAEMON_START_DEADLINE_MS / DAEMON_START_POLL_INTERVAL_MS);
    const text = formatDaemonStartOutcome(outcome);
    expect(text).toContain('not confirmed as running');
    expect(text).not.toContain('started');
    expect(text).not.toContain('failed');
  });

  it('refused: a daemon already alive spawns nothing and waits for nothing', async () => {
    const storage = new InMemoryDaemonStorage(createConfig());
    const clock = new CountingClock(storage, null);
    const recorder = new SpawnRecorder();

    const outcome = await startDaemonAndWait(
      buildDeps(storage, clock, recorder, { kind: 'refuse', heldByPid: 55 }),
    );

    expect(outcome).toEqual({ kind: 'alreadyRunning', heldByPid: 55 });
    expect(recorder.spawned).toBe(0);
    expect(clock.sleeps).toEqual([]);
    expect(formatDaemonStartOutcome(outcome)).toBe(
      'seeya daemon is already running (pid 55). Nothing started.',
    );
  });

  it('confirmed text only claims what was seen: the pid read from the lock', () => {
    expect(formatDaemonStartOutcome({ kind: 'confirmed', launchedPid: 1, lockPid: 2 })).toContain(
      'started (pid 2)',
    );
  });
});

/** Alive until a graceful stop is requested — then dead, like a daemon that obeyed SIGTERM. */
class ObedientDaemonProcessControl implements ProcessControl {
  private alive = true;
  isAlive(): Promise<boolean> {
    return Promise.resolve(this.alive);
  }
  terminateGracefully(): Promise<boolean> {
    this.alive = false;
    return Promise.resolve(true);
  }
  terminateAbruptly(): Promise<void> {
    this.alive = false;
    return Promise.resolve();
  }
}

describe('Stop daemon: the response already reads as "Start" (V2-T31 item 3)', () => {
  it('after runDaemonStop resolves, the availability the handler recomputes is start, not stop', async () => {
    const storage = new InMemoryDaemonStorage(createConfig());
    await storage.writeDaemonLock({ pid: 4242, startedAt: LOCK_TIME, procStart: '1-2' });
    const deps = {
      storage,
      processControl: new ObedientDaemonProcessControl(),
      clock: { now: () => LOCK_TIME, sleep: () => Promise.resolve() },
    };
    expect(resolveDaemonControlAvailability(await checkLiveLock(deps))).toEqual({
      kind: 'stop',
      pid: 4242,
    });

    const text = await runDaemonStop(deps, 'linux');

    expect(text).toContain('Stopped the daemon');
    expect(resolveDaemonControlAvailability(await checkLiveLock(deps))).toEqual({ kind: 'start' });
  });
});
