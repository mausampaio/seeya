/**
 * The exact same status text `seeya status` prints — one function, calling the same engine
 * functions `cli/status-command.ts#runStatusCommand` calls, over the same ports
 * (`@seeya-ai/engine/scheduler/daemon-state.js#describeDaemonState`,
 * `@seeya-ai/engine/application/eligibility-view.js#countEligibleSessions`,
 * `@seeya-ai/engine/application/format-status.js#formatStatusReport`) — not a second
 * interpretation of the same state (docs/PLANO-DE-ENTREGA.md V2-T2: "o painel de estado bate com
 * `seeya status`"; same "one implementation, two callers" discipline S4-T13 established for the
 * daemon section, now with a THIRD caller).
 *
 * **Takes an already-fetched `DiscoveryResult` and an already-resolved autostart line, not a
 * `SessionProvider`/`Autostart` to call itself (PO review of V2-T2).** Measured on the PO's
 * machine, against his own real, live `~/.claude`/`~/.seeya` (daemon running): `describeDaemonState`
 * cost ~237ms (fine every cycle), but `describeAutostartState` cost **6,017ms on its first call**
 * (Windows' `ScheduledTasks` PowerShell module, cold) — `state/refresh-loop.ts`'s cycle used to
 * call both `sessionProvider.list()` (a SECOND discovery, `sidebar/sidebar-data.ts` already does
 * one) and `autostart.status()` on every single tick. `electron/main.ts` now fetches discovery
 * once per cycle and reuses `state/autostart-cache.ts#resolveAutostartReport`'s own cached line,
 * refreshed only every 60s — see that module's own docstring for the caching rule. This function's
 * own job shrinks to "assemble the report from what's already been fetched", plus the daemon
 * section, which stays cheap enough (~0.24s measured) to recompute every cycle.
 */
import { describeDaemonState } from '@seeya-ai/engine/scheduler/daemon-state.js';
import { countEligibleSessions } from '@seeya-ai/engine/application/eligibility-view.js';
import { formatStatusReport } from '@seeya-ai/engine/application/format-status.js';
import type {
  Clock,
  DiscoveryResult,
  ProcessControl,
  Storage,
} from '@seeya-ai/engine/core/ports.js';
import type { Config } from '@seeya-ai/engine/core/types.js';

export interface StatusPanelInputs {
  readonly discovery: DiscoveryResult;
  readonly config: Config;
  readonly clock: Clock;
  readonly storage: Storage;
  readonly processControl: ProcessControl;
  /** Already resolved by the caller — `state/autostart-cache.ts#resolveAutostartReport`'s cached
   * value, never queried by this function directly. */
  readonly autostartReport: string;
}

export async function buildStatusPanelText(inputs: StatusPanelInputs): Promise<string> {
  const now = inputs.clock.now();
  // One liveness check per call, same discipline as cli/status-command.ts's own docstring
  // (describeDaemonState itself only calls ProcessControl.isAlive once).
  const { report: daemonAndScheduleReport, todayEndOfDayOverride } =
    await describeDaemonState(inputs);
  return formatStatusReport({
    endOfDayTime: inputs.config.endOfDayTime,
    discoveredSessionCount: inputs.discovery.sessions.length,
    eligibleSessionCount: countEligibleSessions(inputs.discovery.sessions, inputs.config, now),
    daemonAndScheduleReport,
    todayEndOfDayOverride,
    autostartReport: inputs.autostartReport,
  });
}
