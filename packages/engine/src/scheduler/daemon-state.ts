/**
 * Shared by `seeya daemon --status` (`cli/daemon-command.ts`) and `seeya status`
 * (`cli/status-command.ts`, S4-T13) — the one place that reads "is the daemon running, and what
 * does today's schedule look like" so the two commands can never disagree about either (S4-T13's
 * own acceptance: a test calls both over the same state and compares the daemon section
 * verbatim). Extracted out of `daemon-command.ts`, which owned all of this alone before S4-T13
 * and re-exports the names below for its own callers/tests — see that file's own module comment.
 *
 * Read-only throughout: nothing here ever writes `daemon.lock` or `estado.json`. `checkLiveLock`
 * only READS the lock and asks `ProcessControl.isAlive`; clearing a stale lock is `runDaemonStop`'s
 * job alone (docs/PLANO-DE-ENTREGA.md S4-T13, cuidado (b)).
 *
 * **Moved here from `packages/cli/src/daemon-state.ts` in V2-T2 (the interface needs the same
 * daemon+schedule text `seeya status` renders, and `application/` cannot import `cli/`).** Lands
 * in `scheduler/`, not `application/`, because of `buildDaemonUnhealthyNotice` below: it lives in
 * `scheduler/notices.ts`, and the layer matrix (docs/ARQUITETURA.md) forbids `application/` from
 * importing `scheduler/` — the two choices were "this module moves to `scheduler/`" or "the notice
 * function moves down to `core/`", and moving this module keeps `buildDaemonUnhealthyNotice`
 * exactly where every other daemon notice already lives, instead of splitting daemon-notice
 * building across two layers for one caller's sake. `scheduler/ → application/` stays allowed
 * either way (the matrix's own arrow), so nothing downstream of `scheduler/poll.ts` changes.
 * `cli/daemon-command.ts` and `cli/status-command.ts` now import this from
 * `@seeya-ai/engine/scheduler/daemon-state.js`, same names, same behavior — see Q-071.
 */
import type { Clock, ProcessControl, Storage } from '../core/ports.js';
import type { DaemonLockInfo } from '../core/daemon-lock.js';
import type { DaemonHealth, DayState } from '../core/types.js';
import { localDayString, localTimeString } from '../core/day.js';
import {
  decideSchedule,
  emptyDayState,
  resetIfNewDay,
  type ScheduleDecision,
} from '../core/schedule.js';
import { buildDaemonUnhealthyNotice } from './notices.js';
// `scheduler/ → application/` is allowed by the layer matrix (docs/ARQUITETURA.md) even though
// `application/ → scheduler/` is not — this module already depends on that arrow going the other
// way for `buildDaemonUnhealthyNotice`'s own docstring above. V2-T21 item 3 uses it again:
// `resolveTodayEndOfDayOverride` needs the exact same `decision`/`DayState` this function already
// computes, so the two can never disagree about whether today was snoozed or skipped.
import {
  resolveTodayEndOfDayOverride,
  type TodayEndOfDayOverride,
} from '../application/format-status.js';

export interface DaemonStateDeps {
  readonly storage: Storage;
  readonly processControl: ProcessControl;
  readonly clock: Clock;
}

/** Shared with `cli/daemon-command.ts#attemptAbruptStop` — the caller's own rendering of
 * whatever a failed liveness check or a failed forced-stop signal threw (AGENTS.md § "Mensagens
 * de erro": never just "it failed"). */
export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * The four states D-024 says must never flatten into "does a lock file exist":
 * - `noLock` — never started, or a clean shutdown already cleared it.
 * - `dead` — a lock exists, but `ProcessControl.isAlive` (S4-T3b's own recycled-pid tie-break,
 *   `lock.procStart` passed straight through) says its pid is gone. Also "not running", worded
 *   differently so a stale file left by a crash never reads as something currently wrong.
 * - `alive` — a lock exists and its pid is confirmed alive.
 * - `unknown` — the liveness check itself THREW (`adapters/process/liveness.ts#
 *   interpretExistenceCheckError` refuses to guess on an unrecognized OS error) — neither "running"
 *   nor "not running" is something this command actually knows (D-025), so neither is claimed.
 */
export type LiveLockCheck =
  | { readonly kind: 'noLock' }
  | { readonly kind: 'dead'; readonly lock: DaemonLockInfo }
  | { readonly kind: 'alive'; readonly lock: DaemonLockInfo }
  | { readonly kind: 'unknown'; readonly lock: DaemonLockInfo; readonly error: string };

/**
 * One liveness check per call — `status`/`--status` each call this exactly once per invocation
 * (docs/PLANO-DE-ENTREGA.md S4-T13, cuidado (g)): `ProcessControl.isAlive` shells out to
 * `powershell.exe` on Windows (500-880ms even warm, `adapters/process/proc-start.ts`'s own
 * measurement), so a caller that checked twice would pay that cost twice for the same fact.
 */
export async function checkLiveLock(deps: DaemonStateDeps): Promise<LiveLockCheck> {
  const lock = await deps.storage.readDaemonLock();
  if (lock === null) {
    return { kind: 'noLock' };
  }
  try {
    const alive = await deps.processControl.isAlive(lock.pid, lock.procStart);
    return alive ? { kind: 'alive', lock } : { kind: 'dead', lock };
  } catch (error) {
    return { kind: 'unknown', lock, error: describeError(error) };
  }
}

