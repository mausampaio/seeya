/**
 * V2-T5b item 1: "a faixa de horário" — one line of text per `ScheduleDecision` variant
 * (`@seeya-ai/engine/core/schedule.js#decideSchedule`, the SAME pure function the daemon itself
 * polls every 30s), plus whether Snooze/Skip today make sense to show right now. Pure: no I/O, no
 * Electron, no DOM — `electron/main.ts` computes the `ScheduleDecision` (it already has
 * `Storage`/`Config`/`Clock`) and calls this on every refresh tick (the same 10s loop V2-T2
 * already pushes the sidebar/status panel on); `electron/renderer.ts` only renders whatever comes
 * back.
 *
 * **D-024, "nada achatado": six variants, six distinct strings, never one template with a
 * conditional clause bolted on.** `waiting`/`leadTimeWarning`/`endOfDay` are also the only three
 * that offer Snooze/Skip — `disabled`/`skipped`/`alreadyEnded` have nothing left to adjust today
 * (`docs/PLANO-DE-ENTREGA.md` V2-T5b item 1's own list).
 */
import { minutesRemaining, type ScheduleDecision } from '@seeya-ai/engine/core/schedule.js';
import { MESSAGES } from '../text/messages.js';

export interface ScheduleStripData {
  readonly text: string;
  readonly canSnooze: boolean;
  readonly canSkip: boolean;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** `"11:00"` — same two-digit local-time rendering `@seeya-ai/engine/scheduler/daemon-state.js`
 * and `packages/cli/src/snooze-command.ts` each already have their own copy of (a two-line
 * formatting helper, not logic worth extracting across a package boundary for). */
function formatLocalTime(instant: Date): string {
  return `${pad2(instant.getHours())}:${pad2(instant.getMinutes())}`;
}

/** `"2 h 13 min"` when an hour or more remains, `"12 min"` otherwise — `minutes` is already
 * non-negative here (`waiting`/`leadTimeWarning` only ever fire before the deadline; a decision
 * past it becomes `endOfDay` instead, `core/schedule.ts#decideAgainstDeadline`'s own branch
 * order), but clamped anyway rather than trusting that invariant blindly (D-025: never claim a
 * negative "time remaining"). */
function formatRemaining(totalMinutes: number): string {
  const minutes = Math.max(totalMinutes, 0);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours > 0 ? `${hours} h ${remainder} min` : `${remainder} min`;
}

const ADJUSTABLE: ScheduleStripData = { text: '', canSnooze: true, canSkip: true };
const FIXED: ScheduleStripData = { text: '', canSnooze: false, canSkip: false };

export function buildScheduleStripData(decision: ScheduleDecision, now: Date): ScheduleStripData {
  switch (decision.kind) {
    case 'disabled':
      return { ...FIXED, text: MESSAGES.scheduleStripDisabled };
    case 'skipped':
      return { ...FIXED, text: MESSAGES.scheduleStripSkipped };
    case 'alreadyEnded':
      return { ...FIXED, text: MESSAGES.scheduleStripAlreadyEnded };
    case 'waiting':
      return {
        ...ADJUSTABLE,
        text: MESSAGES.scheduleStripWaiting(
          formatLocalTime(decision.effectiveEndOfDay),
          formatRemaining(minutesRemaining(decision.effectiveEndOfDay, now)),
        ),
      };
    case 'leadTimeWarning':
      return {
        ...ADJUSTABLE,
        text: MESSAGES.scheduleStripLeadTimeWarning(
          formatRemaining(minutesRemaining(decision.effectiveEndOfDay, now)),
        ),
      };
    case 'endOfDay':
      return { ...ADJUSTABLE, text: MESSAGES.scheduleStripEndOfDay };
  }
}
