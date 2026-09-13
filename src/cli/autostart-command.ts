/**
 * `seeya autostart enable | disable | status` (docs/PLANO-DE-ENTREGA.md S5-T1). `status` is a
 * thin wrapper around `./autostart-state.ts#describeAutostartState` — the exact function `seeya
 * status` also calls (cuidado (c): the two can never disagree).
 */
import type { Autostart } from '../core/ports.js';
import { describeAutostartState } from './autostart-state.js';

export async function runAutostartEnableCommand(
  autostart: Autostart,
  binaryPath: string,
): Promise<string> {
  const result = await autostart.enable(binaryPath);
  switch (result.kind) {
    case 'registered':
      return `Autostart enabled: seeya daemon will now start on login, from ${result.path}.`;
    case 'alreadyRegistered':
      return `Autostart was already enabled, pointing at ${result.path}. Nothing changed.`;
    case 'updated':
      return (
        `Autostart was already enabled, pointing at ${result.previousPath}. Updated it to the ` +
        `binary currently in use: ${result.newPath}.`
      );
  }
}

export async function runAutostartDisableCommand(autostart: Autostart): Promise<string> {
  const result = await autostart.disable();
  return result.kind === 'removed'
    ? 'Autostart disabled: seeya daemon will no longer start on login.'
    : 'Autostart was already disabled. Nothing changed.';
}

export function runAutostartStatusCommand(autostart: Autostart): Promise<string> {
  return describeAutostartState(autostart);
}
