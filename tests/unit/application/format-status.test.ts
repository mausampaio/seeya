import { describe, expect, it } from 'vitest';
import {
  formatStatusReport,
  resolveTodayEndOfDayOverride,
  type StatusView,
} from '../../../packages/engine/src/application/format-status.js';
import type { ScheduleDecision } from '../../../packages/engine/src/core/schedule.js';

function view(overrides: Partial<StatusView> = {}): StatusView {
  return {
    endOfDayTime: null,
    discoveredSessionCount: 0,
    eligibleSessionCount: 0,
    daemonAndScheduleReport: 'Daemon: not running.\nEnd-of-day: not configured (manual only).',
    todayEndOfDayOverride: null,
    autostartReport: 'Autostart: disabled.',
    ...overrides,
  };
}

describe('formatStatusReport', () => {
  it('shows "not configured (manual only)" when endOfDayTime is null (Q-013 default)', () => {
    const report = formatStatusReport(view({ endOfDayTime: null }));

    expect(report).toContain('End-of-day time: not configured (manual only)');
  });

  it('shows the configured local time as-is, never converted to an instant (docs/ARQUITETURA.md § "Fusos e horários")', () => {
    const report = formatStatusReport(view({ endOfDayTime: '19:30' }));

    expect(report).toContain('End-of-day time: 19:30 local');
  });

  it('shows the eligible/discovered session counts', () => {
    const report = formatStatusReport(view({ eligibleSessionCount: 2, discoveredSessionCount: 5 }));

    expect(report).toContain('Eligible sessions: 2 of 5 discovered');
  });

  /**
   * S4-T13: `format-status.ts` no longer decides anything about the daemon — it embeds whatever
   * `cli/daemon-state.ts#describeDaemonState` already rendered, verbatim, never re-deriving or
   * summarizing it. The multi-line shape (liveness + schedule + health, S4-T13's own combined
   * block) is passed through unchanged.
   */
  it('embeds the pre-rendered daemon/schedule report verbatim, without altering it', () => {
    const daemonAndScheduleReport = [
      'Daemon: running (pid 4242, started 2026-09-05T10:00:00.000Z).',
      'End-of-day: closing in about 15 minute(s), at 19:30.',
      'Snoozed today: 30 minute(s) total.',
      'Daemon health: healthy — no failed cycles recorded.',
    ].join('\n');

    const report = formatStatusReport(view({ daemonAndScheduleReport }));

    expect(report).toContain(daemonAndScheduleReport);
  });

  it('never falls back to the retired "not implemented yet" placeholder (D-025, S4-T13)', () => {
    const report = formatStatusReport(view());

    expect(report).not.toContain('not implemented yet');
  });

  /**
   * V2-T21 item 3 — the measured defect: after a snooze, the first line stayed
   * "End-of-day time: 15:00 local" while the effective time (15:30) appeared only in the daemon
   * section below, with nothing saying the two numbers were the same fact. The fix folds both
   * into this one line, and only when there's actually something to disambiguate.
   */
  describe('todayEndOfDayOverride (V2-T21 item 3)', () => {
    it('null: the configured time is shown alone — nothing to disambiguate', () => {
      const report = formatStatusReport(
        view({ endOfDayTime: '19:30', todayEndOfDayOverride: null }),
      );

      expect(report).toContain('End-of-day time: 19:30 local\n');
    });

    it('snoozed: the configured AND effective times appear on the same line, labeled', () => {
      const report = formatStatusReport(
        view({
          endOfDayTime: '15:00',
          todayEndOfDayOverride: { kind: 'snoozed', effectiveEndOfDay: '15:30' },
        }),
      );

      expect(report).toContain('End-of-day time: 15:00 local (today: 15:30, after snoozing)');
    });

    it('skipped: says so, without inventing a time for today', () => {
      const report = formatStatusReport(
        view({ endOfDayTime: '19:30', todayEndOfDayOverride: { kind: 'skipped' } }),
      );

      expect(report).toContain('End-of-day time: 19:30 local (skipped today)');
    });

    it('endOfDayTime null wins regardless of todayEndOfDayOverride — manual-only stays manual-only', () => {
      const report = formatStatusReport(
        view({
          endOfDayTime: null,
          todayEndOfDayOverride: { kind: 'snoozed', effectiveEndOfDay: '15:30' },
        }),
      );

      expect(report).toContain('End-of-day time: not configured (manual only)');
      expect(report).not.toContain('15:30');
    });
  });
});

describe('resolveTodayEndOfDayOverride', () => {
  it('disabled: null — nothing configured, nothing to override', () => {
    const decision: ScheduleDecision = { kind: 'disabled' };

    expect(resolveTodayEndOfDayOverride(decision, 45)).toBeNull();
  });

  it('skipped: always "skipped", even with zero accumulated snooze', () => {
    const decision: ScheduleDecision = { kind: 'skipped' };

    expect(resolveTodayEndOfDayOverride(decision, 0)).toEqual({ kind: 'skipped' });
  });

  it('waiting with no snooze today: null — the effective time matches the configured one', () => {
    const decision: ScheduleDecision = {
      kind: 'waiting',
      effectiveEndOfDay: new Date(2026, 8, 5, 19, 30),
    };

    expect(resolveTodayEndOfDayOverride(decision, 0)).toBeNull();
  });

  it('waiting with an accumulated snooze: "snoozed", with the effective local time', () => {
    const decision: ScheduleDecision = {
      kind: 'waiting',
      effectiveEndOfDay: new Date(2026, 8, 5, 15, 30),
    };

    expect(resolveTodayEndOfDayOverride(decision, 30)).toEqual({
      kind: 'snoozed',
      effectiveEndOfDay: '15:30',
    });
  });

  it('alreadyEnded with a snooze still reports the shifted time — the day already closed later than configured', () => {
    const decision: ScheduleDecision = {
      kind: 'alreadyEnded',
      effectiveEndOfDay: new Date(2026, 8, 5, 20, 0),
    };

    expect(resolveTodayEndOfDayOverride(decision, 30)).toEqual({
      kind: 'snoozed',
      effectiveEndOfDay: '20:00',
    });
  });
});
