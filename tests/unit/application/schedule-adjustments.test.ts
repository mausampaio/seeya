/**
 * `application/schedule-adjustments.ts` (V2-T5b item 2) — the orchestration moved out of
 * `packages/cli/src/snooze-command.ts` so the interface's own faixa de horário
 * (`packages/app/src/state/schedule-strip.ts`) can reuse it. `tests/unit/cli/snooze-command.test.ts`
 * still covers the CLI's own text rendering end to end (unchanged behavior); this suite is about
 * the shared orchestration itself: does it read/apply/save/re-decide correctly, independent of any
 * caller's wording.
 */
import { describe, expect, it } from 'vitest';
import {
  parseSnoozeIncrement,
  skipToday,
  snoozeToday,
  SNOOZE_INCREMENTS,
} from '@seeya-ai/engine/application/schedule-adjustments.js';
import { FakeStorage, FakeClock, DEFAULT_TEST_CONFIG } from './_fakes.js';
import type { Config, DayState } from '@seeya-ai/engine/core/types.js';
import type { Storage } from '@seeya-ai/engine/core/ports.js';

/** In-memory `estado.json` — the same shape `tests/unit/cli/_fakes.ts#InMemoryScheduleStorage`
 * builds for the CLI's own suite, local here since only this file needs it under `application/`. */
class InMemoryScheduleStorage extends FakeStorage {
  private state: DayState | null = null;

  override readState(): Promise<DayState | null> {
    return Promise.resolve(this.state);
  }

  override saveState(state: DayState): Promise<void> {
    this.state = state;
    return Promise.resolve();
  }
}

function config(overrides: Partial<Config> = {}): Config {
  return { ...DEFAULT_TEST_CONFIG, endOfDayTime: '19:30', ...overrides };
}

const NOON = new Date(2026, 7, 16, 12, 0, 0); // 2026-08-16, before 19:30

describe('SNOOZE_INCREMENTS / parseSnoozeIncrement', () => {
  it('has exactly the three D-006 increments', () => {
    expect(SNOOZE_INCREMENTS).toEqual({ '+15m': 15, '+30m': 30, '+1h': 60 });
  });

  it('parseSnoozeIncrement accepts them and rejects anything else', () => {
    expect(parseSnoozeIncrement('+15m')).toBe(15);
    expect(parseSnoozeIncrement('+45m')).toBeNull();
  });
});

describe('snoozeToday', () => {
  it('persists the increment and returns the resulting decision', async () => {
    const storage: Storage = new InMemoryScheduleStorage(config());
    const clock = new FakeClock(NOON);

    const result = await snoozeToday(storage, clock, config(), 30);

    expect(result.minutesAdded).toBe(30);
    expect(result.totalMinutesToday).toBe(30);
    expect(result.decision.kind).toBe('waiting');
    const state = await storage.readState();
    expect(state?.snoozeMinutesTotal).toBe(30);
  });

  it('accumulates across calls the same day (D-006: "não há limite de adiamentos")', async () => {
    const storage: Storage = new InMemoryScheduleStorage(config());
    const clock = new FakeClock(NOON);

    await snoozeToday(storage, clock, config(), 15);
    const second = await snoozeToday(storage, clock, config(), 30);

    expect(second.totalMinutesToday).toBe(45);
  });

  it('starts from an empty DayState when nothing was ever persisted', async () => {
    const storage: Storage = new InMemoryScheduleStorage(config());
    const clock = new FakeClock(NOON);

    const result = await snoozeToday(storage, clock, config(), 15);

    expect(result.totalMinutesToday).toBe(15);
  });
});

describe('skipToday', () => {
  it('persists skipped: true and returns the resulting decision', async () => {
    const storage: Storage = new InMemoryScheduleStorage(config());
    const clock = new FakeClock(NOON);

    const result = await skipToday(storage, clock, config());

    expect(result.decision.kind).toBe('skipped');
    const state = await storage.readState();
    expect(state?.skipped).toBe(true);
  });

  it('keeps any snooze already recorded today (independent of skip, per core/schedule.ts)', async () => {
    const storage: Storage = new InMemoryScheduleStorage(config());
    const clock = new FakeClock(NOON);

    await snoozeToday(storage, clock, config(), 30);
    await skipToday(storage, clock, config());

    const state = await storage.readState();
    expect(state?.snoozeMinutesTotal).toBe(30);
    expect(state?.skipped).toBe(true);
  });
});
