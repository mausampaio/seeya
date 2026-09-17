/**
 * `runDaemonStop` — moved here from `packages/cli/src/daemon-command.ts` in V2-T5b item 3, same
 * "the interface needs the same X the CLI already has" reasoning `scheduler/daemon-state.ts`'s own
 * module comment already documents for V2-T2: the interface's own "Stop daemon" button
 * (docs/PLANO-DE-ENTREGA.md V2-T5b item 3) needs the exact same stop sequence `seeya daemon --stop`
 * already runs, and `application/` cannot see it (this function calls `ProcessControl` port
 * methods directly, no orchestration layer in between) — `scheduler/` is the one layer both
 * composition roots (`cli/`, `app/`, D-043) can import. `packages/cli/src/daemon-command.ts`
 * re-exports this, same name, same behavior — every existing caller/test keeps working unchanged.
 *
 * **`runDaemonLauncher` (the "start" half) did NOT move here.** It calls
 * `adapters/process/daemon-launch.ts#spawnDetachedDaemon` directly — a concrete adapter, not a
 * port method — and `scheduler/` cannot import `adapters/` (docs/ARQUITETURA.md's matrix; only
 * `cli/`/`app/` may). `packages/app/src/composition/index.ts` builds its OWN small start
 * orchestration instead, over the same `scheduler/lock.ts#checkDaemonLock` and
 * `adapters/process/daemon-launch.ts#spawnDetachedDaemon` `runDaemonLauncher` already uses — see
 * that file's own docstring for why this one function is legitimately duplicated between the two
 * composition roots rather than shared, unlike everything else in this module.
 */
import type { Clock, ProcessControl } from '../core/ports.js';
import { checkLiveLock, describeError, type DaemonStateDeps } from './daemon-state.js';

/**
 * Real `SIGTERM` might not be noticed until the daemon wakes from its own wait between polls —
 * `scheduler/loop.ts#sleepUntilNextPollOrStop` (S4-T5) rechecks every ~1s, not just once per
 * `POLL_INTERVAL_MS`, so this deadline only needs slack for that plus one in-flight poll's own I/O,
 * not the full 30s a single un-chunked sleep would have needed.
 */
const GRACEFUL_STOP_DEADLINE_MS = 15_000;

/** `SIGKILL`/`TerminateProcess` are both uncatchable and normally near-instant — this is just
 * enough slack for the OS to finish tearing the process down before re-checking reality. */
const ABRUPT_STOP_CONFIRM_MS = 2_000;

async function waitUntilDead(
  clock: Clock,
  processControl: ProcessControl,
  pid: number,
  boundMs: number,
): Promise<void> {
  const pollIntervalMs = 200;
  for (let waited = 0; waited < boundMs; waited += pollIntervalMs) {
    if (!(await processControl.isAlive(pid))) {
      return;
    }
    await clock.sleep(pollIntervalMs);
  }
}

/**
 * Sends `terminateAbruptly` (now a `ProcessControl` port method, V2-T5b — see that interface's own
 * docstring for why), waits briefly, and reports whether `pid` is confirmed dead afterward — never
 * throws itself (a permission error is reported in the caller's own message, not an uncaught
 * rejection, AGENTS.md § "Mensagens de erro").
 */
async function attemptAbruptStop(
  deps: DaemonStateDeps,
  pid: number,
): Promise<{ readonly dead: boolean; readonly sendError: string | null }> {
  try {
    await deps.processControl.terminateAbruptly(pid);
  } catch (error) {
    return { dead: false, sendError: describeError(error) };
  }
  await waitUntilDead(deps.clock, deps.processControl, pid, ABRUPT_STOP_CONFIRM_MS);
  const stillAlive = await deps.processControl.isAlive(pid);
  return { dead: !stillAlive, sendError: null };
}

/**
 * S4-T8 item 2. Answers the two things whoever asked to stop the daemon actually wants to know —
 * "did it really stop" and "did I lose anything" — instead of the mechanism of HOW it stopped.
 * Verified, not assumed: `scheduler/poll.ts#pollOnce` re-reads `Config`/`DayState` from `Storage`
 * at the top of every cycle and writes back whatever it decided BEFORE that cycle returns
 * (`scheduler/loop.ts#runDaemon` never holds a decision only in memory across two poll
 * iterations) — so a stop landing between polls loses nothing, by construction. A stop landing
 * INSIDE an in-flight poll (e.g. mid-capture) that gets killed before that poll's own `saveState`
 * runs doesn't corrupt anything either (the write simply never happened), but that specific
 * capture attempt isn't counted and is retried by the next daemon rather than skipped — the honest
 * reading of "nothing was lost": at worst something in progress restarts, nothing already decided
 * disappears.
 */
const DAEMON_STOP_NOTHING_LOST =
  'Nothing was lost: it saves its state after every poll cycle, so the next "seeya daemon" picks ' +
  'up exactly where this one left off.';

