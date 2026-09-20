/**
 * V2-T13 (D-045 items 1/2): pure decisions over "who owns the daemon/autostart on this machine".
 * Both functions here are pure — the actual OS query (`AppInstallation.find()`) and the actual
 * facts about an existing CLI daemon/autostart are gathered by the composition root (`cli/`/
 * `app/`) and handed in as plain values, the same split `core/daemon-lock.ts#decideLockAcquisition`
 * already draws between "ask the world" and "decide from what the world said".
 */
import type { AppInstallationStatus } from '../core/ports.js';
import type { DaemonOwner, DaemonOwnershipTransitionAnswer } from '../core/types.js';
import { normalizeCwdForComparison, type PathPlatformHint } from '../core/cwd-normalization.js';

/**
 * Everything `shouldOfferDaemonOwnershipTransition` needs, all pre-gathered plain facts —
 * `cliDaemonAlive` from `scheduler/daemon-state.ts#checkLiveLock`, `cliDaemonLaunchedBy` from that
 * SAME lock's own `DaemonLockInfo.launchedBy` (V2-T25), `cliAutostartRegisteredPath` from
 * `Autostart.status()`'s own `registeredPath` (only for the `enabled`/`brokenPath` states — the
 * two that mean "something IS registered"; `undefined` for `disabled`/`unknown`, where there is
 * nothing to compare at all).
 *
 * **V2-T25 fixed a bug here: neither fact used to say WHOSE daemon/autostart it was.** The
 * original text argued "a lock found before the app ever ran its own daemon can only be the
 * CLI's" — true only until the app's OWN autostart could start its OWN daemon before its own
 * window ever opened (exactly what V2-T13 item 4 built): from that point on, "something exists"
 * stopped implying "something CLI-owned exists", and the question started offering to take over
 * the app's own daemon/autostart. This function now compares each fact's own executable path
 * against `owner.launchPath` (`isCallerTheOwningApp`, reused rather than a second comparison, the
 * plan's own instruction) — only a genuinely DIFFERENT binary counts as evidence.
 */
export interface DaemonOwnershipTransitionInputs {
  readonly owner: DaemonOwner;
  readonly previousAnswer: DaemonOwnershipTransitionAnswer | null;
  readonly cliDaemonAlive: boolean;
  /**
   * The alive lock's own `launchedBy` (`core/daemon-lock.ts#DaemonLockInfo.launchedBy`) —
   * meaningless, and ignored, when `cliDaemonAlive` is `false`. `undefined` when the lock predates
   * this field or its own capture failed: read as "don't know who started it", never as "someone
   * else did" (D-025) — a live daemon with no `launchedBy` recorded contributes NO evidence toward
   * offering the question, exactly like `cliAutostartRegisteredPath` below being `undefined`.
   */
  readonly cliDaemonLaunchedBy: string | undefined;
  /**
   * `AutostartStatus.registeredPath`, only when `status().kind` is `'enabled'` or `'brokenPath'`
   * (D-024's four states collapsed to the one bit this decision needs, same collapse the pre-V2-T25
   * text already did for the boolean this field replaces) — `undefined` for `'disabled'`/`'unknown'`,
   * where nothing is registered or nothing could be determined, either way no evidence at all.
   */
  readonly cliAutostartRegisteredPath: string | undefined;
  /** The same `PathPlatformHint` `isCallerTheOwningApp` needs for its own separator/case-tolerant
   * comparison (`core/cwd-normalization.ts`) — threaded in by the caller, never read from
   * `process.platform` here (this function stays a plain value comparison, same discipline
   * `isCallerTheOwningApp`'s own docstring already explains). */
  readonly platform: PathPlatformHint;
}

