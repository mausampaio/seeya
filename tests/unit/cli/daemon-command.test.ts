/**
 * `cli/daemon-command.ts` (S4-T3). `runDaemonLauncher`'s "already running" path and
 * `runDaemonWorker`'s lock-refusal/signal-stop paths are both deterministic without ever spawning a
 * real process — the "started" launcher path (which DOES spawn for real) is covered instead by
 * `tests/integration/cli/daemon-command.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import {
  resolveDaemonInvocationMode,
  runDaemonWorker,
  runDaemonLauncher,
  runDaemonStatus,
  runDaemonStop,
  type DaemonControlDeps,
} from '../../../packages/cli/src/daemon-command.js';
import type { DaemonDeps } from '@seeya-ai/engine/scheduler/index.js';
import { NOTIFY_AFTER_CONSECUTIVE_CYCLE_FAILURES } from '@seeya-ai/engine/core/daemon-health.js';
import type { DaemonLockInfo } from '@seeya-ai/engine/core/daemon-lock.js';
import type { ProcessControl, Storage } from '@seeya-ai/engine/core/ports.js';
import type { DaemonOwner, DayState } from '@seeya-ai/engine/core/types.js';
import { emptyDayState } from '@seeya-ai/engine/core/schedule.js';
import { createConfig } from '../core/_fixtures.js';
import { InMemoryDaemonStorage } from '../scheduler/_fakes.js';
import {
  DEFAULT_TEST_CONFIG,
  FakeForkCleanup,
  FakeGitReader,
  FakeStorage,
  FakeTranscriptReader,
  failingGenerator,
} from '../application/_fakes.js';

/** Minimal named `Storage` double for this file's own two tests — only the daemon-lock methods a
 * real `runDaemonLauncher`/`runDaemonWorker` call actually touch. */
class LockOnlyStorage extends FakeStorage {
  private lock: DaemonLockInfo | null = null;

  override readDaemonLock(): Promise<DaemonLockInfo | null> {
    return Promise.resolve(this.lock);
  }

  override writeDaemonLock(lock: DaemonLockInfo): Promise<void> {
    this.lock = lock;
    return Promise.resolve();
  }

  override clearDaemonLock(): Promise<void> {
    this.lock = null;
    return Promise.resolve();
  }

  seedLock(lock: DaemonLockInfo): void {
    this.lock = lock;
  }
}

class FixedAliveness implements ProcessControl {
  constructor(private readonly alive: boolean) {}
  isAlive(): Promise<boolean> {
    return Promise.resolve(this.alive);
  }
  terminateGracefully(): Promise<boolean> {
    return Promise.reject(new Error('not exercised'));
  }
  terminateAbruptly(): Promise<void> {
    return Promise.reject(new Error('not exercised'));
  }
}

/** V2-T13: proves `runDaemonLauncher` refuses the moment it sees `daemonOwner.kind === 'app'`,
 * BEFORE ever reading the lock — every `readDaemonLock` call rejects loudly instead of a scripted
 * flag a test would have to remember to assert on. */
class NeverReadStorage extends FakeStorage {
  override readDaemonLock(): Promise<DaemonLockInfo | null> {
    return Promise.reject(new Error('NeverReadStorage.readDaemonLock should not have been called'));
  }
}

/** Same reasoning as `NeverReadStorage` above, for the `ProcessControl` side of the same check. */
class NeverCalledProcessControl implements ProcessControl {
  isAlive(): Promise<boolean> {
    return Promise.reject(
      new Error('NeverCalledProcessControl.isAlive should not have been called'),
    );
  }
  terminateGracefully(): Promise<boolean> {
    return Promise.reject(new Error('not exercised'));
  }
  terminateAbruptly(): Promise<void> {
    return Promise.reject(new Error('not exercised'));
  }
}

const CLI_OWNER: DaemonOwner = { kind: 'cli' };

