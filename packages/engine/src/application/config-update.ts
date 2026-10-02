/**
 * The ONE write path for an already-validated config change — `seeya config set` and the
 * interface's Settings dialog both go through here, so CLI and window behave the same (V2-T50,
 * D-006 amendment of 2026-09-24, rule 2): changing `endOfDayTime` zeroes today's snooze, because a
 * snooze made over the old time does not apply to the new one. Saving any other key never touches
 * the day state.
 *
 * Validation stays with the caller (`adapters/storage/config-schema.ts#parseConfigFieldUpdate`,
 * which `application/` cannot import, D-020): this module receives the change as a function over
 * the freshly-read `Config`.
 *
 * The advance notices need no extra step: `core/schedule.ts#resolveFiredLeadTimes` re-arms them
 * when the effective deadline moves (S4-T7 Part 3), and zeroing the snooze is what moves it.
 */
import { localDayString } from '../core/day.js';
import { resetSnooze } from '../core/schedule.js';
import type { Clock, Storage } from '../core/ports.js';
import type { Config } from '../core/types.js';

export interface SaveConfigChangeResult {
  readonly config: Config;
  /** `true` only when today's snooze was actually non-zero and got zeroed by this save. */
  readonly snoozeCleared: boolean;
}

async function clearTodaySnooze(storage: Storage, clock: Clock): Promise<boolean> {
  const today = localDayString(clock.now());
  const stored = await storage.readState();
  if (stored === null || stored.day !== today || stored.snoozeMinutesTotal === 0) {
    return false;
  }
  await storage.saveState(resetSnooze(stored, today));
  return true;
}

/**
 * Reads the current config, applies `change`, writes `config.json`, and (only when
 * `endOfDayTime` ended up different) zeroes today's snooze.
 *
 * @example
 * const { config } = await saveConfigChange(storage, clock, (current) =>
 *   applyConfigFieldUpdate(current, 'endOfDayTime', '18:30'),
 * );
 */
export async function saveConfigChange(
  storage: Storage,
  clock: Clock,
  change: (current: Config) => Config,
): Promise<SaveConfigChangeResult> {
  const current = await storage.readConfig();
  const updated = change(current);
  await storage.saveConfig(updated);
  const timeChanged = updated.endOfDayTime !== current.endOfDayTime;
  const snoozeCleared = timeChanged ? await clearTodaySnooze(storage, clock) : false;
  return { config: updated, snoozeCleared };
}
