/**
 * Pure decision layer for `Autostart` (`core/ports.ts`, docs/PLANO-DE-ENTREGA.md S5-T1). Every
 * concrete adapter (`adapters/autostart/`) asks its own OS mechanism two separate, fallible
 * questions — "is something registered, and for which path" and "does that path still exist on
 * disk" — and hands both answers here as plain values. Keeping the branching here means the
 * four-state decision (D-024) and the enable-idempotence decision are each tested once, in
 * isolation from schtasks/systemctl/launchctl, instead of once per OS adapter — same split
 * `cli/daemon-state.ts#checkLiveLock`/`describeLiveness` already draws for the daemon lock.
 */
import type { AutostartEnableResult, AutostartStatus } from './ports.js';

/**
 * What an OS adapter's own query returns before this module's pure logic sees it: a discriminated
 * union, not `{ registered: boolean; registeredPath?: string }` (D-024) — a registered
 * autostart entry without a path is not a state any adapter can actually produce (Windows Task
 * Scheduler, a systemd unit and a LaunchAgent all only ever exist WITH some path baked into their
 * launch command), so the type doesn't leave room to represent it.
 */
export type AutostartRawQuery =
  { readonly registered: false } | { readonly registered: true; readonly registeredPath: string };

/**
 * `AutostartStatus`'s decision, given what the OS reported (`query`) and whether `query`'s
 * `registeredPath` still exists on disk (`pathExists` — the adapter's own I/O check, done outside
 * this pure function). `unknown` is never produced here: that state only exists when the OS QUERY
 * ITSELF throws, which this function never sees — the adapter's own `try`/`catch` around its
 * query is what produces `unknown`, before this function is ever called.
 */
export function classifyAutostartStatus(
  query: AutostartRawQuery,
  pathExists: boolean,
): AutostartStatus {
  if (!query.registered) {
    return { kind: 'disabled' };
  }
  return pathExists
    ? { kind: 'enabled', registeredPath: query.registeredPath }
    : { kind: 'brokenPath', registeredPath: query.registeredPath };
}

/**
 * `Autostart.enable(newPath)`'s decision (S5-T1's cuidado (f)): "enable diz o que registrou;
 * repetido, diz que já existia e o que mudou (caminho antigo vs. novo), sem duplicar." The
 * adapter always performs the same idempotent registration call either way (Windows'
 * `Register-ScheduledTask`, systemd's `enable`, launchctl's load, all safe to repeat) — this
 * function only decides what to SAY about it, from the query taken immediately before that call.
 */
export function decideAutostartEnable(
  query: AutostartRawQuery,
  newPath: string,
): AutostartEnableResult {
  if (!query.registered) {
    return { kind: 'registered', path: newPath };
  }
  if (query.registeredPath === newPath) {
    return { kind: 'alreadyRegistered', path: newPath };
  }
  return { kind: 'updated', previousPath: query.registeredPath, newPath };
}
