/**
 * `seeya autostart enable | disable | status` (docs/PLANO-DE-ENTREGA.md S5-T1). `status` is a
 * thin wrapper around `./autostart-state.ts#describeAutostartState` — the exact function `seeya
 * status` also calls (cuidado (c): the two can never disagree).
 *
 * **V2-T13, D-045 item 3: `enable` refuses when the app owns autostart.** `disable`/`status` are
 * untouched — "um cliente pode olhar e pode parar, nunca assumir a posse" (D-045's own words):
 * only the command that would REGISTER something on the CLI's behalf needs the ownership check.
 */
import type { Autostart } from '@seeya-ai/engine/core/ports.js';
import type { DaemonOwner } from '@seeya-ai/engine/core/types.js';
import { describeAutostartState } from '@seeya-ai/engine/application/autostart-state.js';

/** The exact refusal line D-045 item 3 asks for, mirroring
 * `cli/daemon-command.ts#daemonOwnedByAppMessage`'s own shape for the analogous "the app owns the
 * daemon" refusal — same reasoning, different noun. */
function autostartOwnedByAppMessage(owner: Extract<DaemonOwner, { kind: 'app' }>): string {
  return (
    `seeya: the app is installed (${owner.launchPath}) and now owns autostart. Open seeya and ` +
    'use the autostart toggle there — "seeya autostart enable" no longer registers one here.'
  );
}

export async function runAutostartEnableCommand(
  autostart: Autostart,
  binaryPath: string,
  daemonOwner: DaemonOwner,
): Promise<string> {
  if (daemonOwner.kind === 'app') {
    return autostartOwnedByAppMessage(daemonOwner);
  }
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
