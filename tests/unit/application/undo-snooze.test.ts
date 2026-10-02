/**
 * V2-T50 (D-006 amendment of 2026-09-24): "desfazer o adiamento" (`undoSnoozeToday`,
 * `core/schedule.ts#decideUndoSnooze`) and the shared config write path that zeroes today's snooze
 * when `endOfDayTime` changes (`application/config-update.ts#saveConfigChange`) — plus the proof
 * that S4-T7 Part 3's rearm already makes the advance notices follow the new effective deadline
 * after either, so no extra code was needed there.
 */
import { describe, expect, it } from 'vitest';
import {
  readUndoSnoozeAvailability,
  snoozeToday,
  undoSnoozeToday,
} from '@seeya-ai/engine/application/schedule-adjustments.js';
import { saveConfigChange } from '@seeya-ai/engine/application/config-update.js';
import { decideSchedule, emptyDayState } from '@seeya-ai/engine/core/schedule.js';
import { FakeStorage, FakeClock, DEFAULT_TEST_CONFIG } from './_fakes.js';
import type { Config, DayState } from '@seeya-ai/engine/core/types.js';

class InMemoryScheduleStorage extends FakeStorage {
  private state: DayState | null = null;
  private current: Config;
  constructor(initial: Config) {
    super(initial);
    this.current = initial;
  }
  override readConfig(): Promise<Config> {
    return Promise.resolve(this.current);
  }
  override saveConfig(config: Config): Promise<void> {
    this.current = config;
    return Promise.resolve();
  }
  override readState(): Promise<DayState | null> {
    return Promise.resolve(this.state);
  }
  override saveState(state: DayState): Promise<void> {
    this.state = state;
    return Promise.resolve();
  }
}

function config(overrides: Partial<Config> = {}): Config {
  return {
    ...DEFAULT_TEST_CONFIG,
    endOfDayTime: '19:30',
    leadTimesInMinutes: [30, 15],
    ...overrides,
  };
}

const TODAY = '2026-08-16';
const NOON = new Date(2026, 7, 16, 12, 0, 0);
const EVENING_BEFORE = new Date(2026, 7, 16, 19, 29, 0);
const EVENING_AT = new Date(2026, 7, 16, 19, 30, 0);

function snoozed(minutes: number, overrides: Partial<DayState> = {}): DayState {
  return { ...emptyDayState(TODAY), snoozeMinutesTotal: minutes, ...overrides };
}

describe('undoSnoozeToday', () => {
  it('before the configured time: zeroes the snooze and returns the decision at the configured time', async () => {
    const storage = new InMemoryScheduleStorage(config());
    await storage.saveState(snoozed(60));

    const result = await undoSnoozeToday(storage, new FakeClock(NOON), config());

    expect(result.kind).toBe('undone');
    if (result.kind !== 'undone' || result.decision.kind !== 'waiting') {
      throw new Error(`expected undone/waiting, got ${JSON.stringify(result)}`);
    }
    expect(result.decision.effectiveEndOfDay).toEqual(new Date(2026, 7, 16, 19, 30, 0));
    expect((await storage.readState())?.snoozeMinutesTotal).toBe(0);
  });

  it('one minute before the configured time is still allowed (boundary)', async () => {
    const storage = new InMemoryScheduleStorage(config());
    await storage.saveState(snoozed(15));
    const result = await undoSnoozeToday(storage, new FakeClock(EVENING_BEFORE), config());
    expect(result.kind).toBe('undone');
  });

  it('at the configured time or after it: refused with tooLate, and nothing is written', async () => {
    const storage = new InMemoryScheduleStorage(config());
    await storage.saveState(snoozed(60));

    const result = await undoSnoozeToday(storage, new FakeClock(EVENING_AT), config());

    expect(result).toEqual({
      kind: 'refused',
      availability: { kind: 'tooLate', configuredEndOfDay: new Date(2026, 7, 16, 19, 30, 0) },
    });
    expect((await storage.readState())?.snoozeMinutesTotal).toBe(60);
  });

  it('with no snooze today: refused with noSnooze', async () => {
    const storage = new InMemoryScheduleStorage(config());
    const result = await undoSnoozeToday(storage, new FakeClock(NOON), config());
    expect(result).toEqual({ kind: 'refused', availability: { kind: 'noSnooze' } });
  });

  it("a snooze from yesterday does not count as today's", async () => {
    const storage = new InMemoryScheduleStorage(config());
    await storage.saveState({ ...snoozed(60), day: '2026-08-15' });
    const result = await undoSnoozeToday(storage, new FakeClock(NOON), config());
    expect(result.kind).toBe('refused');
  });

  it('skipped or already-closed days are notAdjustable; a disabled schedule has nothing to undo', async () => {
    const skipped = new InMemoryScheduleStorage(config());
    await skipped.saveState(snoozed(30, { skipped: true }));
    expect(await readUndoSnoozeAvailability(skipped, new FakeClock(NOON), config())).toEqual({
      kind: 'notAdjustable',
    });

    const ended = new InMemoryScheduleStorage(config());
    await ended.saveState(snoozed(30, { endOfDayFired: true }));
    expect(await readUndoSnoozeAvailability(ended, new FakeClock(NOON), config())).toEqual({
      kind: 'notAdjustable',
    });

    const disabled = new InMemoryScheduleStorage(config({ endOfDayTime: null }));
    await disabled.saveState(snoozed(30));
    expect(
      await readUndoSnoozeAvailability(
        disabled,
        new FakeClock(NOON),
        config({ endOfDayTime: null }),
      ),
    ).toEqual({ kind: 'noSnooze' });
  });
});

