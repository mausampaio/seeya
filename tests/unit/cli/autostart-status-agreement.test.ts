/**
 * S5-T1's cuidado (c): `seeya autostart status` (`cli/autostart-command.ts#runAutostartStatusCommand`)
 * and `seeya status`'s autostart line (`cli/status-command.ts#runStatusCommand`) must never
 * disagree, because both render it through the exact same
 * `cli/autostart-state.ts#describeAutostartState` call — same discipline
 * `daemon-status-agreement.test.ts` already established for the daemon section (S4-T13).
 */
import { describe, expect, it } from 'vitest';
import { runAutostartStatusCommand } from '../../../packages/cli/src/autostart-command.js';
import { runStatusCommand } from '../../../packages/cli/src/status-command.js';
import type { AutostartStatus, ProcessControl } from '@seeya-ai/engine/core/ports.js';
import { createConfig } from '../core/_fixtures.js';
import { InMemoryDaemonStorage } from '../scheduler/_fakes.js';
import { FakeClock, FakeSessionProvider } from '../application/_fakes.js';
import { FakeAutostart } from './_autostart-fakes.js';

const NOW = new Date('2026-09-05T10:00:00.000Z');

class ScriptedProcessControl implements ProcessControl {
  isAlive(): Promise<boolean> {
    return Promise.resolve(false);
  }
  terminateGracefully(): Promise<boolean> {
    return Promise.reject(new Error('not exercised by this agreement check'));
  }
}

async function bothReports(
  status: AutostartStatus,
): Promise<{ readonly autostartStatus: string; readonly status: string }> {
  const storage = new InMemoryDaemonStorage(createConfig());
  const autostart = new FakeAutostart(status);
  const clock = new FakeClock(NOW);
  const autostartStatus = await runAutostartStatusCommand(autostart);
  const status_ = await runStatusCommand({
    sessionProvider: new FakeSessionProvider({ sessions: [], rejected: [] }),
    config: await storage.readConfig(),
    clock,
    storage,
    processControl: new ScriptedProcessControl(),
    autostart,
  });
  return { autostartStatus, status: status_ };
}

describe('seeya autostart status vs the autostart line in seeya status — never disagree', () => {
  it('disabled', async () => {
    const { autostartStatus, status } = await bothReports({ kind: 'disabled' });
    expect(status).toContain(autostartStatus);
  });

  it('enabled', async () => {
    const { autostartStatus, status } = await bothReports({
      kind: 'enabled',
      registeredPath: 'c:\\code\\seeya\\dist\\cli\\index.js',
    });
    expect(status).toContain(autostartStatus);
    expect(autostartStatus).toContain('enabled');
  });

  it('brokenPath', async () => {
    const { autostartStatus, status } = await bothReports({
      kind: 'brokenPath',
      registeredPath: 'c:\\code\\see-you-tomorrow\\dist\\cli\\index.js',
    });
    expect(status).toContain(autostartStatus);
    expect(autostartStatus).toContain('no longer exists');
  });

  it('unknown', async () => {
    const { autostartStatus, status } = await bothReports({ kind: 'unknown', error: 'boom' });
    expect(status).toContain(autostartStatus);
    expect(autostartStatus).toContain('boom');
  });
});
