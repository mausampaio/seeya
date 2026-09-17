/**
 * `seeya snooze [+15m|+30m|+1h]` and `seeya skip-today` (docs/ESPECIFICACAO.md § "seeya snooze...",
 * D-006). Both only mutate the persisted `DayState` — no daemon has to be running for either to
 * take effect (`core/ports.ts#Storage.saveState`'s own docstring): whatever poll runs next, from a
 * daemon already running or the next `seeya daemon` start, reads whatever this command just wrote
 * from `~/.seeya/estado.json` (`scheduler/poll.ts` re-reads `readState()` at the top of every
 * cycle, never keeping an in-memory copy across polls, precisely so this is true).
 *
 * **V2-T5b item 2: the orchestration (read/apply/save/re-decide) and the three named increments
 * moved to `@seeya-ai/engine/application/schedule-adjustments.js`** — the interface's own faixa de
 * horário needs the exact same sequence behind its own Snooze/Skip today buttons, and
 * `application/` is the one layer both composition roots (`cli/`, `app/`, D-043) can reach. This
 * module now only resolves `context`, calls that shared orchestration, and renders the result as
 * plain text (AGENTS.md § "Registro e saída") — `core/schedule.ts` still owns every actual
 * mutation rule (`applySnooze`/`applySkipToday`, `resetIfNewDay`'s midnight reset).
 */
import {
  parseSnoozeIncrement,
  skipToday,
  snoozeToday,
  SNOOZE_INCREMENTS,
} from '@seeya-ai/engine/application/schedule-adjustments.js';
import type { ScheduleDecision } from '@seeya-ai/engine/core/schedule.js';
import type { Clock, Storage } from '@seeya-ai/engine/core/ports.js';
import type { Config } from '@seeya-ai/engine/core/types.js';

export interface SnoozeCommandContext {
  readonly storage: Storage;
  readonly clock: Clock;
  readonly config: Config;
}

/** Re-exported so `tests/unit/cli/snooze-command.test.ts` keeps its existing import path — the
 * parser itself now lives in `application/schedule-adjustments.js` (see this file's own module
 * comment). */
export { parseSnoozeIncrement };

function formatLocalTime(instant: Date): string {
  const pad2 = (value: number): string => String(value).padStart(2, '0');
  return `${pad2(instant.getHours())}:${pad2(instant.getMinutes())}`;
}

/**
 * Renders what just happened using `decideSchedule`'s OWN read of the result — never a second,
 * hand-rolled interpretation of `skipped`/`endOfDayFired` here, so this message can never disagree
 * with what the next real poll will actually do with the same state.
 */
function renderSnoozeConfirmation(
  minutesAdded: number,
  totalMinutes: number,
  decision: ScheduleDecision,
): string {
  const header = `Snoozed by ${minutesAdded} minutes (${totalMinutes} minutes total today).`;
  switch (decision.kind) {
    case 'disabled':
      return (
        `${header} End-of-day is not configured (endOfDayTime is unset) — this has no effect ` +
        'until you set one ("seeya config set endOfDayTime <HH:MM>").'
      );
    case 'skipped':
      return (
        `${header} Today is already skipped ("seeya skip-today") — recorded, but it has no ` +
        'effect unless you run "seeya end-day" by hand today.'
      );
    case 'alreadyEnded':
      return `${header} Today's end-of-day closure already ran — there is nothing left to delay.`;
    case 'endOfDay':
      return (
        `${header} The new effective end-of-day (${formatLocalTime(decision.effectiveEndOfDay)}) ` +
        'has already passed — closure is due now.'
      );
    case 'leadTimeWarning':
    case 'waiting':
      return `${header} New effective end-of-day: ${formatLocalTime(decision.effectiveEndOfDay)}.`;
  }
}

export async function runSnoozeCommand(
  context: SnoozeCommandContext,
  rawIncrement: string,
): Promise<string> {
  const minutes = parseSnoozeIncrement(rawIncrement);
  if (minutes === null) {
    const expected = Object.keys(SNOOZE_INCREMENTS).join('|');
    return `seeya snooze: invalid increment "${rawIncrement}"; expected one of ${expected}.`;
  }
  const result = await snoozeToday(context.storage, context.clock, context.config, minutes);
  return renderSnoozeConfirmation(result.minutesAdded, result.totalMinutesToday, result.decision);
}

export async function runSkipTodayCommand(context: SnoozeCommandContext): Promise<string> {
  await skipToday(context.storage, context.clock, context.config);
  if (context.config.endOfDayTime === null) {
    return (
      'Today is marked as skipped. End-of-day is not configured (endOfDayTime is unset), so ' +
      'this has no additional effect right now.'
    );
  }
  return "Today's automatic end-of-day closure is skipped. It resumes tomorrow.";
}
