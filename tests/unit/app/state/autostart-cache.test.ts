import { describe, expect, it, vi } from 'vitest';
import { resolveAutostartReport } from '../../../../packages/app/src/state/autostart-cache.js';
import type { AutostartStatus } from '@seeya-ai/engine/core/ports.js';

const DISABLED: AutostartStatus = { kind: 'disabled' };
const ENABLED_X: AutostartStatus = { kind: 'enabled', registeredPath: 'x' };
const ENABLED_Y: AutostartStatus = { kind: 'enabled', registeredPath: 'y' };
const ENABLED_Z: AutostartStatus = { kind: 'enabled', registeredPath: 'z' };

describe('resolveAutostartReport', () => {
  it('with no cache yet, always fetches — a fresh entry with the given "now", status AND its derived report', async () => {
    const fetchStatus = vi.fn().mockResolvedValue(ENABLED_X);
    const now = new Date('2026-01-01T00:00:00.000Z');

    const entry = await resolveAutostartReport(null, now, 60_000, fetchStatus);

    expect(entry).toEqual({ status: ENABLED_X, report: 'Autostart: enabled (x).', checkedAt: now });
    expect(fetchStatus).toHaveBeenCalledTimes(1);
  });

  it('reuses the cached entry when still within the refresh interval — never calls fetchStatus', async () => {
    const fetchStatus = vi
      .fn()
      .mockResolvedValue({ kind: 'unknown', error: 'should not be called' });
    const cached = {
      status: DISABLED,
      report: 'Autostart: disabled.',
      checkedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const now = new Date('2026-01-01T00:00:59.000Z'); // 59s later, under the 60s interval

    const entry = await resolveAutostartReport(cached, now, 60_000, fetchStatus);

    expect(entry).toBe(cached);
    expect(fetchStatus).not.toHaveBeenCalled();
  });

  it('refetches once the interval has fully elapsed — by real elapsed time, not a tick count', async () => {
    const fetchStatus = vi.fn().mockResolvedValue(ENABLED_Y);
    const cached = {
      status: DISABLED,
      report: 'Autostart: disabled.',
      checkedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const now = new Date('2026-01-01T00:01:00.000Z'); // exactly 60s later

    const entry = await resolveAutostartReport(cached, now, 60_000, fetchStatus);

    expect(entry).toEqual({ status: ENABLED_Y, report: 'Autostart: enabled (y).', checkedAt: now });
    expect(fetchStatus).toHaveBeenCalledTimes(1);
  });

  it('a single slow tick (e.g. 6s, per the measurement this module exists for) does not fool the next tick into thinking 60s already passed', async () => {
    const fetchStatus = vi.fn().mockResolvedValue(ENABLED_Z);
    const firstCheck = new Date('2026-01-01T00:00:00.000Z');
    // A tick that itself took 6s to run, landing only 6s after the cached entry — nowhere near
    // the 60s interval, regardless of how long the tick's OWN work took.
    const nextTick = new Date('2026-01-01T00:00:06.000Z');

    const entry = await resolveAutostartReport(
      { status: ENABLED_Z, report: 'Autostart: enabled (z).', checkedAt: firstCheck },
      nextTick,
      60_000,
      fetchStatus,
    );

    expect(fetchStatus).not.toHaveBeenCalled();
    expect(entry.checkedAt).toBe(firstCheck);
  });
});
