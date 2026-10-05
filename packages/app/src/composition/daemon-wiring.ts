/**
 * The daemon / autostart / ownership-transition wiring of `buildAppContext` (V2-T5b, V2-T13,
 * V2-T23, V2-T25, V2-T31; V2-T51: split out of `composition/index.ts` — same code, same comments,
 * now behind one function with its inputs named).
 */
import { processControl as realProcessControl } from '@seeya-ai/engine/adapters/process/index.js';
import {
  spawnDetachedDaemon,
  type DaemonLaunchTarget,
} from '@seeya-ai/engine/adapters/process/daemon-launch.js';
import { buildAutostartEnv } from '@seeya-ai/engine/adapters/autostart/env.js';
import { checkDaemonLock } from '@seeya-ai/engine/scheduler/index.js';
import { formatDaemonStartOutcome, startDaemonAndWait } from './daemon-start.js';
import { checkLiveLock } from '@seeya-ai/engine/scheduler/daemon-state.js';
import { runDaemonStop } from '@seeya-ai/engine/scheduler/daemon-control.js';
import {
  resolveDaemonOwner,
  shouldOfferDaemonOwnershipTransition,
} from '@seeya-ai/engine/application/daemon-ownership.js';
import type {
  AppInstallation,
  Autostart,
  AutostartEnableResult,
  Clock,
  Storage,
} from '@seeya-ai/engine/core/ports.js';
import type { DaemonOwner, DaemonOwnershipTransitionAnswer } from '@seeya-ai/engine/core/types.js';
import type { PathPlatformHint } from '@seeya-ai/engine/core/cwd-normalization.js';
import { applyDaemonOwnershipTransition as applyDaemonOwnershipTransitionOrchestration } from './daemon-ownership-transition.js';
import { resolveCliDaemonScriptPath } from './cli-daemon-script.js';

export interface DaemonWiringInputs {
  readonly storage: Storage;
  readonly clock: Clock;
  readonly platformHint: PathPlatformHint;
  readonly tabEnv: NodeJS.ProcessEnv;
  readonly autostart: Autostart;
  readonly appInstallation: AppInstallation;
}

export interface DaemonWiring {
  readonly daemonOwner: DaemonOwner;
  readonly startDaemon: () => Promise<string>;
  readonly stopDaemon: () => Promise<string>;
  readonly enableAppAutostart: () => Promise<AutostartEnableResult>;
  readonly checkDaemonOwnershipTransitionOffer: () => Promise<boolean>;
  readonly applyDaemonOwnershipTransition: (
    answer: DaemonOwnershipTransitionAnswer,
  ) => Promise<void>;
}

