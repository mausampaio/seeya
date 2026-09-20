/**
 * Caches the raw `AutostartStatus` (`Autostart.status()`) across refresh cycles, re-querying only
 * every `refreshIntervalMs` instead of every single tick (PO review of V2-T2, `docs/QUESTOES.md`
 * Q-071): measured on the PO's own machine, against his real, live daemon, `Autostart.status()`
 * cost **6,017ms on its first call** — Windows' `ScheduledTasks` PowerShell module, cold — and
 * 1,416ms for the whole status panel on the very next call (still warmer than the first, per the
 * same measurement). A 5s (then 10s) refresh cycle calling this on every tick would mean the
 * status panel routinely blocks for seconds, for a line that essentially never changes between
 * refreshes (autostart is an OS-level setting a person changes by running `seeya autostart
 * enable/disable`, not something that flips moment to moment).
 *
 * **Gated by elapsed real time via the injected `Clock`, never a tick counter.** A counter that
 * assumes "6 ticks of a 10s loop is 60s" silently drifts the moment any single tick itself takes
 * longer than its nominal interval (exactly what this module exists to protect against — the
 * measurement above shows one tick CAN take 6+ seconds) — comparing two real timestamps is
 * immune to that by construction, same reasoning `docs/ARQUITETURA.md`'s `adapters/clock/` gives
 * for "a única fonte de 'agora'".
 *
 * **Caches the raw `status`, not just the rendered `report` text, since V2-T13.** The autostart
 * control button (`state/autostart-control-panel.ts#resolveAutostartControlAvailability`) needs
 * the SAME status this cache already pays for — deriving `report` from it (via
 * `@seeya-ai/engine/application/autostart-state.js#formatAutostartStatus`, the pure half split out
 * for exactly this) means the button never costs a second, redundant `Autostart.status()` call.
 */
import type { AutostartStatus } from '@seeya-ai/engine/core/ports.js';
import { formatAutostartStatus } from '@seeya-ai/engine/application/autostart-state.js';

export interface AutostartCacheEntry {
  readonly status: AutostartStatus;
  readonly report: string;
  readonly checkedAt: Date;
}

/**
 * `entry` if it's still fresh (`now - entry.checkedAt < refreshIntervalMs`), otherwise a new entry
 * built by calling `fetchStatus()` (only when actually needed — never called just to check
 * freshness). `entry: null` (no cache yet, e.g. the very first cycle) always refreshes.
 *
 * @example
 * let cache: AutostartCacheEntry | null = null;
 * // ...once per refresh cycle:
 * cache = await resolveAutostartReport(cache, clock.now(), 60_000, () => context.autostart.status());
 * const autostartReport = cache.report; // for the status panel
 * const availability = resolveAutostartControlAvailability(context.daemonOwner, cache.status);
 */
export async function resolveAutostartReport(
  entry: AutostartCacheEntry | null,
  now: Date,
  refreshIntervalMs: number,
  fetchStatus: () => Promise<AutostartStatus>,
): Promise<AutostartCacheEntry> {
  if (entry !== null && now.getTime() - entry.checkedAt.getTime() < refreshIntervalMs) {
    return entry;
  }
  const status = await fetchStatus();
  return { status, report: formatAutostartStatus(status), checkedAt: now };
}

/** `electron/main.ts`'s own default — 60s, six times the 10s refresh cycle
 * (`electron/main.ts#REFRESH_INTERVAL_MS`), chosen because autostart is an OS-level setting that
 * only changes when the person runs `seeya autostart enable/disable` themselves, never on its
 * own — a full minute of staleness costs nothing a person would notice, and it's what turns a
 * 6-second query into an occasional cost instead of one paid on every tick. */
export const DEFAULT_AUTOSTART_REFRESH_INTERVAL_MS = 60_000;