describe('runDaemonLauncher — refuse path (no spawn)', () => {
  it('reports the pid already holding the lock and never spawns anything', async () => {
    const storage: Storage = new LockOnlyStorage(DEFAULT_TEST_CONFIG);
    (storage as LockOnlyStorage).seedLock({
      pid: 4242,
      startedAt: new Date('2026-09-01T00:00:00.000Z'),
      procStart: undefined,
    });
    const processControl = new FixedAliveness(true);

    const message = await runDaemonLauncher(
      storage,
      processControl,
      {
        nodePath: process.execPath,
        scriptPath: '/nonexistent/should-not-be-spawned.js',
        args: ['daemon'],
      },
      CLI_OWNER,
      'win32',
    );

    expect(message).toContain('already running');
    expect(message).toContain('4242');
  });
});

// V2-T13, D-045 item 3.
describe('runDaemonLauncher — the app owns the daemon (no lock check, no spawn)', () => {
  it('a SEPARATE binary is refused outright, names the app path, and never even checks the lock (V2-T22 regression: still refused)', async () => {
    const storage = new NeverReadStorage(DEFAULT_TEST_CONFIG);
    const processControl = new NeverCalledProcessControl();
    const owner: DaemonOwner = { kind: 'app', launchPath: 'C:\\seeya\\seeya.exe' };

    const message = await runDaemonLauncher(
      storage,
      processControl,
      {
        // A different binary than owner.launchPath — the ordinary, unrelated-CLI case.
        nodePath: process.execPath,
        scriptPath: '/nonexistent/should-not-be-spawned.js',
        args: ['daemon'],
      },
      owner,
      'win32',
    );

    expect(message).toContain('the app is installed');
    expect(message).toContain('C:\\seeya\\seeya.exe');
    expect(message).toContain('seeya daemon');
  });
});

// V2-T22: the installer restarts the daemon by re-running the app's own binary — that call must
// NOT hit the refusal above, or the daemon never comes back after an upgrade (the defect this task
// fixes, measured on the maintainer's machine).
describe('runDaemonLauncher — the caller IS the owning app (V2-T22)', () => {
  it("proceeds past the ownership check when target.nodePath equals the app's own launchPath", async () => {
    const storage: Storage = new LockOnlyStorage(DEFAULT_TEST_CONFIG);
    // Seeded lock makes the outcome deterministic without spawning a real process: reaching the
    // "already running" message proves the ownership refusal did NOT fire, since that refusal
    // returns before `checkDaemonLock` is ever called (the test above proves that ordering via
    // `NeverReadStorage`).
    (storage as LockOnlyStorage).seedLock({
      pid: 9999,
      startedAt: new Date('2026-09-20T00:00:00.000Z'),
      procStart: undefined,
    });
    const processControl = new FixedAliveness(true);
    const ownExecutable = 'C:\\Program Files\\seeya\\seeya.exe';
    const owner: DaemonOwner = { kind: 'app', launchPath: ownExecutable };

    const message = await runDaemonLauncher(
      storage,
      processControl,
      {
        // Same spelling as owner.launchPath (case/separator differences are the pure comparison's
        // own job, covered by tests/unit/application/daemon-ownership.test.ts).
        nodePath: ownExecutable,
        scriptPath: '/nonexistent/should-not-be-spawned.js',
        args: ['daemon'],
      },
      owner,
      'win32',
    );

    expect(message).not.toContain('the app is installed');
    expect(message).toContain('already running');
    expect(message).toContain('9999');
  });
});

