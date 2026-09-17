/**
 * `seeya daemon` (docs/ESPECIFICACAO.md § `seeya daemon`, D-005). Two modes, chosen by
 * `adapters/process/daemon-launch.ts#DAEMON_CHILD_ENV_VAR` — set only on the detached child's own
 * environment, never something a human types:
 *
 * - **Launcher** (`runDaemonLauncher`, the human's own invocation): checks the lock, and either
 *   refuses with a clear message or spawns the detached worker and returns immediately — this
 *   process's own console is the only place any of this is ever printed (D-005's "custo assumido":
 *   the worker itself has none).
 * - **Worker** (`runDaemonWorker`, the detached child): the actual long-running loop
 *   (`scheduler/loop.ts#runDaemon`), until a POSIX signal asks it to stop or `decideLockAcquisition`
 *   refuses outright (another instance won the race).
 *
 * `runDaemonStop` itself now lives in `@seeya-ai/engine/scheduler/daemon-control.js` (V2-T5b item
 * 3) — re-exported below so every existing caller/test of this module keeps working unchanged.
 */
import {
  spawnDetachedDaemon,
  type DaemonLaunchTarget,
} from '@seeya-ai/engine/adapters/process/daemon-launch.js';
import { checkDaemonLock } from '@seeya-ai/engine/scheduler/index.js';
import { runDaemon } from '@seeya-ai/engine/scheduler/index.js';
import type { DaemonDeps } from '@seeya-ai/engine/scheduler/index.js';
import type { ProcessControl, Storage } from '@seeya-ai/engine/core/ports.js';
import {
  describeDaemonState,
  type DaemonStateDeps,
} from '@seeya-ai/engine/scheduler/daemon-state.js';

/**
 * Pre-flight only — `scheduler/lock.ts#checkDaemonLock` never writes. Refusing here BEFORE
 * spawning saves the cost of a child that would immediately find itself refused anyway (the
 * worker's own `runDaemon` call is the authoritative check; see that file's module comment for
 * why both exist).
 */
export async function runDaemonLauncher(
  storage: Storage,
  processControl: ProcessControl,
  target: DaemonLaunchTarget,
): Promise<string> {
  const decision = await checkDaemonLock(storage, processControl);
  if (decision.kind === 'refuse') {
    return `seeya daemon is already running (pid ${decision.heldByPid}). Nothing started.`;
  }
  const pid = await spawnDetachedDaemon(target);
  return (
    `seeya daemon started (pid ${pid}), detached from this terminal — closing this window or ` +
    'logging out will not stop it.'
  );
}

/**
 * The worker's own entry point — never resolves under normal operation except when
 * `decideLockAcquisition` refuses (another instance already won) or a POSIX SIGINT/SIGTERM asks it
 * to stop. Returns an exit code rather than calling `process.exit` itself, so `cli/index.ts` stays
 * the one place that decides `process.exitCode` (same convention `start-day-command`'s own caller
 * already follows).
 *
 * **Signal handling lives here, not in `scheduler/loop.ts`.** `scheduler/` cannot touch
 * `node:process` directly (D-020: `cli/` is the only composition root allowed to name a concrete
 * environment API) — this function registers the handlers and hands `runDaemon` a plain
 * `shouldStop` closure instead.
 *
 * **`procStart` is a plain value, not captured here (S4-T3b).** `cli/index.ts` — the actual entry
 * point, one level up — captures it once via `adapters/process/proc-start.ts` and passes it down,
 * the same discipline `pid` itself already gets from `runDaemon`'s own docstring: this function has
 * no real-I/O concern of its own to keep pure for its unit tests (`tests/unit/cli/daemon-command.test.ts`
 * passes `undefined` and never touches a real process for it).
 */
export async function runDaemonWorker(
  deps: DaemonDeps,
  pid: number,
  procStart: string | undefined,
): Promise<number> {
  let stopRequested = false;
  const requestStop = (): void => {
    stopRequested = true;
  };
  process.once('SIGINT', requestStop);
  process.once('SIGTERM', requestStop);
  try {
    const outcome = await runDaemon(deps, pid, procStart, { shouldStop: () => stopRequested });
    return outcome.kind === 'alreadyRunning' ? 1 : 0;
  } finally {
    process.off('SIGINT', requestStop);
    process.off('SIGTERM', requestStop);
  }
}

// ---------------------------------------------------------------------------------------------
// S4-T5: `seeya daemon --stop`/`--status` — the natural consumer of S4-T3b's lock `procStart`
// tie-break and `DayState.daemonHealth`. Both commands share one read of "is the recorded lock's
// pid actually alive" (`checkLiveLock`, `@seeya-ai/engine/scheduler/daemon-state.js` since V2-T2),
// so `--status` and `--stop` can never
// disagree about which of the four states (D-024) they're looking at.
//
// **S4-T13 moved `checkLiveLock`/`describeLiveness`/`describeScheduleDecision`/`describeHealth`/
// `describeDaemonState` out to `./daemon-state.ts`.** `seeya status` needs the exact same daemon
// report `--status` renders (docs/PLANO-DE-ENTREGA.md S4-T13, cuidado (a): "extraia o que for
// compartilhado em vez de copiar texto") — this file re-exports `DaemonControlDeps` as the same
// type `daemon-state.ts` calls `DaemonStateDeps`, so every existing caller/test of this module
// keeps working unchanged.
//
// **V2-T5b item 3 moved `runDaemonStop` itself out to `./daemon-control.ts`** — the interface's
// own "Stop daemon" button needs the exact same stop sequence, and only calls `ProcessControl`
// port methods (no concrete adapter), so it could move all the way to `scheduler/`. Re-exported
// below, same name, same behavior — see that module's own docstring.
// ---------------------------------------------------------------------------------------------

export type DaemonControlDeps = DaemonStateDeps;

export { runDaemonStop } from '@seeya-ai/engine/scheduler/daemon-control.js';

/**
 * `seeya daemon --status` — read-only (never writes `daemon.lock` or `estado.json`, even when it
 * notices a stale lock: that cleanup is `runDaemonStop`'s job, only when the user asked to stop
 * something). The consumer S4-T3b built `DayState.daemonHealth` and the lock's `procStart`
 * tie-break FOR (docs/PLANO-DE-ENTREGA.md S4-T3b's own words: "this is where it pays off").
 *
 * **S4-T13: a thin wrapper around `./daemon-state.ts#describeDaemonState`.** `seeya status` calls
 * that same function directly — this is what makes the two commands' daemon section structurally
 * unable to disagree (`tests/unit/cli/daemon-status-agreement.test.ts`).
 */
export async function runDaemonStatus(deps: DaemonControlDeps): Promise<string> {
  return describeDaemonState(deps);
}