/**
 * The lock is cleared exactly when there is POSITIVE evidence `pid` is dead — never on a mere
 * "the kill was sent" assumption (D-025). If the forced stop couldn't even be sent, or the pid is
 * still observed alive afterward, the lock is left in place: a stray lock that blocks the next
 * `seeya daemon` is annoying but safe; silently clearing a lock whose pid might still be running
 * risks a live SECOND daemon starting alongside it, which the whole rest of D-005 exists to
 * prevent.
 */
async function finishAbruptStop(deps: DaemonStateDeps, pid: number): Promise<string> {
  const { dead, sendError } = await attemptAbruptStop(deps, pid);
  if (sendError !== null) {
    return `Could not send a forced stop to pid ${pid}: ${sendError}. Nothing was cleared — check manually.`;
  }
  if (!dead) {
    return (
      `Sent a forced stop to pid ${pid}, but it still appears to be alive ` +
      `${ABRUPT_STOP_CONFIRM_MS / 1000}s later. The lock was left in place — check manually ` +
      '(e.g. tasklist/ps) before retrying.'
    );
  }
  await deps.storage.clearDaemonLock().catch(() => undefined);
  return `Stopped the daemon (pid ${pid}) forcibly. ${DAEMON_STOP_NOTHING_LOST}`;
}

/**
 * `seeya daemon --stop` / the interface's own "Stop daemon" button. `platform` defaults to
 * `process.platform`, injectable for tests — same convention
 * `adapters/process/termination.ts#terminateGracefully` already uses (kept unchanged by this
 * move; reading it here is no different from the many other `Clock`/`ProcessControl` calls this
 * function already makes through its `deps` parameter — the DEFAULT here is what stays
 * uninjected, same as before the move).
 *
 * **Who clears the lock, and why it's always this function, never the daemon's own exit path
 * alone.** The daemon DOES still clear its own lock on a clean stop
 * (`scheduler/loop.ts#runDaemon`'s own best-effort `clearDaemonLock()`), and that stays valuable
 * defense-in-depth for a stop this function never triggered (someone else's bare `kill -TERM`, a
 * Ctrl+C reaching an attached shell). But this function never RELIES on that alone, because it
 * provably cannot on Windows (no graceful path exists there at all — see the comment on the
 * `platform === 'win32'` branch below) and is not guaranteed on POSIX either (a crash between the
 * signal and the daemon's own cleanup write). This function always confirms death itself before
 * declaring success, and always clears the lock itself once it has that confirmation.
 */
export async function runDaemonStop(
  deps: DaemonStateDeps,
  platform: string = process.platform,
): Promise<string> {
  const check = await checkLiveLock(deps);
  if (check.kind === 'noLock') {
    return 'No daemon is running. Nothing to stop.';
  }
  if (check.kind === 'unknown') {
    return (
      `Found a daemon lock for pid ${check.lock.pid}, but could not verify whether it is still ` +
      `alive (${check.error}). Nothing was stopped — check manually before retrying.`
    );
  }
  if (check.kind === 'dead') {
    await deps.storage.clearDaemonLock().catch(() => undefined);
    return (
      `No daemon is running (pid ${check.lock.pid} from the lock file is no longer alive; the ` +
      'stale lock was cleared).'
    );
  }

  // check.kind === 'alive' from here — an actual live daemon to stop.
  //
  // Windows has no graceful mechanism that reaches this process at all: it runs detached with no
  // console (D-005), so `CTRL_BREAK_EVENT` can never be delivered (`AttachConsole` fails with
  // error 6 — docs/spikes/G-ctrl-break-no-windows.md's own "what was not proven": a console-less
  // target), and a cross-process `SIGTERM` there calls `TerminateProcess` immediately without ever
  // running the target's own JS handler (measured building S4-T3b, `tests/integration/process/
  // daemon-launch.test.ts`'s own comment on that exact call). There is nothing graceful to try
  // first, so this does not pretend symmetry with the POSIX path below by attempting one anyway.
  if (platform === 'win32') {
    return finishAbruptStop(deps, check.lock.pid);
  }
  const stoppedGracefully = await deps.processControl.terminateGracefully(
    check.lock.pid,
    GRACEFUL_STOP_DEADLINE_MS,
  );
  if (stoppedGracefully) {
    await deps.storage.clearDaemonLock().catch(() => undefined);
    return `Stopped the daemon (pid ${check.lock.pid}) gracefully. ${DAEMON_STOP_NOTHING_LOST}`;
  }
  // Did not exit within GRACEFUL_STOP_DEADLINE_MS of the SIGTERM above — escalate to the same
  // forced path Windows always takes. Why a graceful signal alone isn't sufficient here belongs in
  // `attemptAbruptStop`'s own docstring, not on this screen either.
  return finishAbruptStop(deps, check.lock.pid);
}