// V2-T13's own "cuidado central" (D-045 item 3): the WORKER path never even has a DaemonOwner
// parameter to check — proven by exercising it directly the way cli/index.ts's own "mode ===
// 'worker'" branch does (never through runDaemonLauncher, which is the only function that
// refuses).
describe("resolveDaemonInvocationMode — the app's own detached child always reaches the worker", () => {
  it('DAEMON_CHILD_ENV_VAR set → "worker", regardless of --stop/--status being unset', () => {
    expect(resolveDaemonInvocationMode({}, true)).toBe('worker');
  });

  it('--stop wins over the env var — an explicit human flag is never shadowed', () => {
    expect(resolveDaemonInvocationMode({ stop: true }, true)).toBe('stop');
  });

  it('--status wins over the env var, for the same reason', () => {
    expect(resolveDaemonInvocationMode({ status: true }, true)).toBe('status');
  });

  it('no flags, no env var → "launcher" (a human just typed "seeya daemon")', () => {
    expect(resolveDaemonInvocationMode({}, false)).toBe('launcher');
  });

  it("the app's own detached child (the worker) reaching runDaemonWorker never touches ownership: it succeeds even where runDaemonLauncher would have refused for the same machine", async () => {
    // Same LockOnlyStorage/FixedAliveness class this file already uses for runDaemonLauncher's own
    // refusal test above — the point here is that runDaemonWorker's signature has no DaemonOwner
    // parameter at all, so nothing here COULD refuse it (see this function's own docstring).
    const storage = new LockOnlyStorage(DEFAULT_TEST_CONFIG);
    const deps: DaemonDeps = {
      clock: { now: () => new Date('2026-09-05T10:00:00.000Z'), sleep: () => Promise.resolve() },
      storage,
      notifier: { notify: () => Promise.resolve() },
      processControl: new FixedAliveness(false),
      transcriptReader: new FakeTranscriptReader(),
      gitReader: new FakeGitReader(),
      forkCleanup: new FakeForkCleanup(),
      buildSessionProvider: () => ({ list: () => Promise.reject(new Error('not exercised')) }),
      buildGenerators: () => ({
        leanGenerator: failingGenerator('not exercised by this test'),
        deepGenerator: failingGenerator('not exercised by this test'),
      }),
      discoverEarlyWarnings: () =>
        Promise.reject(new Error('not exercised — the lock check must win first')),
    };

    // A SIGTERM right after starting stops the loop before any poll runs (same technique the
    // existing runDaemonWorker describe block below already uses) — this test only cares that the
    // worker actually STARTED (exit code 0, no refusal), not that it polled anything.
    const resultPromise = runDaemonWorker(deps, 555, undefined);
    process.emit('SIGTERM');
    const exitCode = await resultPromise;
    expect(exitCode).toBe(0);
  });
});

describe('runDaemonWorker', () => {
  function buildDeps(storage: Storage, processControl: ProcessControl): DaemonDeps {
    return {
      clock: { now: () => new Date('2026-09-05T10:00:00.000Z'), sleep: () => Promise.resolve() },
      storage,
      notifier: { notify: () => Promise.resolve() },
      processControl,
      transcriptReader: new FakeTranscriptReader(),
      gitReader: new FakeGitReader(),
      forkCleanup: new FakeForkCleanup(),
      buildSessionProvider: () => ({ list: () => Promise.reject(new Error('not exercised')) }),
      buildGenerators: () => ({
        leanGenerator: failingGenerator('not exercised by either test in this file'),
        deepGenerator: failingGenerator('not exercised by either test in this file'),
      }),
      discoverEarlyWarnings: () =>
        Promise.reject(new Error('not exercised — the lock check must win first')),
    };
  }

  it('returns exit code 1 when another instance already holds a live lock — never polls', async () => {
    const storage = new LockOnlyStorage(DEFAULT_TEST_CONFIG);
    storage.seedLock({
      pid: 4242,
      startedAt: new Date('2026-09-01T00:00:00.000Z'),
      procStart: undefined,
    });
    const deps = buildDeps(storage, new FixedAliveness(true));

    // `procStart: undefined` — this file never touches a real process, so there is nothing to
    // capture; `tests/integration/cli/daemon-command.test.ts` covers the real capture path.
    const exitCode = await runDaemonWorker(deps, 555, undefined);
    expect(exitCode).toBe(1);
  });

  it('a SIGTERM registered before the loop starts stops it before any poll runs (exit code 0)', async () => {
    const storage = new LockOnlyStorage(DEFAULT_TEST_CONFIG);
    const deps = buildDeps(storage, new FixedAliveness(false));

    // `runDaemonWorker` registers its SIGINT/SIGTERM listeners SYNCHRONOUSLY, before its first
    // `await` (`scheduler/lock.ts#acquireDaemonLock`'s own I/O) — emitting the signal in this same
    // synchronous tick, right after calling the function, is what makes this deterministic instead
    // of racing a real timer. `discoverEarlyWarnings` above rejects the whole poll if ever called,
    // so a passing test here also proves zero polls ran, not just an exit code.
    const resultPromise = runDaemonWorker(deps, 555, undefined);
    process.emit('SIGTERM');
    const exitCode = await resultPromise;

    expect(exitCode).toBe(0);
    expect(await storage.readDaemonLock()).toBeNull(); // lock cleared on the clean stop
  });
});

