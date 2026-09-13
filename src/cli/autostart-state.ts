/**
 * Shared by `seeya autostart status` (`cli/autostart-command.ts`) and `seeya status`
 * (`cli/status-command.ts`) — same pattern `cli/daemon-state.ts#describeDaemonState` already
 * established for the daemon section (S4-T13): one function, two callers, so the two commands'
 * autostart line can never disagree (S5-T1's cuidado (c),
 * `tests/unit/cli/autostart-status-agreement.test.ts`).
 */
import type { Autostart } from '../core/ports.js';

export async function describeAutostartState(autostart: Autostart): Promise<string> {
  const status = await autostart.status();
  switch (status.kind) {
    case 'enabled':
      return `Autostart: enabled (${status.registeredPath}).`;
    case 'disabled':
      return 'Autostart: disabled.';
    case 'brokenPath':
      return (
        `Autostart: enabled, but the registered path no longer exists ` +
        `(${status.registeredPath}). Run "seeya autostart enable" again to fix it.`
      );
    case 'unknown':
      return `Autostart: could not verify (${status.error}).`;
  }
}
