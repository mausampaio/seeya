/**
 * V2-T5b item 1: "a faixa de horário" — one line of text per `ScheduleDecision` variant
 * (`@seeya-ai/engine/core/schedule.js#decideSchedule`, the SAME pure function the daemon itself
 * polls every 30s), plus whether Snooze/Skip today make sense to show right now. Pure: no I/O, no
 * Electron, no DOM — `electron/main.ts` computes the `ScheduleDecision` (it already has
 * `Storage`/`Config`/`Clock`) and calls this on every refresh tick (the same 10s loop V2-T2
 * already pushes the sidebar/status panel on); `electron/renderer.ts` only renders whatever comes
 * back.
 *
 * **D-024, "nada achatado": six variants, six distinct string PAIRS, never one template with a
 * conditional clause bolted on.** `waiting`/`leadTimeWarning`/`endOfDay` are also the only three
 * that offer Snooze/Skip — `disabled`/`skipped`/`alreadyEnded` have nothing left to adjust today
 * (`docs/PLANO-DE-ENTREGA.md` V2-T5b item 1's own list).
 *
 * PO review (2026-10-01, `docs/INTERFACE.md` § 1 item 7): the single flat `text` string this used
 * to carry read as loose text with no hierarchy between the fact ("End of day") and the detail
 * ("in 3 h 52 min"). `primary`/`secondary` are the icon row's own two halves — `SidebarFooter`
 * renders them through `Text` with the weight/tone the identity asks for; this module only decides
 * the WORDS, never how they're styled.
 */
import {
  minutesRemaining,
  type ScheduleDecision,
  type UndoSnoozeAvailability,
} from '@seeya-ai/engine/core/schedule.js';
import { MESSAGES } from '../text/messages.js';

/**
 * V2-T50: "Undo snooze" inside the Snooze menu (D-006 amendment of 2026-09-24). Three states, never
 * a boolean (D-024): `hidden` — nothing snoozed (or the day no longer moves), so the item does not
 * exist; `available` — there is a snooze and the configured time is still ahead; `disabled` — there
 * IS a snooze but the configured time already passed, so it says why instead of vanishing.
 */
export type UndoSnoozeControl =
  | { readonly kind: 'hidden' }
  | { readonly kind: 'available' }
  | { readonly kind: 'disabled'; readonly reason: string };

export interface ScheduleStripData {
  readonly primary: string;
  readonly secondary: string;
  readonly canSnooze: boolean;
  readonly canSkip: boolean;
  readonly undoSnooze: UndoSnoozeControl;
}

export function buildUndoSnoozeControl(availability: UndoSnoozeAvailability): UndoSnoozeControl {
  switch (availability.kind) {
    case 'noSnooze':
    case 'notAdjustable':
      return { kind: 'hidden' };
    case 'available':
      return { kind: 'available' };
    case 'tooLate':
      return {
        kind: 'disabled',
        reason: MESSAGES.scheduleStripUndoSnoozeTooLate(
          formatLocalTime(availability.configuredEndOfDay),
        ),
      };
  }
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

const ADJUSTABLE = { canSnooze: true, canSkip: true } as const;
const FIXED = { canSnooze: false, canSkip: false } as const;

export function buildScheduleStripData(
  decision: ScheduleDecision,
  now: Date,
  undoAvailability: UndoSnoozeAvailability,
): ScheduleStripData {
  return {
    ...buildScheduleStripLines(decision, now),
    undoSnooze: buildUndoSnoozeControl(undoAvailability),
  };
}

function buildScheduleStripLines(
  decision: ScheduleDecision,
  now: Date,
): Omit<ScheduleStripData, 'undoSnooze'> {
  switch (decision.kind) {
    case 'disabled':
      return {
        ...FIXED,
        primary: MESSAGES.scheduleStripPrimary,
        secondary: MESSAGES.scheduleStripNotConfigured,
      };
    case 'skipped':
      return {
        ...FIXED,
        primary: MESSAGES.scheduleStripPrimary,
        secondary: MESSAGES.scheduleStripSkippedToday,
      };
    case 'alreadyEnded':
      return {
        ...FIXED,
        primary: MESSAGES.scheduleStripPrimary,
        secondary: MESSAGES.scheduleStripAlreadyRanToday,
      };
    case 'waiting':
      return {
        ...ADJUSTABLE,
        primary: MESSAGES.scheduleStripWaitingPrimary(formatLocalTime(decision.effectiveEndOfDay)),
        secondary: MESSAGES.scheduleStripRemaining(
          formatRemaining(minutesRemaining(decision.effectiveEndOfDay, now)),
        ),
      };
    case 'leadTimeWarning':
      return {
        ...ADJUSTABLE,
        primary: MESSAGES.scheduleStripPrimary,
        secondary: MESSAGES.scheduleStripRemaining(
          formatRemaining(minutesRemaining(decision.effectiveEndOfDay, now)),
        ),
      };
    case 'endOfDay':
      return {
        ...ADJUSTABLE,
        primary: MESSAGES.scheduleStripPrimary,
        secondary: MESSAGES.scheduleStripDueNow,
      };
  }
}
