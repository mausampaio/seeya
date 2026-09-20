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
import type {
  Autostart,
  AutostartDisableResult,
  AutostartEnableResult,
  AutostartStatus,
} from '../core/ports.js';

/**
 * The pure half of `describeAutostartState` below — split out in V2-T13 so a caller that already
 * HAS an `AutostartStatus` (`packages/app/src/state/autostart-cache.ts`, which caches the raw
 * status so it can ALSO feed `state/autostart-control-panel.ts#resolveAutostartControlAvailability`
 * without a second, redundant `Autostart.status()` call — Q-071's own measurement is why that
 * call is cached at all) can format it without asking the OS again.
 */
export function formatAutostartStatus(status: AutostartStatus): string {
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

export async function describeAutostartState(autostart: Autostart): Promise<string> {
  return formatAutostartStatus(await autostart.status());
}

/**
 * V2-T13 item 4: the pure text `cli/autostart-command.ts#runAutostartEnableCommand` already
 * prints for each `AutostartEnableResult` (S5-T1's cuidado (f)) — split out so
 * `electron/main.ts`'s own "Enable autostart" IPC handler can print the identical wording (D-039)
 * without `app/` importing `cli/` (D-043: the two composition roots never import each other).
 * `cli/autostart-command.ts` still owns the ownership refusal check (only the CLI is ever
 * refused, D-045 item 3) — this function only ever runs AFTER that check already passed.
 */
export function formatAutostartEnableResult(result: AutostartEnableResult): string {
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

/** Same reasoning as `formatAutostartEnableResult` above, for `seeya autostart disable`'s own
 * wording. */
export function formatAutostartDisableResult(result: AutostartDisableResult): string {
  return result.kind === 'removed'
    ? 'Autostart disabled: seeya daemon will no longer start on login.'
    : 'Autostart was already disabled. Nothing changed.';
}
