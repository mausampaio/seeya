/**
 * V2-T31: "Start daemon" answers only once the daemon really exists. `spawnDetachedDaemon`
 * resolves the instant the OS hands back a pid; the worker still has to boot Node, load the CLI
 * and write `daemon.lock` — so a response built right after the spawn recomputed "not running"
 * with reason (the measured defect: the button stayed on "Start daemon" until the next 10s
 * ambient tick). This module launches, then waits for the lock to show up ALIVE through the same
 * `checkLiveLock` every other liveness reading uses.
 *
 * Pure orchestration over injected functions/ports (same pattern as
 * `composition/daemon-ownership-transition.ts`): the real `spawnDetachedDaemon` and a real
 * detached process never enter a unit test; waiting goes through the `Clock` port (D-019), never a
 * bare timer.
 *
 * **Measured, not chosen (2026-10-02, Windows 11, plain Node 22 running the compiled CLI against
 * a disposable home, 32 launches, pid returned -> `daemon.lock` readable on disk, polled every
 * 5ms):** 757-1200ms in 31 of them (median ~790ms), one cold outlier at 2286ms (the very first
 * launch of the session). Real Electron-as-node was not measurable here (the binary was not
 * installed in the verification worktree), so the margin below also has to absorb its extra
 * startup. `DAEMON_START_DEADLINE_MS` = 10s is ~4x the worst observed boot: generous enough that
 * a slow disk or antivirus scan still reads as "started", short enough that the button's spinner
 * never hangs long when the daemon genuinely died on boot. `DAEMON_START_POLL_INTERVAL_MS` =
 * 100ms is ~8 reads across a typical boot — a visible response within a tenth of a second of the
 * lock appearing, without a `isAlive` call (a process-table query) every few milliseconds. The
 * deadline counts only the sleeps, so the real wall time can exceed it by the cost of the checks
 * themselves; that slack errs on the side of waiting a little longer, never of giving up early.
 *
 * **Where this stops.** An `alive` lock proves a daemon process owns it, not that its first poll
 * cycle succeeded — that is `daemonHealth`'s job, already shown elsewhere.
 */
import type { LockAcquisitionDecision } from '@seeya-ai/engine/core/daemon-lock.js';
import type { Clock, ProcessControl, Storage } from '@seeya-ai/engine/core/ports.js';
import { checkLiveLock } from '@seeya-ai/engine/scheduler/daemon-state.js';

export const DAEMON_START_DEADLINE_MS = 10_000;
export const DAEMON_START_POLL_INTERVAL_MS = 100;

/** D-024/D-025: three facts, never flattened into "started" — a refused start (something was
 * already alive), a start whose lock was SEEN, and a start that was launched but whose lock never
 * showed up within the deadline (not "failed": nothing observed says it failed). */
export type DaemonStartOutcome =
  | { readonly kind: 'alreadyRunning'; readonly heldByPid: number }
  | { readonly kind: 'confirmed'; readonly launchedPid: number; readonly lockPid: number }
  | {
      readonly kind: 'launchedUnconfirmed';
      readonly launchedPid: number;
      readonly waitedMs: number;
    };

export interface DaemonStartDeps {
  readonly storage: Storage;
  readonly processControl: ProcessControl;
  readonly clock: Clock;
  readonly checkLock: () => Promise<LockAcquisitionDecision>;
  readonly spawnDaemon: () => Promise<number>;
  readonly deadlineMs?: number;
  readonly pollIntervalMs?: number;
}

async function waitForAliveLock(
  deps: DaemonStartDeps,
  deadlineMs: number,
  pollIntervalMs: number,
): Promise<number | null> {
  for (let waited = 0; ; waited += pollIntervalMs) {
    const check = await checkLiveLock(deps);
    if (check.kind === 'alive') {
      return check.lock.pid;
    }
    if (waited >= deadlineMs) {
      return null;
    }
    await deps.clock.sleep(pollIntervalMs);
  }
}

/**
 * @example
 * const outcome = await startDaemonAndWait(deps);
 * // -> { kind: 'confirmed', launchedPid, lockPid } once daemon.lock is alive,
 * //    { kind: 'launchedUnconfirmed', ... } when 10s pass without seeing it.
 */
export async function startDaemonAndWait(deps: DaemonStartDeps): Promise<DaemonStartOutcome> {
  const decision = await deps.checkLock();
  if (decision.kind === 'refuse') {
    return { kind: 'alreadyRunning', heldByPid: decision.heldByPid };
  }
  const launchedPid = await deps.spawnDaemon();
  const deadlineMs = deps.deadlineMs ?? DAEMON_START_DEADLINE_MS;
  const pollIntervalMs = deps.pollIntervalMs ?? DAEMON_START_POLL_INTERVAL_MS;
  const lockPid = await waitForAliveLock(deps, deadlineMs, pollIntervalMs);
  return lockPid === null
    ? { kind: 'launchedUnconfirmed', launchedPid, waitedMs: deadlineMs }
    : { kind: 'confirmed', launchedPid, lockPid };
}

/** The literal text the footer shows (D-039: same wording the CLI's launcher uses for the first
 * two outcomes). */
export function formatDaemonStartOutcome(outcome: DaemonStartOutcome): string {
  switch (outcome.kind) {
    case 'alreadyRunning':
      return `seeya daemon is already running (pid ${outcome.heldByPid}). Nothing started.`;
    case 'confirmed':
      return (
        `seeya daemon started (pid ${outcome.lockPid}), detached from this window — closing ` +
        'seeya or logging out will not stop it.'
      );
    case 'launchedUnconfirmed':
      return (
        `Launched the daemon (pid ${outcome.launchedPid}), but it has not written its lock ` +
        `within ${outcome.waitedMs / 1000}s, so it is not confirmed as running. It may still be ` +
        'starting; the button will update when it appears.'
      );
  }
}
