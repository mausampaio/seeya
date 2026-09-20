/**
 * V2-T16 regression: `snoozeTodayNow`/`skipTodayNow` (`packages/app/src/state/schedule-actions.ts`)
 * must answer every click against `config.json` as it is AT THE MOMENT OF THE CLICK, never a
 * `Config` captured earlier — the exact bug the plan entry measured on the maintainer's machine
 * (change `endOfDayTime` in the Settings dialog, click "Snooze +15m", the strip briefly showed the
 * OLD time). `InMemoryDaemonStorage` (`tests/unit/scheduler/_fakes.ts`) is the named `Storage`
 * double this needs: its `readConfig()` returns whatever `saveConfig()` most recently wrote — a
 * plain `FakeStorage` (`tests/unit/application/_fakes.ts`) can't do that, its config is fixed at
 * construction.
 */
import { describe, expect, it } from 'vitest';
import {
  snoozeTodayNow,
  skipTodayNow,
} from '../../../../packages/app/src/state/schedule-actions.js';
import { createConfig } from '../../core/_fixtures.js';
import { FakeClock } from '../../application/_fakes.js';
import { InMemoryDaemonStorage } from '../../scheduler/_fakes.js';

// 2026-09-17 09:00 local — matches schedule-strip.test.ts's own "local, not UTC" construction.
const NOW = new Date(2026, 8, 17, 9, 0, 0);

describe('snoozeTodayNow', () => {
  it(
    'reads config.json fresh on every call — a config change between two clicks is reflected on ' +
      'the second click, not just the next ambient refresh tick',
    async () => {
      const storage = new InMemoryDaemonStorage(createConfig({ endOfDayTime: '11:00' }));
      const clock = new FakeClock(NOW);

      // First click: config.json still says 11:00. +15m -> effective 11:15.
      const first = await snoozeTodayNow(storage, clock, 15);
      expect(first.text).toBe('End of day at 11:15 — in 2 h 15 min');

      // The person opens Settings and changes endOfDayTime to 09:30 — the same write
      // electron/main.ts's own CHANNELS.saveSetting handler performs.
      await storage.saveConfig({ ...(await storage.readConfig()), endOfDayTime: '09:30' });

      // Second click: snoozeMinutesTotal accumulates (D-006, now 30), but the BASE time must come
      // from the config just saved (09:30), never the 11:00 this function read on the first call.
      // A caller still holding that first Config would compute 11:00 + 30m = 11:30 here — the
      // exact stale value the maintainer watched the strip flash before this task.
      const second = await snoozeTodayNow(storage, clock, 15);
      expect(second.text).toBe('End of day at 10:00 — in 1 h 0 min');
    },
  );

  it('minutesAdded accumulate across calls even as the underlying config changes', async () => {
    const storage = new InMemoryDaemonStorage(createConfig({ endOfDayTime: '20:00' }));
    const clock = new FakeClock(NOW);

    await snoozeTodayNow(storage, clock, 30);
    const state = await storage.readState();
    expect(state?.snoozeMinutesTotal).toBe(30);

    await storage.saveConfig({ ...(await storage.readConfig()), endOfDayTime: '21:00' });
    await snoozeTodayNow(storage, clock, 60);
    const stateAfter = await storage.readState();
    expect(stateAfter?.snoozeMinutesTotal).toBe(90);
  });
});

describe('skipTodayNow', () => {
  it('reads config.json fresh too — skipped stays true regardless of the endOfDayTime on record', async () => {
    const storage = new InMemoryDaemonStorage(createConfig({ endOfDayTime: '11:00' }));
    const clock = new FakeClock(NOW);

    const result = await skipTodayNow(storage, clock);

    expect(result).toEqual({
      text: 'End of day: skipped today.',
      canSnooze: false,
      canSkip: false,
    });
    expect((await storage.readState())?.skipped).toBe(true);
  });
});