export function describeLiveness(check: LiveLockCheck): string {
  switch (check.kind) {
    case 'noLock':
      return 'Daemon: not running.';
    case 'dead':
      return (
        `Daemon: not running (a stale lock file for pid ${check.lock.pid} was found; the next ` +
        '"seeya daemon" reclaims it automatically).'
      );
    case 'unknown':
      return (
        `Daemon: found a lock file for pid ${check.lock.pid}, but could not verify whether it ` +
        `is still alive (${check.error}).`
      );
    case 'alive':
      return `Daemon: running (pid ${check.lock.pid}, started ${check.lock.startedAt.toISOString()}).`;
  }
}

/**
 * Mirrors `cli/snooze-command.ts#renderSnoozeConfirmation`'s own discipline: render
 * `decideSchedule`'s ACTUAL decision, never a hand-rolled re-check of `skipped`/`endOfDayFired`, so
 * this can never disagree with what the next real poll would do with the same state. Covers every
 * `ScheduleDecision` variant by name (D-024) — the brief's "horário efetivo de hoje", "se o dia foi
 * pulado" and "se o encerramento já disparou" fall directly out of which variant this is.
 */
export function describeScheduleDecision(decision: ScheduleDecision, state: DayState): string[] {
  const localTime = localTimeString;
  const lines: string[] = [];
  switch (decision.kind) {
    case 'disabled':
      return ['End-of-day: not configured (manual only).'];
    case 'skipped':
      return ['End-of-day: skipped today (seeya skip-today) — will resume tomorrow.'];
    case 'alreadyEnded':
      lines.push(
        `End-of-day: already ran today (effective ${localTime(decision.effectiveEndOfDay)}).`,
      );
      break;
    case 'waiting':
      lines.push(
        `End-of-day: scheduled for ${localTime(decision.effectiveEndOfDay)}, not reached yet.`,
      );
      break;
    case 'leadTimeWarning':
      lines.push(
        `End-of-day: closing in about ${decision.leadTimeMinutes} minute(s), at ` +
          `${localTime(decision.effectiveEndOfDay)}.`,
      );
      break;
    case 'endOfDay':
      lines.push(
        `End-of-day: due now (${localTime(decision.effectiveEndOfDay)}, about ` +
          `${Math.round(decision.delayMs / 60_000)} minute(s) past) — the next poll acts on this.`,
      );
      break;
  }
  if (state.snoozeMinutesTotal > 0) {
    lines.push(`Snoozed today: ${state.snoozeMinutesTotal} minute(s) total.`);
  }
  return lines;
}

/**
 * `health` is read straight from `estado.json` regardless of whether the daemon is CURRENTLY
 * alive — it can genuinely be stale (the daemon failed for hours, then was stopped or crashed) —
 * so the wording is tensed by `aliveness` instead of always claiming the present ("has failed
 * every poll... and hasn't completed a cycle SINCE" would be false once nothing is running at
 * all). Reuses `scheduler/notices.ts#buildDaemonUnhealthyNotice`'s own estimate/wording instead of
 * recomputing the minutes-from-cycle-count arithmetic a second time (AGENTS.md: "nada de
 * duplicação") — the number a person was already notified with and the number `--status`/`status`
 * show must never be able to disagree.
 */
export function describeHealth(health: DaemonHealth, aliveness: LiveLockCheck['kind']): string {
  if (health.consecutiveCycleFailures === 0) {
    return aliveness === 'alive'
      ? 'Daemon health: healthy — no failed cycles recorded.'
      : 'Daemon health: no failed cycles recorded (as of the last time it ran, if ever).';
  }
  const detail = buildDaemonUnhealthyNotice(health).body;
  if (aliveness === 'alive') {
    return `Daemon health: ${detail}`;
  }
  if (aliveness === 'unknown') {
    return `Daemon health (last recorded; current process status unknown): ${detail}`;
  }
  return `Daemon health (as of its last recorded cycle, before it stopped): ${detail}`;
}

/** `describeDaemonState`'s own return shape (V2-T21 item 3) — `report` is the literal multi-line
 * text `seeya daemon --status`/`seeya status` always rendered; `todayEndOfDayOverride` is the new
 * piece `seeya status`'s first line needs to fold the configured/effective times together, kept a
 * SEPARATE field rather than parsed back out of `report` (the report's own shape is prose, not
 * data this module wants a second caller re-parsing). */
export interface DaemonStateReport {
  readonly report: string;
  readonly todayEndOfDayOverride: TodayEndOfDayOverride | null;
}

/**
 * The full daemon+schedule block `seeya daemon --status` and `seeya status` both render
 * (docs/PLANO-DE-ENTREGA.md S4-T13) — read-only (never writes `daemon.lock` or `estado.json`, even
 * when it notices a stale lock: that cleanup is `runDaemonStop`'s job, only when the user asked to
 * stop something). Computing everything through this ONE function, over the SAME `Storage`, is
 * what makes the two commands structurally unable to disagree — not a convention two separate
 * implementations happen to follow, but one implementation two commands call.
 */
export async function describeDaemonState(deps: DaemonStateDeps): Promise<DaemonStateReport> {
  const check = await checkLiveLock(deps);
  const config = await deps.storage.readConfig();
  const now = deps.clock.now();
  const today = localDayString(now);
  const persisted = resetIfNewDay((await deps.storage.readState()) ?? emptyDayState(today), today);
  const { decision } = decideSchedule(config, persisted, now);

  const report = [
    describeLiveness(check),
    ...describeScheduleDecision(decision, persisted),
    describeHealth(persisted.daemonHealth, check.kind),
  ].join('\n');
  return {
    report,
    todayEndOfDayOverride: resolveTodayEndOfDayOverride(decision, persisted.snoozeMinutesTotal),
  };
}
