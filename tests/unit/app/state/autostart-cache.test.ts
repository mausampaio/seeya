import { describe, expect, it, vi } from 'vitest';
import { resolveAutostartReport } from '../../../../packages/app/src/state/autostart-cache.js';

describe('resolveAutostartReport', () => {
  it('with no cache yet, always fetches — a fresh entry with the given "now"', async () => {
    const fetchReport = vi.fn().mockResolvedValue('Autostart: enabled (x).');
    const now = new Date('2026-01-01T00:00:00.000Z');

    const entry = await resolveAutostartReport(null, now, 60_000, fetchReport);

    expect(entry).toEqual({ report: 'Autostart: enabled (x).', checkedAt: now });
    expect(fetchReport).toHaveBeenCalledTimes(1);
  });

  it('reuses the cached entry when still within the refresh interval — never calls fetchReport', async () => {
    const fetchReport = vi.fn().mockResolvedValue('should not be called');
    const cached = {
      report: 'Autostart: disabled.',
      checkedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const now = new Date('2026-01-01T00:00:59.000Z'); // 59s later, under the 60s interval

    const entry = await resolveAutostartReport(cached, now, 60_000, fetchReport);

    expect(entry).toBe(cached);
    expect(fetchReport).not.toHaveBeenCalled();
  });

  it('refetches once the interval has fully elapsed — by real elapsed time, not a tick count', async () => {
    const fetchReport = vi.fn().mockResolvedValue('Autostart: enabled (y).');
    const cached = {
      report: 'Autostart: disabled.',
      checkedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const now = new Date('2026-01-01T00:01:00.000Z'); // exactly 60s later

    const entry = await resolveAutostartReport(cached, now, 60_000, fetchReport);

    expect(entry).toEqual({ report: 'Autostart: enabled (y).', checkedAt: now });
    expect(fetchReport).toHaveBeenCalledTimes(1);
  });

  it('a single slow tick (e.g. 6s, per the measurement this module exists for) does not fool the next tick into thinking 60s already passed', async () => {
    const fetchReport = vi.fn().mockResolvedValue('Autostart: enabled (z).');
    const firstCheck = new Date('2026-01-01T00:00:00.000Z');
    // A tick that itself took 6s to run, landing only 6s after the cached entry — nowhere near
    // the 60s interval, regardless of how long the tick's OWN work took.
    const nextTick = new Date('2026-01-01T00:00:06.000Z');

    const entry = await resolveAutostartReport(
      { report: 'Autostart: enabled (z).', checkedAt: firstCheck },
      nextTick,
      60_000,
      fetchReport,
    );

    expect(fetchReport).not.toHaveBeenCalled();
    expect(entry.checkedAt).toBe(firstCheck);
  });
});