describe('runDaemonWorker — launchedBy is not silently dropped', () => {
  function buildDeps(storage: Storage, processControl: ProcessControl): DaemonDeps {
    return {
      clock: { now: () => new Date('2026-09-05T10:00:00.000Z'), sleep: () => Promise.resolve() },
      storage,
      notifier: { notify: () => Promise.resolve() },
      processControl,
      transcriptReader: new FakeTranscriptReader(),
      gitReader: new FakeGitReader(),
      forkCleanup: new FakeForkCleanup(),
      buildSessionProvider: () => ({ list: () => Promise.reject(new Error('not exercised')) }),
      buildGenerators: () => ({
        leanGenerator: failingGenerator('not exercised by this test'),
        deepGenerator: failingGenerator('not exercised by this test'),
      }),
      discoverEarlyWarnings: () =>
        Promise.reject(new Error('not exercised — the lock check must win first')),
    };
  }

  /** Never clears the lock (unlike `LockOnlyStorage`'s real `clearDaemonLock`), so the test can
   * still see the write after the worker's own clean-stop sequence has run. */
  class NonClearingLockStorage extends FakeStorage {
    private lock: DaemonLockInfo | null = null;

    override readDaemonLock(): Promise<DaemonLockInfo | null> {
      return Promise.resolve(this.lock);
    }

    override writeDaemonLock(lock: DaemonLockInfo): Promise<void> {
      this.lock = lock;
      return Promise.resolve();
    }

    override clearDaemonLock(): Promise<void> {
      return Promise.resolve();
    }
  }

  it('writes launchedBy on acquire, before the clean-stop clear', async () => {
    const storage = new NonClearingLockStorage(DEFAULT_TEST_CONFIG);
    const deps = buildDeps(storage, new FixedAliveness(false));

    const resultPromise = runDaemonWorker(
      deps,
      555,
      undefined,
      'C:\\Program Files\\seeya\\seeya.exe',
    );
    process.emit('SIGTERM');
    await resultPromise;

    expect(await storage.readDaemonLock()).toStrictEqual({
      pid: 555,
      startedAt: new Date('2026-09-05T10:00:00.000Z'),
      procStart: undefined,
      launchedBy: 'C:\\Program Files\\seeya\\seeya.exe',
    });
  });
});

/**
 * `isAlive` is scripted per test, including THROWING — the fourth S4-T5 state ("found a lock but
 * cannot verify"), which none of this file's other `ProcessControl` doubles produce.
 * `terminateGracefully` is scripted too, for `runDaemonStop`'s graceful-success path; the
 * escalation-to-`terminateAbruptly` path is deliberately NOT exercised here — that function is a
 * real, uninjected OS call (`adapters/process/termination.ts`), so it belongs in
 * `tests/integration/cli/daemon-command.test.ts`, against a real process, not faked here.
 */
class ScriptedProcessControl implements ProcessControl {
  constructor(
    private readonly aliveResult: () => boolean,
    private readonly gracefulResult: () => Promise<boolean> | boolean = () => {
      throw new Error('terminateGracefully not exercised by this test');
    },
  ) {}

  isAlive(): Promise<boolean> {
    return Promise.resolve(this.aliveResult());
  }

  async terminateGracefully(): Promise<boolean> {
    return this.gracefulResult();
  }

  terminateAbruptly(): Promise<void> {
    return Promise.reject(new Error('terminateAbruptly not exercised by this test'));
  }
}

const LOCK = { pid: 4242, startedAt: new Date('2026-09-05T10:00:00.000Z'), procStart: '123-456' };
const NOW = new Date('2026-09-05T10:00:00.000Z');

function buildControlDeps(
  storage: Storage,
  processControl: ProcessControl,
  now: Date = NOW,
): DaemonControlDeps {
  return { storage, processControl, clock: { now: () => now, sleep: () => Promise.resolve() } };
}

