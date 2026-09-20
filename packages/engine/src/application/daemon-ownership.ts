/**
 * V2-T13 (D-045 items 1/2): pure decisions over "who owns the daemon/autostart on this machine".
 * Both functions here are pure — the actual OS query (`AppInstallation.find()`) and the actual
 * facts about an existing CLI daemon/autostart are gathered by the composition root (`cli/`/
 * `app/`) and handed in as plain values, the same split `core/daemon-lock.ts#decideLockAcquisition`
 * already draws between "ask the world" and "decide from what the world said".
 */
import type { AppInstallationStatus } from '../core/ports.js';
import type { DaemonOwner, DaemonOwnershipTransitionAnswer } from '../core/types.js';

/**
 * Everything `shouldOfferDaemonOwnershipTransition` needs, all pre-gathered plain facts —
 * `cliDaemonAlive` from `scheduler/daemon-state.ts#checkLiveLock` (a lock found before the app
 * ever ran its own daemon can only be the CLI's, since the app hasn't started one yet the first
 * time this question can even be asked), `cliAutostartEnabled` from `Autostart.status()`. Neither
 * of the two is asked to say WHOSE daemon/autostart it is (the lock/registration carries no
 * "owner" field of its own) — this function only needs "does SOMETHING already exist that the app
 * taking over would change", which either fact alone already answers.
 */
export interface DaemonOwnershipTransitionInputs {
  readonly owner: DaemonOwner;
  readonly previousAnswer: DaemonOwnershipTransitionAnswer | null;
  readonly cliDaemonAlive: boolean;
  readonly cliAutostartEnabled: boolean;
}

/**
 * D-045 item 1's "pergunta única": true only the first time the app finds itself the owner while
 * something pre-existing (a running daemon or a registered autostart, either one is enough) would
 * actually be affected by taking over — never for a fresh machine with neither, where there is
 * nothing to ask about. `previousAnswer !== null` is what makes this "única": once answered,
 * either way, this returns `false` forever after on this machine (D-045: "recusando: não pergunta
 * de novo" — and accepting obviously shouldn't re-ask either).
 *
 * @example
 * shouldOfferDaemonOwnershipTransition({
 *   owner: { kind: 'app', launchPath: 'C:\\...\\seeya.exe' },
 *   previousAnswer: null,
 *   cliDaemonAlive: true,
 *   cliAutostartEnabled: false,
 * }); // -> true
 */
export function shouldOfferDaemonOwnershipTransition(
  inputs: DaemonOwnershipTransitionInputs,
): boolean {
  return (
    inputs.owner.kind === 'app' &&
    inputs.previousAnswer === null &&
    (inputs.cliDaemonAlive || inputs.cliAutostartEnabled)
  );
}

/**
 * `AppInstallationStatus` → `DaemonOwner` (D-045's own rule, item 1): installed → the app owns the
 * daemon/autostart; not installed → the CLI still owns them, exactly as in v1; the OS query itself
 * failing → `unknown`, and **nothing downstream is ever refused for that case** (D-025) — every
 * caller of this function (`cli/daemon-command.ts#runDaemonLauncher`,
 * `cli/autostart-command.ts#runAutostartEnableCommand`) treats `'unknown'` exactly like `'cli'`:
 * on the fence about who owns it is not license to guess "the app does" and block a person who
 * has run `seeya daemon` by hand for years.
 */
export function resolveDaemonOwner(status: AppInstallationStatus): DaemonOwner {
  switch (status.kind) {
    case 'installed':
      return { kind: 'app', launchPath: status.executablePath };
    case 'notInstalled':
      return { kind: 'cli' };
    case 'unknown':
      return { kind: 'unknown' };
  }
}
