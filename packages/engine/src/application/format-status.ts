/**
 * Plain-text rendering for `seeya status` (D-028): the configured end-of-day time, the
 * discovered/eligible session counts, and — since S4-T13 — today's effective schedule and the
 * daemon's state, both pre-rendered by `scheduler/daemon-state.ts#describeDaemonState` and passed
 * in as `daemonAndScheduleReport`. That text is reused verbatim from the same function `seeya
 * daemon --status` calls (docs/PLANO-DE-ENTREGA.md S4-T13, cuidado (a)) rather than re-derived
 * here — this module's own job stays "assemble the pieces of `seeya status`'s report", not
 * "decide what the daemon is doing".
 *
 * **Moved here from `packages/cli/src/format-status.ts` in V2-T2.** Unlike `format-sessions.ts`
 * (stayed in `cli/` — the interface renders its own sidebar DOM, not CLI text), the interface's
 * status panel wants the literal SAME text `seeya status` prints (docs/PLANO-DE-ENTREGA.md V2-T2:
 * "o painel de estado bate com `seeya status`" — the aceite compares them, so reusing this
 * function verbatim is what makes that comparison meaningless to fail). `cli/status-command.ts`
 * now imports this from `@seeya-ai/engine/application/format-status.js`, same name, same output.
 */
import type { ScheduleDecision } from '../core/schedule.js';
import { localTimeString } from '../core/day.js';

/**
 * V2-T21 item 3, the fix for a measured defect: after a snooze/skip, the status showed the
 * CONFIGURED end-of-day time on its first line and today's EFFECTIVE time buried in the daemon
 * section below, with nothing saying the two numbers were different facts ("não atualizou" was
 * the natural — wrong — reading). A discriminated union (D-024), not a bare `string | null`,
 * because "why today differs" is itself a fact worth keeping distinct: `skipped` has no time to
 * show at all, `snoozed` does.
 */
export type TodayEndOfDayOverride =
  { readonly kind: 'skipped' } | { readonly kind: 'snoozed'; readonly effectiveEndOfDay: string };

/**
 * `null` whenever today's effective end-of-day is the same fact as the configured one — nothing
 * to disambiguate (D-025: no override note is itself informative, not an omission). `decision`
 * and `snoozeMinutesTotal` come from the exact same `decideSchedule`/`DayState` call
 * `scheduler/daemon-state.ts#describeDaemonState` already makes for the daemon section, so the two
 * can never disagree about whether today was snoozed or skipped.
 *
 * @example
 * resolveTodayEndOfDayOverride({ kind: 'waiting', effectiveEndOfDay: new Date(2026, 8, 5, 15, 30) }, 30)
 * // { kind: 'snoozed', effectiveEndOfDay: '15:30' }
 */
export function resolveTodayEndOfDayOverride(
  decision: ScheduleDecision,
  snoozeMinutesTotal: number,
): TodayEndOfDayOverride | null {
  if (decision.kind === 'skipped') {
    return { kind: 'skipped' };
  }
  if (decision.kind === 'disabled' || snoozeMinutesTotal <= 0) {
    return null;
  }
  return { kind: 'snoozed', effectiveEndOfDay: localTimeString(decision.effectiveEndOfDay) };
}

export interface StatusView {
  readonly endOfDayTime: string | null;
  readonly discoveredSessionCount: number;
  readonly eligibleSessionCount: number;
  /** Pre-rendered by `./daemon-state.ts#describeDaemonState` — liveness, effective schedule
   * (adiamento/skip-today/already-ran folded in) and health, in that order, newline-joined. */
  readonly daemonAndScheduleReport: string;
  /** V2-T21 item 3 — `null` when today's effective end-of-day matches the configured one; see
   * `resolveTodayEndOfDayOverride` above for how it's computed. */
  readonly todayEndOfDayOverride: TodayEndOfDayOverride | null;
  /** Pre-rendered by `./autostart-state.ts#describeAutostartState` — the same function `seeya
   * autostart status` calls (S5-T1's cuidado (c)), so the two can never disagree. */
  readonly autostartReport: string;
}

/** V2-T21 item 3: folds `todayEndOfDayOverride` into the SAME line as the configured time,
 * instead of leaving the two numbers to appear unrelated in different places. */
function formatEndOfDayLine(
  endOfDayTime: string | null,
  todayEndOfDayOverride: TodayEndOfDayOverride | null,
): string {
  if (endOfDayTime === null) {
    return 'End-of-day time: not configured (manual only)';
  }
  const configured = `End-of-day time: ${endOfDayTime} local`;
  if (todayEndOfDayOverride === null) {
    return configured;
  }
  return todayEndOfDayOverride.kind === 'skipped'
    ? `${configured} (skipped today)`
    : `${configured} (today: ${todayEndOfDayOverride.effectiveEndOfDay}, after snoozing)`;
}

export function formatStatusReport(view: StatusView): string {
  return [
    formatEndOfDayLine(view.endOfDayTime, view.todayEndOfDayOverride),
    `Eligible sessions: ${view.eligibleSessionCount} of ${view.discoveredSessionCount} discovered`,
    view.daemonAndScheduleReport,
    view.autostartReport,
  ].join('\n');
}