describe('runDaemonStatus — the four states (D-024)', () => {
  it('no lock at all: "not running", nothing claimed about health beyond "never ran"', async () => {
    const storage = new InMemoryDaemonStorage(createConfig());
    const deps = buildControlDeps(storage, new ScriptedProcessControl(() => true));

    const report = await runDaemonStatus(deps);

    expect(report).toContain('Daemon: not running.');
    expect(report).toContain('no failed cycles recorded (as of the last time it ran, if ever)');
  });

  it('a stale lock (pid confirmed dead) reads as "not running", and status never clears it', async () => {
    const storage = new InMemoryDaemonStorage(createConfig());
    await storage.writeDaemonLock(LOCK);
    const deps = buildControlDeps(storage, new ScriptedProcessControl(() => false));

    const report = await runDaemonStatus(deps);

    expect(report).toContain('Daemon: not running (a stale lock file for pid 4242 was found');
    // Read-only (docs/ESPECIFICACAO.md's own convention for `sessions`/`status`) — the cleanup on
    // a stale lock is `runDaemonStop`'s job, never `--status`'s.
    expect(await storage.readDaemonLock()).not.toBeNull();
  });

  it('a confirmed-alive daemon with zero failures reads as healthy', async () => {
    const storage = new InMemoryDaemonStorage(createConfig());
    await storage.writeDaemonLock(LOCK);
    const deps = buildControlDeps(storage, new ScriptedProcessControl(() => true));

    const report = await runDaemonStatus(deps);

    expect(report).toContain('Daemon: running (pid 4242, started 2026-09-05T10:00:00.000Z).');
    expect(report).toContain('Daemon health: healthy — no failed cycles recorded.');
  });

  it("a confirmed-alive daemon with a failure streak shows S4-T3b's own notice text, present tense", async () => {
    const storage = new InMemoryDaemonStorage(createConfig());
    await storage.writeDaemonLock(LOCK);
    const unhealthy: DayState = {
      ...emptyDayState('2026-09-05'),
      daemonHealth: {
        lastCycleError: { message: 'ECONNREFUSED', at: NOW },
        consecutiveCycleFailures: NOTIFY_AFTER_CONSECUTIVE_CYCLE_FAILURES,
      },
    };
    await storage.saveState(unhealthy);
    const deps = buildControlDeps(storage, new ScriptedProcessControl(() => true));

    const report = await runDaemonStatus(deps);

    expect(report).toContain('Daemon health: The daemon has failed every poll for about');
    expect(report).toContain('ECONNREFUSED');
    expect(report).not.toContain('before it stopped'); // present tense: it IS still running
  });

  it('a failure streak recorded before a NOW-dead daemon is worded in the past, not the present', async () => {
    const storage = new InMemoryDaemonStorage(createConfig());
    await storage.writeDaemonLock(LOCK);
    await storage.saveState({
      ...emptyDayState('2026-09-05'),
      daemonHealth: {
        lastCycleError: { message: 'disk full', at: NOW },
        consecutiveCycleFailures: NOTIFY_AFTER_CONSECUTIVE_CYCLE_FAILURES,
      },
    });
    const deps = buildControlDeps(storage, new ScriptedProcessControl(() => false));

    const report = await runDaemonStatus(deps);

    expect(report).toContain('Daemon health (as of its last recorded cycle, before it stopped):');
    expect(report).toContain('disk full');
  });

  it('a liveness check that THROWS is its own state — never "running", never "not running"', async () => {
    const storage = new InMemoryDaemonStorage(createConfig());
    await storage.writeDaemonLock(LOCK);
    // Nonzero failures so the health line's OWN wording is also exercised for `aliveness ===
    // 'unknown'` — with zero failures both "unknown" and "dead" say the same neutral "never
    // failed" sentence, which wouldn't prove this branch is distinct from the "dead" one.
    await storage.saveState({
      ...emptyDayState('2026-09-05'),
      daemonHealth: {
        lastCycleError: { message: 'timeout', at: NOW },
        consecutiveCycleFailures: 5,
      },
    });
    const deps = buildControlDeps(
      storage,
      new ScriptedProcessControl(() => {
        throw new Error('unrecognized errno');
      }),
    );

    const report = await runDaemonStatus(deps);

    expect(report).toContain('could not verify whether it is still alive (unrecognized errno)');
    expect(report).not.toContain('Daemon: running');
    expect(report).not.toContain('Daemon: not running');
    expect(report).toContain('current process status unknown');
  });

  it('shows the effective schedule: disabled, skipped, and an accumulated snooze', async () => {
    const disabledStorage = new InMemoryDaemonStorage(createConfig({ endOfDayTime: null }));
    const disabled = await runDaemonStatus(
      buildControlDeps(disabledStorage, new ScriptedProcessControl(() => false)),
    );
    expect(disabled).toContain('End-of-day: not configured (manual only).');

    const skippedStorage = new InMemoryDaemonStorage(createConfig());
    await skippedStorage.saveState({ ...emptyDayState('2026-09-05'), skipped: true });
    const skipped = await runDaemonStatus(
      buildControlDeps(skippedStorage, new ScriptedProcessControl(() => false)),
    );
    expect(skipped).toContain('End-of-day: skipped today (seeya skip-today)');

    const snoozedStorage = new InMemoryDaemonStorage(createConfig());
    await snoozedStorage.saveState({ ...emptyDayState('2026-09-05'), snoozeMinutesTotal: 45 });
    const snoozed = await runDaemonStatus(
      buildControlDeps(snoozedStorage, new ScriptedProcessControl(() => false)),
    );
    expect(snoozed).toContain('Snoozed today: 45 minute(s) total.');
  });
});

