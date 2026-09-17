/**
 * The "adiar"/"pular hoje" orchestration (D-006): reads `DayState` from `Storage`, applies
 * `core/schedule.ts#applySnooze`/`applySkipToday`, persists it, and hands back the resulting
 * `ScheduleDecision` so a caller (CLI text, or the interface's own faixa de horário, V2-T5b) can
 * render what just happened without a second, hand-rolled read of `skipped`/`endOfDayFired`.
 *
 * **Moved here from `packages/cli/src/snooze-command.ts` in V2-T5b item 2.** Until this task,
 * `seeya snooze`/`seeya skip-today` were the only callers, so the read-Storage/apply/save/
 * re-decide sequence and the three named increments (`SNOOZE_INCREMENTS`) lived directly in the
 * CLI. The interface's own faixa now needs the SAME sequence behind its own Snooze/Skip today
 * buttons (`packages/app/src/state/schedule-strip.ts`) — `application/` is the one layer both
 * composition roots (`cli/`, `app/`, D-043) can import, so this is where the orchestration itself
 * belongs; `core/schedule.ts`'s own pure rules (`applySnooze`/`applySkipToday`/`decideSchedule`)
 * are untouched by this move. `packages/cli/src/snooze-command.ts` now only renders text from
 * whatever this module returns — see that file's own docstring.
 */
import { localDayString } from '../core/day.js';
import {
  applySkipToday,
  applySnooze,
  decideSchedule,
  emptyDayState,
  type ScheduleDecision,
} from '../core/schedule.js';
import type { Clock, Storage } from '../core/ports.js';
import type { Config } from '../core/types.js';

/**
 * D-006's three named increments — the only ones any caller (CLI flag, interface button) is
 * allowed to offer. `core/schedule.ts#applySnooze`'s own docstring is explicit that the pure rule
 * itself accepts any positive number of minutes on purpose, leaving "which increments a UI
 * exposes" to this layer. Keys match `@seeya-ai/engine/scheduler/notices.ts#buildLeadTimeNotice`'s
 * own wording ("Run \"seeya snooze +15m\" (or +30m/+1h)...") exactly, so the notice a person reads
 * and the increment they pick never drift apart.
 */
export const SNOOZE_INCREMENTS: Readonly<Record<string, number>> = {
  '+15m': 15,
  '+30m': 30,
  '+1h': 60,
};

/** `null` on anything not in `SNOOZE_INCREMENTS` — exported so a caller's own parser test can
 * cover this boundary directly, not only through `snoozeToday`'s full flow. */
export function parseSnoozeIncrement(raw: string): number | null {
  return SNOOZE_INCREMENTS[raw] ?? null;
}

export interface SnoozeTodayResult {
  readonly minutesAdded: number;
  /** `DayState.snoozeMinutesTotal` AFTER this increment — accumulates across calls the same day
   * (D-006: "não há limite de adiamentos"), reset only by `core/schedule.ts#resetIfNewDay`. */
  readonly totalMinutesToday: number;
  /** `decideSchedule`'s own read of the state THIS call just persisted — never re-derived by a
   * caller, so a rendered confirmation can never disagree with what the next real poll does with
   * the same state. */
  readonly decision: ScheduleDecision;
}

/**
 * Applies one "adiar" increment and persists it — `minutes` is trusted to already be one of
 * `SNOOZE_INCREMENTS`' values (both current callers resolve it through `parseSnoozeIncrement`
 * first and refuse anything else before ever reaching this function).
 *
 * @example
 * const parsed = parseSnoozeIncrement('+30m'); // 30
 * if (parsed !== null) {
 *   const result = await snoozeToday(storage, clock, config, parsed);
 * }
 */
export async function snoozeToday(
  storage: Storage,
  clock: Clock,
  config: Config,
  minutes: number,
): Promise<SnoozeTodayResult> {
  const now = clock.now();
  const today = localDayString(now);
  const stored = (await storage.readState()) ?? emptyDayState(today);
  const next = applySnooze(stored, today, minutes);
  await storage.saveState(next);
  const { decision } = decideSchedule(config, next, now);
  return { minutesAdded: minutes, totalMinutesToday: next.snoozeMinutesTotal, decision };
}

export interface SkipTodayResult {
  readonly decision: ScheduleDecision;
}

/** Applies "pular hoje" and persists it — idempotent, independent of any snooze already applied
 * today (`core/schedule.ts#applySkipToday`'s own docstring). */
export async function skipToday(
  storage: Storage,
  clock: Clock,
  config: Config,
): Promise<SkipTodayResult> {
  const now = clock.now();
  const today = localDayString(now);
  const stored = (await storage.readState()) ?? emptyDayState(today);
  const next = applySkipToday(stored, today);
  await storage.saveState(next);
  const { decision } = decideSchedule(config, next, now);
  return { decision };
}