describe('saveConfigChange (shared by `seeya config set` and Settings)', () => {
  it("changing endOfDayTime zeroes today's snooze", async () => {
    const storage = new InMemoryScheduleStorage(config());
    await storage.saveState(snoozed(60));

    const saved = await saveConfigChange(storage, new FakeClock(NOON), (c) => ({
      ...c,
      endOfDayTime: '18:00',
    }));

    expect(saved.snoozeCleared).toBe(true);
    expect((await storage.readState())?.snoozeMinutesTotal).toBe(0);
    expect((await storage.readConfig()).endOfDayTime).toBe('18:00');
  });

  it('saving another key leaves the snooze alone', async () => {
    const storage = new InMemoryScheduleStorage(config());
    await storage.saveState(snoozed(60));

    const saved = await saveConfigChange(storage, new FakeClock(NOON), (c) => ({
      ...c,
      relevanceHours: 6,
    }));

    expect(saved.snoozeCleared).toBe(false);
    expect((await storage.readState())?.snoozeMinutesTotal).toBe(60);
  });

  it('re-saving the same endOfDayTime keeps the snooze', async () => {
    const storage = new InMemoryScheduleStorage(config());
    await storage.saveState(snoozed(60));
    const saved = await saveConfigChange(storage, new FakeClock(NOON), (c) => ({ ...c }));
    expect(saved.snoozeCleared).toBe(false);
    expect((await storage.readState())?.snoozeMinutesTotal).toBe(60);
  });

  it('never creates an estado.json just to zero a snooze that does not exist', async () => {
    const storage = new InMemoryScheduleStorage(config());
    const saved = await saveConfigChange(storage, new FakeClock(NOON), (c) => ({
      ...c,
      endOfDayTime: '18:00',
    }));
    expect(saved.snoozeCleared).toBe(false);
    expect(await storage.readState()).toBeNull();
  });
});

describe('advance notices follow the new effective deadline (S4-T7 Part 3 already covers it)', () => {
  /** Day with both notices already fired against the SNOOZED deadline (20:30). */
  function firedAgainstSnoozedDeadline(): DayState {
    return snoozed(60, {
      firedLeadTimesInMinutes: [30, 15],
      firedLeadTimesEffectiveEndOfDay: new Date(2026, 7, 16, 20, 30, 0),
    });
  }

  it('after undoing the snooze, the notices that still fit fire again for the configured time', async () => {
    const storage = new InMemoryScheduleStorage(config());
    await storage.saveState(firedAgainstSnoozedDeadline());
    const clock = new FakeClock(new Date(2026, 7, 16, 19, 10, 0));

    const undone = await undoSnoozeToday(storage, clock, config());
    expect(undone.kind).toBe('undone');

    const state = await storage.readState();
    if (state === null) {
      throw new Error('estado.json should exist after an undo');
    }
    const { decision } = decideSchedule(config(), state, clock.now());
    expect(decision).toMatchObject({ kind: 'leadTimeWarning', leadTimeMinutes: 30 });
  });

  it('after changing endOfDayTime, same thing against the new time', async () => {
    const storage = new InMemoryScheduleStorage(config());
    await storage.saveState(firedAgainstSnoozedDeadline());
    const clock = new FakeClock(new Date(2026, 7, 16, 17, 40, 0));

    const saved = await saveConfigChange(storage, clock, (c) => ({ ...c, endOfDayTime: '18:00' }));

    const state = await storage.readState();
    if (state === null) {
      throw new Error('estado.json should exist');
    }
    const { decision } = decideSchedule(saved.config, state, clock.now());
    expect(decision).toMatchObject({ kind: 'leadTimeWarning', leadTimeMinutes: 30 });
  });

  it('a snooze after the undo is a fresh deadline again (accumulates from zero)', async () => {
    const storage = new InMemoryScheduleStorage(config());
    const clock = new FakeClock(NOON);
    await snoozeToday(storage, clock, config(), 60);
    await undoSnoozeToday(storage, clock, config());
    const again = await snoozeToday(storage, clock, config(), 15);
    expect(again.totalMinutesToday).toBe(15);
  });
});
