import { describe, expect, it } from 'vitest';
import { buildStatusPanelText } from '../../../../packages/app/src/state/status-panel.js';
import { createConfig } from '../../core/_fixtures.js';
import { FakeClock, FakeSessionProvider, FakeProcessControl } from '../../application/_fakes.js';
import { InMemoryDaemonStorage } from '../../scheduler/_fakes.js';
import { FakeAutostart } from '../../cli/_autostart-fakes.js';

const NOW = new Date('2026-08-29T12:00:00.000Z');

describe('buildStatusPanelText', () => {
  it('matches the shape seeya status renders: end-of-day, eligible count, daemon+schedule, autostart', async () => {
    const config = createConfig({ endOfDayTime: null });
    const text = await buildStatusPanelText({
      sessionProvider: new FakeSessionProvider({ sessions: [], rejected: [] }),
      config,
      clock: new FakeClock(NOW),
      storage: new InMemoryDaemonStorage(config),
      processControl: new FakeProcessControl(),
      autostart: new FakeAutostart({ kind: 'disabled' }),
    });

    expect(text).toContain('End-of-day time: not configured (manual only)');
    expect(text).toContain('Eligible sessions: 0 of 0 discovered');
    expect(text).toContain('Daemon: not running.');
    expect(text).toContain('Autostart: disabled.');
  });
});
