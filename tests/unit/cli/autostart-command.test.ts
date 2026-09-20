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
} from '../../../packages/cli/src/autostart-command.js';
import type {
  Autostart,
  AutostartDisableResult,
  AutostartEnableResult,
  AutostartStatus,
} from '@seeya-ai/engine/core/ports.js';
import type { DaemonOwner } from '@seeya-ai/engine/core/types.js';

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

/** V2-T13: proves `runAutostartEnableCommand` never reaches the port at all when the app owns
 * autostart — every method rejects loudly instead of a scripted "should never be called" flag
 * that a test would have to remember to assert on (AGENTS.md § "Testes": named double, not a
 * stub). */
class NeverCalledAutostart implements Autostart {
  enable(): Promise<AutostartEnableResult> {
    return Promise.reject(new Error('NeverCalledAutostart.enable should not have been called'));
  }
  disable(): Promise<AutostartDisableResult> {
    return Promise.reject(new Error('NeverCalledAutostart.disable should not have been called'));
  }
  status(): Promise<AutostartStatus> {
    return Promise.reject(new Error('NeverCalledAutostart.status should not have been called'));
  }
}

const BINARY_PATH = 'c:\\code\\seeya\\dist\\cli\\index.js';
const CLI_OWNER: DaemonOwner = { kind: 'cli' };

describe('runAutostartEnableCommand', () => {
  it('freshly registered', async () => {
    const autostart = new ScriptedAutostart({ kind: 'registered', path: BINARY_PATH });
    const report = await runAutostartEnableCommand(autostart, BINARY_PATH, CLI_OWNER);
    expect(report).toBe(
      `Autostart enabled: seeya daemon will now start on login, from ${BINARY_PATH}.`,
    );
  });

  it('already registered at the same path (cuidado f: says it already existed)', async () => {
    const autostart = new ScriptedAutostart({ kind: 'alreadyRegistered', path: BINARY_PATH });
    const report = await runAutostartEnableCommand(autostart, BINARY_PATH, CLI_OWNER);
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
    const report = await runAutostartEnableCommand(autostart, BINARY_PATH, CLI_OWNER);
    expect(report).toContain(oldPath);
    expect(report).toContain(BINARY_PATH);
  });

  // V2-T13, D-045 item 3: the app owns autostart on this machine — refuses, never calls enable().
  it('the app owns autostart → refuses, names the app path, and never calls Autostart.enable', async () => {
    const autostart = new NeverCalledAutostart();
    const owner: DaemonOwner = { kind: 'app', launchPath: 'C:\\seeya\\seeya.exe' };

    const report = await runAutostartEnableCommand(autostart, BINARY_PATH, owner);

    expect(report).toContain('the app is installed');
    expect(report).toContain('C:\\seeya\\seeya.exe');
    expect(report).toContain('seeya autostart enable');
  });

  it('the query for ownership failed (unknown) → behaves exactly like cli, never refuses (D-025)', async () => {
    const autostart = new ScriptedAutostart({ kind: 'registered', path: BINARY_PATH });
    const report = await runAutostartEnableCommand(autostart, BINARY_PATH, { kind: 'unknown' });
    expect(report).toBe(
      `Autostart enabled: seeya daemon will now start on login, from ${BINARY_PATH}.`,
    );
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