export async function buildDaemonWiring(inputs: DaemonWiringInputs): Promise<DaemonWiring> {
  const { storage, clock, platformHint, tabEnv, autostart, appInstallation } = inputs;
  // V2-T5b item 3: "Subir" — the target this composition root's own `startDaemon` (below) spawns.
  // `nodePath` is THIS process's own runtime (`process.execPath`): under `npm run app`'s dev mode
  // that's a plain Node binary already; packaged under real Electron, `electron/main.ts`'s own
  // main process is Electron with `ELECTRON_RUN_AS_NODE=1` added to the child's environment below
  // — Electron's own documented mechanism for making its binary behave as plain Node — so this
  // never depends on a `node` found on `PATH` (Q-076 registers the alternative and why it was
  // rejected). `env` reuses `tabEnv` (already D-017-cleaned, same object every tab spawns with)
  // instead of a second, independently-built "clean environment" — one cleaning, one place.
  const daemonLaunchTarget: DaemonLaunchTarget = {
    nodePath: process.execPath,
    scriptPath: resolveCliDaemonScriptPath(),
    args: ['daemon'],
    env: { ...tabEnv, ELECTRON_RUN_AS_NODE: '1' },
  };
  // Mirrors cli/daemon-command.ts#runDaemonLauncher's own two branches and wording exactly — see
  // AppContext's own docstring on `startDaemon` for why this can't just BE that function.
  // V2-T31: answers only once `daemon.lock` is seen alive — see `composition/daemon-start.ts`.
  async function startDaemon(): Promise<string> {
    const outcome = await startDaemonAndWait({
      storage,
      processControl: realProcessControl,
      clock,
      checkLock: () => checkDaemonLock(storage, realProcessControl),
      spawnDaemon: () => spawnDetachedDaemon(daemonLaunchTarget),
    });
    return formatDaemonStartOutcome(outcome);
  }
  function stopDaemon(): Promise<string> {
    return runDaemonStop({ storage, processControl: realProcessControl, clock });
  }
  const daemonOwner = resolveDaemonOwner(await appInstallation.find());
  // V2-T13, D-045 item 4: same target as `startDaemon`'s own `spawnDetachedDaemon` call, reused
  // here as the (nodePath, scriptPath, env) trio `Autostart.enable`'s options now accept.
  function enableAppAutostart(): Promise<AutostartEnableResult> {
    // V2-T23: `daemonLaunchTarget.env` is the FULL, D-017-cleaned environment the live "Start
    // daemon" spawn uses right now — a photograph of this login (dead `SSH_AUTH_SOCK`/`TMPDIR` at
    // the next one, XPC/launch bookkeeping, `USER`/`HOME`/`SHELL` the OS already sets) that has no
    // business going to disk for a registration read back weeks later. `buildAutostartEnv` is the
    // measured fix: only `ELECTRON_RUN_AS_NODE`/`PATH` survive (see its own docstring in
    // `@seeya-ai/engine/adapters/autostart/env.js` for the allowlist and why), and it also handles
    // `NodeJS.ProcessEnv`'s `string | undefined` values directly, so no separate filter is needed
    // here any more.
    const env = buildAutostartEnv(daemonLaunchTarget.env ?? {});
    return autostart.enable(daemonLaunchTarget.scriptPath, {
      execPath: daemonLaunchTarget.nodePath,
      env,
    });
  }
  // V2-T25 (D-045 item 1's bug fix): pre-gathers the two "something exists" facts
  // `shouldOfferDaemonOwnershipTransition` needs, WITH the evidence of who owns each one — a live
  // daemon's own `launchedBy` (`core/daemon-lock.ts#DaemonLockInfo`) and a registered autostart's
  // own `registeredPath` (`enabled`/`brokenPath` both count as "something is registered", D-024's
  // four-state `AutostartStatus` collapsed to the one bit this decision needs). Passing raw facts
  // instead of a pre-computed boolean is the fix itself: before this task, "something exists" alone
  // was treated as "something CLI-owned exists", which stopped holding the moment the app's OWN
  // autostart could start its OWN daemon before its own window ever opened (V2-T13 item 4).
  async function checkDaemonOwnershipTransitionOffer(): Promise<boolean> {
    const [previousAnswer, liveLockCheck, autostartStatus] = await Promise.all([
      storage.readDaemonOwnershipTransitionAnswer(),
      checkLiveLock({ storage, processControl: realProcessControl, clock }),
      autostart.status(),
    ]);
    return shouldOfferDaemonOwnershipTransition({
      owner: daemonOwner,
      previousAnswer,
      cliDaemonAlive: liveLockCheck.kind === 'alive',
      cliDaemonLaunchedBy:
        liveLockCheck.kind === 'alive' ? liveLockCheck.lock.launchedBy : undefined,
      cliAutostartRegisteredPath:
        autostartStatus.kind === 'enabled' || autostartStatus.kind === 'brokenPath'
          ? autostartStatus.registeredPath
          : undefined,
      platform: platformHint,
    });
  }
  function applyDaemonOwnershipTransition(answer: DaemonOwnershipTransitionAnswer): Promise<void> {
    return applyDaemonOwnershipTransitionOrchestration(answer, {
      storage,
      stopDaemon,
      enableAppAutostart,
      startDaemon,
    });
  }
  return {
    daemonOwner,
    startDaemon,
    stopDaemon,
    enableAppAutostart,
    checkDaemonOwnershipTransitionOffer,
    applyDaemonOwnershipTransition,
  };
}
