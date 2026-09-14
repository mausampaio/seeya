/**
 * Shared by `seeya autostart status` (`cli/autostart-command.ts`) and `seeya status`
 * (`cli/status-command.ts`) — same pattern `scheduler/daemon-state.ts#describeDaemonState`
 * already established for the daemon section (S4-T13): one function, two callers, so the two
 * commands' autostart line can never disagree (S5-T1's cuidado (c),
 * `tests/unit/cli/autostart-status-agreement.test.ts`).
 *
 * **Moved here from `packages/cli/src/autostart-state.ts` in V2-T2** (the interface needs the
 * same autostart line `seeya status` renders). Lands in `application/`, not `scheduler/` like
 * `daemon-state.ts`: this function only calls `Autostart.status()` (a port method — orchestrating
 * a port is exactly what `application/` is for) and needs nothing from `scheduler/notices.ts`, so
 * there is no reason to pull it into the daemon's own layer. `cli/autostart-command.ts` and
 * `cli/status-command.ts` now import this from `@seeya-ai/engine/application/autostart-state.js`,
 * same name, same behavior — see Q-071.
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