describe('runDaemonStop — states that never touch a real process', () => {
  it('no daemon running is the normal case (D-025), not an error', async () => {
    const storage = new InMemoryDaemonStorage(createConfig());
    const deps = buildControlDeps(storage, new ScriptedProcessControl(() => true));

    const report = await runDaemonStop(deps);

    expect(report).toBe('No daemon is running. Nothing to stop.');
  });

  it('a stale lock (pid confirmed dead) is cleared, and reported as nothing to stop', async () => {
    const storage = new InMemoryDaemonStorage(createConfig());
    await storage.writeDaemonLock(LOCK);
    const deps = buildControlDeps(storage, new ScriptedProcessControl(() => false));

    const report = await runDaemonStop(deps);

    expect(report).toContain('No daemon is running');
    expect(report).toContain('the stale lock was cleared');
    expect(await storage.readDaemonLock()).toBeNull(); // the acceptance: the next startup works
  });

  it('a liveness check that throws stops nothing and leaves the lock exactly as it was', async () => {
    const storage = new InMemoryDaemonStorage(createConfig());
    await storage.writeDaemonLock(LOCK);
    const deps = buildControlDeps(
      storage,
      new ScriptedProcessControl(() => {
        throw new Error('unrecognized errno');
      }),
    );

    const report = await runDaemonStop(deps);

    expect(report).toContain('Nothing was stopped');
    expect(await storage.readDaemonLock()).not.toBeNull();
  });

  it('a live daemon stopped gracefully (POSIX) has its lock cleared', async () => {
    const storage = new InMemoryDaemonStorage(createConfig());
    await storage.writeDaemonLock(LOCK);
    const deps = buildControlDeps(
      storage,
      new ScriptedProcessControl(
        () => true,
        () => true,
      ),
    );

    const report = await runDaemonStop(deps, 'linux');

    expect(report).toBe(
      'Stopped the daemon (pid 4242) gracefully. Nothing was lost: it saves its state after ' +
        'every poll cycle, so the next "seeya daemon" picks up exactly where this one left off.',
    );
    expect(await storage.readDaemonLock()).toBeNull();
  });

  // The forced-stop path itself (Windows/escalation, "forcibly" + the nothing-was-lost sentence,
  // no Windows-mechanism explanation on screen) moved to `tests/unit/scheduler/daemon-control.test.ts`
  // in V2-T5b, now that `terminateAbruptly` is a `ProcessControl` port method
  // (`ControllableProcessControl`'s own fake) rather than a raw, uninjected OS call — this file's
  // own scope stays "runDaemonStop as re-exported by cli/daemon-command.ts", the graceful/error/
  // stale-lock states above. `tests/integration/cli/daemon-command.test.ts`'s "real abrupt stop"
  // describe block still separately proves the REAL adapter against a real fixture process it
  // spawned itself.
});
