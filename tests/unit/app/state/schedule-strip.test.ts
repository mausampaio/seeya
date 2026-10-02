import { describe, expect, it } from 'vitest';
import {
  buildScheduleStripData,
  buildUndoSnoozeControl,
} from '../../../../packages/app/src/state/schedule-strip.js';
import type { ScheduleDecision, UndoSnoozeAvailability } from '@seeya-ai/engine/core/schedule.js';

const NOW = new Date(2026, 8, 17, 8, 47, 0); // 2026-09-17 08:47 local
const NO_SNOOZE: UndoSnoozeAvailability = { kind: 'noSnooze' };

describe('buildScheduleStripData', () => {
  it('disabled: fixed primary/secondary, no buttons', () => {
    const decision: ScheduleDecision = { kind: 'disabled' };
    expect(buildScheduleStripData(decision, NOW, NO_SNOOZE)).toEqual({
      primary: 'End of day',
      secondary: 'not configured',
      canSnooze: false,
      canSkip: false,
      undoSnooze: { kind: 'hidden' },
    });
  });

  it('skipped: fixed primary/secondary, no buttons', () => {
    const decision: ScheduleDecision = { kind: 'skipped' };
    expect(buildScheduleStripData(decision, NOW, NO_SNOOZE)).toEqual({
      primary: 'End of day',
      secondary: 'skipped today',
      canSnooze: false,
      canSkip: false,
      undoSnooze: { kind: 'hidden' },
    });
  });

  it('alreadyEnded: fixed primary/secondary, no buttons', () => {
    const decision: ScheduleDecision = {
      kind: 'alreadyEnded',
      effectiveEndOfDay: new Date(2026, 8, 17, 19, 30, 0),
    };
    expect(buildScheduleStripData(decision, NOW, NO_SNOOZE)).toEqual({
      primary: 'End of day',
      secondary: 'already ran today',
      canSnooze: false,
      canSkip: false,
      undoSnooze: { kind: 'hidden' },
    });
  });

  it('waiting: primary carries the local time, secondary the remaining hours/minutes, both buttons offered', () => {
    const decision: ScheduleDecision = {
      kind: 'waiting',
      effectiveEndOfDay: new Date(2026, 8, 17, 11, 0, 0), // 2h13min after NOW
    };
    const result = buildScheduleStripData(decision, NOW, NO_SNOOZE);
    expect(result.primary).toBe('End of day 11:00');
    expect(result.secondary).toBe('in 2 h 13 min');
    expect(result.canSnooze).toBe(true);
    expect(result.canSkip).toBe(true);
  });

  it('waiting: under an hour remaining omits the hours part', () => {
    const decision: ScheduleDecision = {
      kind: 'waiting',
      effectiveEndOfDay: new Date(2026, 8, 17, 8, 59, 0), // 12min after NOW
    };
    const result = buildScheduleStripData(decision, NOW, NO_SNOOZE);
    expect(result.primary).toBe('End of day 08:59');
    expect(result.secondary).toBe('in 12 min');
  });

  it('leadTimeWarning: fixed primary, just the remaining time as secondary, both buttons offered', () => {
    const decision: ScheduleDecision = {
      kind: 'leadTimeWarning',
      leadTimeMinutes: 15,
      effectiveEndOfDay: new Date(2026, 8, 17, 8, 59, 0), // 12min after NOW
    };
    const result = buildScheduleStripData(decision, NOW, NO_SNOOZE);
    expect(result.primary).toBe('End of day');
    expect(result.secondary).toBe('in 12 min');
    expect(result.canSnooze).toBe(true);
    expect(result.canSkip).toBe(true);
  });

  it('endOfDay: fixed "due now" secondary, both buttons still offered (a late snooze can still push it)', () => {
    const decision: ScheduleDecision = {
      kind: 'endOfDay',
      effectiveEndOfDay: new Date(2026, 8, 17, 8, 30, 0),
      delayMs: 17 * 60_000,
    };
    const result = buildScheduleStripData(decision, NOW, NO_SNOOZE);
    expect(result.primary).toBe('End of day');
    expect(result.secondary).toBe('due now');
    expect(result.canSnooze).toBe(true);
    expect(result.canSkip).toBe(true);
  });
});

describe('buildUndoSnoozeControl (V2-T50)', () => {
  const configured = new Date(2026, 8, 17, 9, 30, 0);

  it('noSnooze and notAdjustable are hidden', () => {
    expect(buildUndoSnoozeControl({ kind: 'noSnooze' })).toEqual({ kind: 'hidden' });
    expect(buildUndoSnoozeControl({ kind: 'notAdjustable' })).toEqual({ kind: 'hidden' });
  });

  it('available is available', () => {
    expect(buildUndoSnoozeControl({ kind: 'available', configuredEndOfDay: configured })).toEqual({
      kind: 'available',
    });
  });

  it('tooLate is disabled and names the configured time that already passed', () => {
    expect(buildUndoSnoozeControl({ kind: 'tooLate', configuredEndOfDay: configured })).toEqual({
      kind: 'disabled',
      reason: '09:30 has already passed',
    });
  });

  it('buildScheduleStripData carries the control next to the lines', () => {
    const decision: ScheduleDecision = {
      kind: 'waiting',
      effectiveEndOfDay: new Date(2026, 8, 17, 11, 0, 0),
    };
    expect(
      buildScheduleStripData(decision, NOW, { kind: 'available', configuredEndOfDay: configured })
        .undoSnooze,
    ).toEqual({ kind: 'available' });
  });
});
