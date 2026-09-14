/**
 * The exact same status text `seeya status` prints — one function, calling the same engine
 * functions `cli/status-command.ts#runStatusCommand` calls, over the same ports
 * (`@seeya-ai/engine/scheduler/daemon-state.js#describeDaemonState`,
 * `@seeya-ai/engine/application/autostart-state.js#describeAutostartState`,
 * `@seeya-ai/engine/application/eligibility-view.js#countEligibleSessions`,
 * `@seeya-ai/engine/application/format-status.js#formatStatusReport`) — not a second
 * interpretation of the same state (docs/PLANO-DE-ENTREGA.md V2-T2: "o painel de estado bate com
 * `seeya status`"; same "one implementation, two callers" discipline S4-T13 established for the
 * daemon section, now with a THIRD caller).
 */
import { describeDaemonState } from '@seeya-ai/engine/scheduler/daemon-state.js';
import { describeAutostartState } from '@seeya-ai/engine/application/autostart-state.js';
import { countEligibleSessions } from '@seeya-ai/engine/application/eligibility-view.js';
import { formatStatusReport } from '@seeya-ai/engine/application/format-status.js';
import type {
  Autostart,
  Clock,
  ProcessControl,
  SessionProvider,
  Storage,
} from '@seeya-ai/engine/core/ports.js';
import type { Config } from '@seeya-ai/engine/core/types.js';

export interface StatusPanelDeps {
  readonly sessionProvider: SessionProvider;
  readonly config: Config;
  readonly clock: Clock;
  readonly storage: Storage;
  readonly processControl: ProcessControl;
  readonly autostart: Autostart;
}

export async function buildStatusPanelText(deps: StatusPanelDeps): Promise<string> {
  const discovery = await deps.sessionProvider.list();
  const now = deps.clock.now();
  // One liveness check per call, same discipline as cli/status-command.ts's own docstring
  // (describeDaemonState itself only calls ProcessControl.isAlive once).
  const daemonAndScheduleReport = await describeDaemonState(deps);
  const autostartReport = await describeAutostartState(deps.autostart);
  return formatStatusReport({
    endOfDayTime: deps.config.endOfDayTime,
    discoveredSessionCount: discovery.sessions.length,
    eligibleSessionCount: countEligibleSessions(discovery.sessions, deps.config, now),
    daemonAndScheduleReport,
    autostartReport,
  });
}
