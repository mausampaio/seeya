import { describe, expect, it } from 'vitest';
import { runRefreshLoop } from '../../../../packages/app/src/state/refresh-loop.js';
import type { Clock } from '@seeya-ai/engine/core/ports.js';

/** A named double implementing `Clock` (AGENTS.md § "Testes") — records every `sleep` call and
 * resolves it immediately, so this test never waits out a real interval. */
class FakeClock implements Clock {
  readonly sleptMs: number[] = [];
  now(): Date {
    return new Date('2026-01-01T00:00:00.000Z');
  }
  sleep(ms: number): Promise<void> {
    this.sleptMs.push(ms);
    return Promise.resolve();
  }
}

describe('runRefreshLoop', () => {
  it('calls onTick immediately, before ever sleeping', async () => {
    const clock = new FakeClock();
    let ticks = 0;

    await runRefreshLoop({
      clock,
      intervalMs: 1000,
      shouldStop: () => ticks >= 1,
      onTick: () => {
        ticks += 1;
        return Promise.resolve();
      },
    });

    expect(ticks).toBe(1);
    expect(clock.sleptMs).toEqual([]);
  });

  it('sleeps intervalMs between ticks, and stops exactly when shouldStop flips', async () => {
    const clock = new FakeClock();
    let ticks = 0;

    await runRefreshLoop({
      clock,
      intervalMs: 5000,
      shouldStop: () => ticks >= 3,
      onTick: () => {
        ticks += 1;
        return Promise.resolve();
      },
    });

    expect(ticks).toBe(3);
    expect(clock.sleptMs).toEqual([5000, 5000]);
  });

  it('never ticks at all when shouldStop is already true', async () => {
    const clock = new FakeClock();
    let ticks = 0;

    await runRefreshLoop({
      clock,
      intervalMs: 1000,
      shouldStop: () => true,
      onTick: () => {
        ticks += 1;
        return Promise.resolve();
      },
    });

    expect(ticks).toBe(0);
  });
});
