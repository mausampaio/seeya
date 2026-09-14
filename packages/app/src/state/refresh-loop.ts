/**
 * A generic "do this, wait, repeat until told to stop" loop — the same `Clock.sleep`-based shape
 * `scheduler/loop.ts#runDaemon` already uses in the engine (D-019: `Clock.sleep` is the only timer
 * this project ever calls, never a raw `setInterval`). `electron/main.ts` uses this to push the
 * sidebar (session list) and status panel to the renderer on an interval
 * (docs/PLANO-DE-ENTREGA.md V2-T2, item 3: "atualizada em intervalo pelo relógio injetado").
 */
import type { Clock } from '@seeya-ai/engine/core/ports.js';

export interface RefreshLoopOptions {
  readonly clock: Clock;
  readonly intervalMs: number;
  readonly shouldStop: () => boolean;
  readonly onTick: () => Promise<void>;
}

/**
 * Runs `onTick` immediately, then every `intervalMs` (via `clock.sleep`), until `shouldStop()`
 * reports `true` — checked both before the first tick and after each sleep, so a loop asked to
 * stop before it ever ran does nothing at all.
 *
 * @example
 * await runRefreshLoop({
 *   clock: systemClock,
 *   intervalMs: 3000,
 *   shouldStop: () => windowClosed,
 *   onTick: async () => window.webContents.send(CHANNELS.sessionsUpdate, await buildSidebarData()),
 * });
 */
export async function runRefreshLoop(options: RefreshLoopOptions): Promise<void> {
  while (!options.shouldStop()) {
    await options.onTick();
    if (options.shouldStop()) {
      return;
    }
    await options.clock.sleep(options.intervalMs);
  }
}
