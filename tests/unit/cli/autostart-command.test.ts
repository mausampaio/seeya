/**
 * `cli/autostart-command.ts` (docs/PLANO-DE-ENTREGA.md S5-T1) — the three subcommand renderers,
 * exercised against a scripted `Autostart` double (AGENTS.md § "Testes": named class, not an
 * inline stub). `runAutostartStatusCommand`'s own agreement with `seeya status` is covered
 * separately in `autostart-status-agreement.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import {
  runAutostartDisableCommand,
  runAutostartEnableCommand,
  runAutostartStatusCommand,
} from '../../../src/cli/autostart-command.js';
import type {
  Autostart,
  AutostartDisableResult,
  AutostartEnableResult,
  AutostartStatus,
} from '../../../src/core/ports.js';

class ScriptedAutostart implements Autostart {
  constructor(
    private readonly enableResult: AutostartEnableResult = { kind: 'registered', path: '' },
    private readonly disableResult: AutostartDisableResult = { kind: 'removed' },
    private readonly statusResult: AutostartStatus = { kind: 'disabled' },
  ) {}

  enable(): Promise<AutostartEnableResult> {
    return Promise.resolve(this.enableResult);
  }

  disable(): Promise<AutostartDisableResult> {
    return Promise.resolve(this.disableResult);
  }

  status(): Promise<AutostartStatus> {
    return Promise.resolve(this.statusResult);
  }
}

const BINARY_PATH = 'c:\\code\\seeya\\dist\\cli\\index.js';

describe('runAutostartEnableCommand', () => {
  it('freshly registered', async () => {
    const autostart = new ScriptedAutostart({ kind: 'registered', path: BINARY_PATH });
    const report = await runAutostartEnableCommand(autostart, BINARY_PATH);
    expect(report).toBe(
      `Autostart enabled: seeya daemon will now start on login, from ${BINARY_PATH}.`,
    );
  });

  it('already registered at the same path (cuidado f: says it already existed)', async () => {
    const autostart = new ScriptedAutostart({ kind: 'alreadyRegistered', path: BINARY_PATH });
    const report = await runAutostartEnableCommand(autostart, BINARY_PATH);
    expect(report).toBe(
      `Autostart was already enabled, pointing at ${BINARY_PATH}. Nothing changed.`,
    );
  });

  it('registered at a different (renamed) path — names both the old and new path (cuidado f)', async () => {
    const oldPath = 'c:\\code\\see-you-tomorrow\\dist\\cli\\index.js';
    const autostart = new ScriptedAutostart({
      kind: 'updated',
      previousPath: oldPath,
      newPath: BINARY_PATH,
    });
    const report = await runAutostartEnableCommand(autostart, BINARY_PATH);
    expect(report).toContain(oldPath);
    expect(report).toContain(BINARY_PATH);
  });
});

describe('runAutostartDisableCommand', () => {
  it('removed', async () => {
    const autostart = new ScriptedAutostart(undefined, { kind: 'removed' });
    const report = await runAutostartDisableCommand(autostart);
    expect(report).toBe('Autostart disabled: seeya daemon will no longer start on login.');
  });

  it('not registered — not an error (D-025)', async () => {
    const autostart = new ScriptedAutostart(undefined, { kind: 'notRegistered' });
    const report = await runAutostartDisableCommand(autostart);
    expect(report).toBe('Autostart was already disabled. Nothing changed.');
  });
});

describe('runAutostartStatusCommand', () => {
  it('delegates to the same rendering seeya status uses', async () => {
    const autostart = new ScriptedAutostart(undefined, undefined, {
      kind: 'enabled',
      registeredPath: BINARY_PATH,
    });
    const report = await runAutostartStatusCommand(autostart);
    expect(report).toBe(`Autostart: enabled (${BINARY_PATH}).`);
  });
});
