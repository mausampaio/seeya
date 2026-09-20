/**
 * "Snooze +15m/+30m/+1h" and "Skip today" (V2-T5b item 1), fixed in V2-T16: both ALWAYS read
 * `config.json` fresh, at the moment of the click — never a `Config` handed in by the caller.
 *
 * **The bug this replaces (docs/PLANO-DE-ENTREGA.md V2-T16).** `electron/main.ts` used to read
 * `config.json` once at window startup (`AppContext.config`) and pass THAT value straight into
 * `application/schedule-adjustments.js#snoozeToday`/`skipToday`. Changing `endOfDayTime` through
 * the Settings dialog (V2-T14, which already re-reads `config.json` for its own save) never
 * touched that startup snapshot, so the very next "Snooze +15m" click computed its answer against
 * the OLD time — the maintainer watched the strip flash 11:15 (stale 11:00 + 15) before the
 * following ambient refresh tick corrected it to 09:45 (fresh 09:30 + 15).
 *
 * **The type prevents the recaída (D-024).** Neither function below takes a `Config` parameter at
 * all — there is no argument a caller could accidentally pass a stale value through. Each call
 * reads `storage.readConfig()` itself, the same file `runRefreshLoop`'s own `onTick` and the
 * Settings dialog's `saveSetting` handler already re-read every cycle/save
 * (`electron/main.ts`'s own comment on `liveConfig`). `AppContext` itself no longer exposes a
 * general-purpose `config` field (V2-T16 item 2) — `electron/main.ts` has nothing named `config`
 * left to reach for by mistake.
 *
 * @example
 * const event = await snoozeTodayNow(context.storage, context.clock, 15);
 * // event.text reflects whatever endOfDayTime is in config.json RIGHT NOW, not at window startup
 */
import {
  skipToday as skipTodayInEngine,
  snoozeToday as snoozeTodayInEngine,
} from '@seeya-ai/engine/application/schedule-adjustments.js';
import type { Clock, Storage } from '@seeya-ai/engine/core/ports.js';
import type { ScheduleUpdateEvent } from '../ipc/channels.js';
import { buildScheduleStripData } from './schedule-strip.js';

export async function snoozeTodayNow(
  storage: Storage,
  clock: Clock,
  minutes: number,
): Promise<ScheduleUpdateEvent> {
  const now = clock.now();
  const config = await storage.readConfig();
  const result = await snoozeTodayInEngine(storage, clock, config, minutes);
  return buildScheduleStripData(result.decision, now);
}

export async function skipTodayNow(storage: Storage, clock: Clock): Promise<ScheduleUpdateEvent> {
  const now = clock.now();
  const config = await storage.readConfig();
  const result = await skipTodayInEngine(storage, clock, config);
  return buildScheduleStripData(result.decision, now);
}