/**
 * D-045 item 1's "pergunta única": true only the first time the app finds itself the owner while
 * something pre-existing AND GENUINELY OWNED BY SOMEONE ELSE (a running daemon or a registered
 * autostart, either one is enough) would actually be affected by taking over — never for a fresh
 * machine with neither, and never (V2-T25) for the app's own already-running daemon/already-
 * registered autostart, which taking over would change nothing about. `previousAnswer !== null` is
 * what makes this "única": once answered, either way, this returns `false` forever after on this
 * machine (D-045: "recusando: não pergunta de novo" — and accepting obviously shouldn't re-ask
 * either).
 *
 * @example
 * shouldOfferDaemonOwnershipTransition({
 *   owner: { kind: 'app', launchPath: 'C:\\...\\seeya.exe' },
 *   previousAnswer: null,
 *   cliDaemonAlive: true,
 *   cliDaemonLaunchedBy: 'C:\\Users\\dev\\node.exe',
 *   cliAutostartRegisteredPath: undefined,
 *   platform: 'win32',
 * }); // -> true — a live daemon, launched by a genuinely different executable
 *
 * @example
 * shouldOfferDaemonOwnershipTransition({
 *   owner: { kind: 'app', launchPath: 'C:\\...\\seeya.exe' },
 *   previousAnswer: null,
 *   cliDaemonAlive: true,
 *   cliDaemonLaunchedBy: 'C:\\...\\seeya.exe',
 *   cliAutostartRegisteredPath: undefined,
 *   platform: 'win32',
 * }); // -> false — the live daemon IS the app's own; nothing to take over
 */
export function shouldOfferDaemonOwnershipTransition(
  inputs: DaemonOwnershipTransitionInputs,
): boolean {
  if (inputs.owner.kind !== 'app' || inputs.previousAnswer !== null) {
    return false;
  }
  const daemonIsSomeoneElses =
    inputs.cliDaemonAlive &&
    inputs.cliDaemonLaunchedBy !== undefined &&
    !isCallerTheOwningApp(inputs.owner, inputs.cliDaemonLaunchedBy, inputs.platform);
  const autostartIsSomeoneElses =
    inputs.cliAutostartRegisteredPath !== undefined &&
    !isCallerTheOwningApp(inputs.owner, inputs.cliAutostartRegisteredPath, inputs.platform);
  return daemonIsSomeoneElses || autostartIsSomeoneElses;
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

/**
 * V2-T22: whether `daemonOwner` names an installed app AND the executable making THIS call is that
 * same app's own binary — the one case D-045 item 3's refusal must not apply to. Measured on the
 * maintainer's machine: the installer restarts the daemon after an upgrade by re-running the
 * packaged `seeya.exe` itself with the `daemon` subcommand (`packages/app/build/installer.nsh`'s
 * own `customInstall` macro), which used to hit the exact same refusal a human typing `seeya
 * daemon` from an unrelated, separately-installed CLI gets — the app was recusing itself.
 *
 * `callerExecutablePath` is `process.execPath` as the composition root already has it in hand
 * (`cli/daemon-command.ts#runDaemonLauncher`'s own `target.nodePath`, the very value it would
 * otherwise hand `spawnDetachedDaemon` to re-run itself as the worker) — never read here, so this
 * stays a plain value comparison, testable for the Windows case (separator/case) from any CI
 * runner, the same reasoning `core/cwd-normalization.ts`'s own docstring gives for taking
 * `platform` as a parameter instead of reading `process.platform` itself.
 *
 * **Reuses `normalizeCwdForComparison`, never a second path normalizer** (the spec's own
 * instruction): an executable path and a `cwd` are both just filesystem paths, and the same
 * separator/case/trailing-slash differences apply to either — the OS's own installation record
 * (`AppInstallationStatus.executablePath`) and `process.execPath` can spell the identical file
 * differently (Windows: drive-letter case, `\` vs. `/`).
 *
 * @example
 * isCallerTheOwningApp(
 *   { kind: 'app', launchPath: 'C:\\Program Files\\seeya\\seeya.exe' },
 *   'c:/program files/seeya/seeya.exe',
 *   'win32',
 * ); // -> true — same executable, different spelling
 *
 * @example
 * isCallerTheOwningApp(
 *   { kind: 'app', launchPath: 'C:\\Program Files\\seeya\\seeya.exe' },
 *   'C:\\Users\\dev\\node.exe',
 *   'win32',
 * ); // -> false — a separately-installed CLI, still refused (D-045 item 3 unchanged for it)
 */
export function isCallerTheOwningApp(
  daemonOwner: DaemonOwner,
  callerExecutablePath: string,
  platform: PathPlatformHint,
): boolean {
  return (
    daemonOwner.kind === 'app' &&
    normalizeCwdForComparison(daemonOwner.launchPath, platform) ===
      normalizeCwdForComparison(callerExecutablePath, platform)
  );
}
