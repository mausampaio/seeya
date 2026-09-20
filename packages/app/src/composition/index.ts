/**
 * The app's composition root (D-020, emended by D-043: "cli/ e app/ são as duas raízes de
 * composição"). Mirrors `packages/cli/src/composition.ts`'s own shape and docstring — the only
 * module in `packages/app/src` allowed to name a concrete engine adapter and wire it behind a
 * port, and the only one allowed to call `os.homedir()`/read `process.env`/`process.platform`
 * directly. `electron/main.ts` calls `buildAppContext` once, at startup, with the real home
 * directory; nothing else in `packages/app/src` reaches for the real filesystem or environment on
 * its own.
 *
 * **Reuses `@seeya-ai/engine/adapters/resumption/env.js#buildResumptionEnv` directly, not by
 * copy** (docs/PLANO-DE-ENTREGA.md V2-T2, item 3: "pela mesma função que o `start-day` já usa"),
 * even though that module isn't re-exported by `adapters/resumption/index.ts` — the engine's
 * package export map (`./adapters/*.js`) resolves any path under `adapters/`, not just each
 * adapter's own `index.ts`, so this is still a legitimate public-subpath import, not a reach past
 * the package boundary the `app-only-imports-engine-public-subpaths` guard would reject (that
 * guard only tells a `packages/engine/dist/**` resolution apart from a raw
 * `packages/engine/src/**` one — see `.dependency-cruiser.cjs`'s own comment).
 */
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { systemClock } from '@seeya-ai/engine/adapters/clock/index.js';
import { buildResumptionEnv } from '@seeya-ai/engine/adapters/resumption/env.js';
import { processControl as realProcessControl } from '@seeya-ai/engine/adapters/process/index.js';
import {
  resolveCommand,
  realCommandResolutionFs,
  type ResolveCommandResult,
} from '@seeya-ai/engine/adapters/process/resolve-command.js';
import {
  spawnDetachedDaemon,
  type DaemonLaunchTarget,
} from '@seeya-ai/engine/adapters/process/daemon-launch.js';
import {
  DiscoverySessionProvider,
  DiscoveryForkCleanup,
} from '@seeya-ai/engine/adapters/discovery/index.js';
import { StorageAdapter } from '@seeya-ai/engine/adapters/storage/index.js';
import { FsDirectoryExistence } from '@seeya-ai/engine/adapters/filesystem/index.js';
import { buildAutostart } from '@seeya-ai/engine/adapters/autostart/index.js';
import { buildAppInstallation } from '@seeya-ai/engine/adapters/installation/index.js';
import { TranscriptFileReader } from '@seeya-ai/engine/adapters/transcript/index.js';
import { GitAdapter } from '@seeya-ai/engine/adapters/git/index.js';
import {
  LeanHandoffGenerator,
  DeepHandoffGenerator,
} from '@seeya-ai/engine/adapters/generation/index.js';
import { notifier as realNotifier } from '@seeya-ai/engine/adapters/notification/index.js';
import { checkDaemonLock } from '@seeya-ai/engine/scheduler/index.js';
import { checkLiveLock } from '@seeya-ai/engine/scheduler/daemon-state.js';
import { runDaemonStop } from '@seeya-ai/engine/scheduler/daemon-control.js';
import {
  resolveDaemonOwner,
  shouldOfferDaemonOwnershipTransition,
} from '@seeya-ai/engine/application/daemon-ownership.js';
import type {
  Autostart,
  AutostartEnableResult,
  Clock,
  DirectoryExistence,
  ForkCleanup,
  GitReader,
  HandoffGenerator,
  Notifier,
  ProcessControl,
  SessionProvider,
  Storage,
  TranscriptReader,
} from '@seeya-ai/engine/core/ports.js';
import type {
  Config,
  DaemonOwner,
  DaemonOwnershipTransitionAnswer,
} from '@seeya-ai/engine/core/types.js';
import type { PathPlatformHint } from '@seeya-ai/engine/core/cwd-normalization.js';
import type { EndDayDeps } from '@seeya-ai/engine/application/types.js';
import { NodePtyAdapter } from '../pty/node-pty-adapter.js';
import { PtyManager, type PtyManagerCallbacks } from '../pty/pty-manager.js';
import { defaultShellCommand, type ShellCommand } from '../pty/default-shell.js';
import { readLoginShellPath } from './read-login-shell-path.js';
import { applyDaemonOwnershipTransition as applyDaemonOwnershipTransitionOrchestration } from './daemon-ownership-transition.js';

export interface AppHome {
  readonly claudeHome: string;
  readonly seeyaHome: string;
}

/** Mirrors `packages/cli/src/composition.ts#resolveCliHome` exactly — the same two directories,
 * resolved the same way (`os.homedir()` read once, here). */
export function resolveAppHome(homeDir: string = os.homedir()): AppHome {
  return {
    claudeHome: path.join(homeDir, '.claude'),
    seeyaHome: path.join(homeDir, '.seeya'),
  };
}

export interface AppContext {
  readonly clock: Clock;
  readonly home: AppHome;
  /** The raw home directory (`os.homedir()`) — what a tab's cwd defaults to when the person
   * leaves the directory field blank (`electron/main.ts`'s own `createTab` handler). */
  readonly homeDir: string;
  /** The environment a tab's process should spawn with — already cleaned of inherited
   * `CLAUDE*`/`AI_AGENT` session variables (D-017), computed once so every `createTab` call reuses
   * the same base instead of re-deriving it. */
  readonly tabEnv: NodeJS.ProcessEnv;
  readonly defaultShell: ShellCommand;
  buildPtyManager(callbacks: PtyManagerCallbacks): PtyManager;
  /** The same `SessionProvider` `seeya sessions` uses (`cli/composition.ts#buildSessionProvider`,
   * same wiring) — the sidebar's "same list as `seeya sessions`" (docs/PLANO-DE-ENTREGA.md V2-T2). */
  readonly sessionProvider: SessionProvider;
  /** For the status panel's daemon section (`@seeya-ai/engine/scheduler/daemon-state.js`) — same
   * two ports `cli/status-command.ts` needs for the identical purpose. */
  readonly storage: Storage;
  readonly processControl: ProcessControl;
  readonly autostart: Autostart;
  /**
   * V2-T13 (D-045 items 1/2): who owns the daemon/autostart on this machine, resolved ONCE at
   * startup from `AppInstallation.find()` (installation state changes only across an
   * install/uninstall, never mid-session). `'app'` is what gates the autostart control button
   * (`state/autostart-control-panel.ts#resolveAutostartControlAvailability`) and the ownership-
   * transition dialog — everything else in the window (tabs, sidebar, "Start daemon"/"Stop
   * daemon") behaves identically regardless of this value; only those two pieces read it.
   */
  readonly daemonOwner: DaemonOwner;
  /**
   * V2-T13 (D-045 item 4): registers the app's OWN daemon in autostart — the exact same
   * `daemonLaunchTarget` `startDaemon` below spawns (Electron's own binary + `env` carrying
   * `ELECTRON_RUN_AS_NODE=1`), via `Autostart.enable`'s new `AutostartLaunchOptions`. Only ever
   * called when `daemonOwner.kind === 'app'` (the autostart control button/transition dialog are
   * the only two callers, both gated the same way).
   */
  enableAppAutostart(): Promise<AutostartEnableResult>;
  /**
   * V2-T13 (D-045 item 1): true only the very first time this window opens with `daemonOwner.kind
   * === 'app'` AND something CLI-owned (a live daemon or a registered autostart) already exists —
   * `application/daemon-ownership.ts#shouldOfferDaemonOwnershipTransition`'s own docstring has the
   * full rule. `electron/main.ts` calls this once, right after the window is created, and shows
   * the transition dialog only when it resolves `true`.
   */
  checkDaemonOwnershipTransitionOffer(): Promise<boolean>;
  /**
   * V2-T13 (D-045 item 1): applies the person's answer to the transition dialog. `'accepted'`
   * stops the CLI's daemon (`stopDaemon`, tolerant of nothing running), repoints autostart at the
   * app (`enableAppAutostart`) and starts the app's own daemon (`startDaemon`) — in that order, so
   * the OS-level autostart mechanism (one shared registration, D-045's own "reaponta") never has
   * two owners racing to register during the switch. `'declined'` touches nothing. Either way, the
   * answer is persisted (`Storage.saveDaemonOwnershipTransitionAnswer`) so
   * `checkDaemonOwnershipTransitionOffer` never offers again.
   */
  applyDaemonOwnershipTransition(answer: DaemonOwnershipTransitionAnswer): Promise<void>;
  readonly config: Config;
  /** V2-T9 item 1/2 — whether a session's OLD `cwd` (from an earlier day's handoff) still exists,
   * before ever offering it in the "Resume in" selector (`application/cwd-history.ts`). */
  readonly directoryExistence: DirectoryExistence;
  /** V2-T9 item 2 (Q-079's own correction): the same `process.platform` this function already
   * resolves below (`platform`), reshaped into `application/cwd-history.ts#readCwdHistory`'s own
   * `PathPlatformHint` — that module never reads `process.platform` itself. */
  readonly platformHint: PathPlatformHint;
  /**
   * Resolves a harness command name (`claude`, `codex`) the same way the real OS's shell would —
   * `@seeya-ai/engine/adapters/process/resolve-command.js`, with the real `PATH`/`PATHEXT`/
   * filesystem this function itself already closed over (V2-T2 item 4). Never called for the
   * empty-string "system shell" case (`pty/default-shell.ts` handles that one directly — it never
   * needs a `PATH` walk, see that file's own docstring).
   */
  resolveHarnessCommand(command: string, args: readonly string[]): Promise<ResolveCommandResult>;
  /**
   * V2-T5a item 5: every OTHER port `application/end-day.ts#endDay` needs beyond what this
   * context already carries (`sessionProvider`/`storage`/`processControl`/`clock`) — mirrors
   * `packages/cli/src/composition.ts#buildEndDayContext` field for field, wired to the same real
   * adapters, fiação only. `toEndDayDeps` below is what assembles the full `EndDayDeps` from these
   * plus this context's own already-existing fields, the one place that mapping happens.
   */
  readonly transcriptReader: TranscriptReader;
  readonly gitReader: GitReader;
  readonly leanGenerator: HandoffGenerator;
  readonly deepGenerator: HandoffGenerator;
  readonly forkCleanup: ForkCleanup;
  /** V2-T5a item 4: "Run end-day now" notifies through the SAME `Notifier`
   * `cli/composition.ts#buildEndDayContext` wires for `seeya end-day`'s own step 5. */
  readonly notifier: Notifier;
  /**
   * V2-T5b item 3: "Start daemon"/"Stop daemon" in the state region.
   *
   * **`startDaemon` is NOT reused from `cli/daemon-command.ts#runDaemonLauncher`** — `app/` and
   * `cli/` are independent composition roots that never import each other (D-043), and this
   * function calls `adapters/process/daemon-launch.ts#spawnDetachedDaemon` directly (a concrete
   * adapter, not a port method), which only a composition root may do at all. Same SHAPE as the
   * CLI's own (check `scheduler/lock.ts#checkDaemonLock`, refuse or spawn, name the pid), same
   * wording, built against THIS composition root's own `daemonLaunchTarget` below — see Q-076 for
   * the alternative considered (`node` resolved from `PATH`) and why it was rejected.
   *
   * **`stopDaemon` genuinely IS the shared function** — `@seeya-ai/engine/scheduler/
   * daemon-control.js#runDaemonStop`, moved out of `cli/daemon-command.ts` in this same task
   * because it only calls `ProcessControl` port methods, so both composition roots import the
   * exact same implementation and can never disagree about its text.
   */
  startDaemon(): Promise<string>;
  stopDaemon(): Promise<string>;
  /**
   * V2-T8 item 3: which `PATH` `resolveHarnessCommand`/`tabEnv` actually ended up using.
   * `'login-shell'` — read via `$SHELL -lic` and used; `'inherited'` — read attempted (non-Windows)
   * but failed/timed out/found no marker line, so this process's own inherited `process.env.PATH`
   * was kept, exactly as documented in `login-shell-path.ts`; `'not-applicable'` — Windows, where
   * this whole mechanism doesn't apply (see that module's own docstring). Exists so a caller can
   * tell "the read worked" apart from "there was nothing to read" (D-025) — not surfaced in any UI
   * yet (out of this task's scope), but a future status panel has something to read instead of
   * silence.
   */
  readonly loginShellPathSource: 'login-shell' | 'inherited' | 'not-applicable';
}

/**
 * V2-T5a item 5: assembles the `EndDayDeps` `application/end-day.ts#endDay` needs from an
 * `AppContext` — pure fiação (no I/O of its own), pulled out into its own function so
 * `electron/main.ts`'s IPC handlers (excluded from this package's coverage floor) never carry
 * logic worth testing on their own; this mapping does, via `tests/integration/app/composition.test.ts`.
 */
export function toEndDayDeps(context: AppContext): EndDayDeps {
  return {
    sessionProvider: context.sessionProvider,
    transcriptReader: context.transcriptReader,
    gitReader: context.gitReader,
    leanGenerator: context.leanGenerator,
    deepGenerator: context.deepGenerator,
    storage: context.storage,
    processControl: context.processControl,
    clock: context.clock,
    forkCleanup: context.forkCleanup,
  };
}

const requireFromHere = createRequire(import.meta.url);

/** A minimal, hand-checked shape — not a zod schema (AGENTS.md's "dados de fora" rule targets the
 * Claude Code registry/transcript/config/`claude -p` output specifically; `@seeya-ai/cli`'s own
 * `package.json` is this monorepo's own build artifact, read the same way Node's own module
 * resolution already reads every `package.json` on disk, not data arriving from outside the
 * project). Still checked, not cast blindly, so a `@seeya-ai/cli` release that ever drops its
 * `bin.seeya` entry fails with a message naming exactly what's missing (AGENTS.md's error-message
 * rule) instead of `spawn` failing later with an opaque ENOENT. */
function readCliBinRelativePath(cliPackage: unknown, packageJsonPath: string): string {
  const bin =
    typeof cliPackage === 'object' && cliPackage !== null
      ? (cliPackage as { readonly bin?: unknown }).bin
      : undefined;
  const seeya =
    typeof bin === 'object' && bin !== null
      ? (bin as { readonly seeya?: unknown }).seeya
      : undefined;
  if (typeof seeya !== 'string') {
    throw new Error(
      `@seeya-ai/cli's package.json (${packageJsonPath}) has no "bin.seeya" string entry — cannot ` +
        'build the daemon launch target.',
    );
  }
  return seeya;
}

/**
 * V2-T5b item 3: resolves `@seeya-ai/cli`'s own compiled bin entry point (`bin.seeya` in its
 * `package.json`) by walking the package boundary, the same way `require.resolve` finds any
 * package on disk — never a hardcoded relative path across the two packages, so this keeps working
 * if `@seeya-ai/cli`'s own `dist/` layout ever changes. This is the ONE place `packages/app/src`
 * resolves anything from `@seeya-ai/cli` — never its source, never its exports, only this single
 * file path to spawn as a detached child (`app-does-not-import-cli`'s own guard, `.dependency-
 * cruiser.cjs`, is about SOURCE imports; a `require.resolve` string literal to a `package.json` two
 * layers below `packages/cli/` — not `packages/cli/src` — is not one, and was confirmed by running
 * `npm run dependencias` after this change, see the report for this task).
 */
function resolveCliDaemonScriptPath(): string {
  const packageJsonPath = requireFromHere.resolve('@seeya-ai/cli/package.json');
  const cliPackage: unknown = requireFromHere(packageJsonPath);
  const binRelativePath = readCliBinRelativePath(cliPackage, packageJsonPath);
  return path.join(path.dirname(packageJsonPath), binRelativePath);
}

/**
 * Builds everything `electron/main.ts` needs, reading the real `process.env`/`process.platform`
 * exactly once (mirrors `packages/cli/src/composition.ts#buildCliContext`'s own "read once" shape).
 *
 * **Not async, unlike `buildCliContext`.** `cli/composition.ts#buildCliContext` awaits
 * `storage.readConfig()` before building `SessionProvider` (it needs `relevanceHours` first) —
 * this function can't do the same and stay synchronous, so `config` here is read the same way but
 * the whole function returns a `Promise`, awaited once by `electron/main.ts` at startup.
 */
export async function buildAppContext(homeDir: string = os.homedir()): Promise<AppContext> {
  const home = resolveAppHome(homeDir);
  const clock = systemClock;
  const storage = new StorageAdapter(home.seeyaHome);
  const config = await storage.readConfig();
  const sessionProvider = new DiscoverySessionProvider({
    claudeHome: home.claudeHome,
    seeyaHome: home.seeyaHome,
    processControl: realProcessControl,
    clock,
    relevanceHours: config.relevanceHours,
  });
  const platform = process.platform;
  // V2-T9 item 2 (Q-079's own correction): the same `platform` read above, reshaped into
  // `PathPlatformHint` once, here — `application/cwd-history.ts` never reads `process.platform`.
  const platformHint: PathPlatformHint = platform === 'win32' ? 'win32' : 'posix';
  const pathExtEnv = process.env.PATHEXT;
  // V2-T8 item 3: on every platform BUT Windows, prefer the login shell's own PATH over this
  // process's inherited one — see login-shell-path.ts's own docstring for why a graphical launcher
  // needs this and a terminal launch never did. `defaultShellCommand` (below) is what already picks
  // $SHELL/$COMSPEC per platform for a tab's own "system shell" entry; reused here so the shell
  // asked for this PATH is the exact same one a tab would open.
  const shellForLoginPath = defaultShellCommand(platform, process.env);
  const loginShellPath =
    platform === 'win32' ? undefined : await readLoginShellPath(shellForLoginPath.command);
  const loginShellPathSource: AppContext['loginShellPathSource'] =
    platform === 'win32'
      ? 'not-applicable'
      : loginShellPath === undefined
        ? 'inherited'
        : 'login-shell';
  const pathEnv = loginShellPath ?? process.env.PATH;
  const autostart = buildAutostart(homeDir);
  // V2-T5a item 5: same shape as cli/composition.ts#buildEndDayContext's own generatorOptions —
  // both generators are always built, never chosen here; captureSession (application/
  // capture-session.ts) picks between them per session (see EndDayDeps's own docstring on why).
  const generatorOptions = {
    model: config.captureModel,
    budgetPerSessionUsd: config.budgetPerSessionUsd,
  };
  // V2-T8 item 3: a tab's own spawn environment gets the same corrected PATH `resolveHarnessCommand`
  // uses below — `buildResumptionEnv` already strips D-017's session variables; overriding PATH
  // AFTER that call (never before) is what keeps this a pure override of one key, not a second,
  // divergent cleaning pass.
  const tabEnv: NodeJS.ProcessEnv = {
    ...buildResumptionEnv(process.env),
    ...(loginShellPath === undefined ? {} : { PATH: loginShellPath }),
  };
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
  async function startDaemon(): Promise<string> {
    const decision = await checkDaemonLock(storage, realProcessControl);
    if (decision.kind === 'refuse') {
      return `seeya daemon is already running (pid ${decision.heldByPid}). Nothing started.`;
    }
    const pid = await spawnDetachedDaemon(daemonLaunchTarget);
    return (
      `seeya daemon started (pid ${pid}), detached from this window — closing seeya or logging ` +
      'out will not stop it.'
    );
  }
  function stopDaemon(): Promise<string> {
    return runDaemonStop({ storage, processControl: realProcessControl, clock });
  }
  // V2-T13, D-045 item 2: the OS's own installation record, asked once at startup — see
  // AppContext#daemonOwner's own docstring for why this never re-queries mid-session.
  const daemonOwner = resolveDaemonOwner(await buildAppInstallation(platform).find());
  // V2-T13, D-045 item 4: same target as `startDaemon`'s own `spawnDetachedDaemon` call, reused
  // here as the (nodePath, scriptPath, env) trio `Autostart.enable`'s options now accept.
  function enableAppAutostart(): Promise<AutostartEnableResult> {
    // `AutostartLaunchOptions.env` is `Record<string, string>` (every real OS mechanism it feeds —
    // the Windows cmd.exe wrapper, a systemd Environment= line, a plist string value — needs an
    // actual string, never the literal text "undefined"); `NodeJS.ProcessEnv`'s index signature
    // allows `string | undefined`, so this drops any `undefined` entry rather than assuming
    // `daemonLaunchTarget.env` (always fully defined, built above) never has one.
    const env = Object.fromEntries(
      Object.entries(daemonLaunchTarget.env ?? {}).filter(
        (entry): entry is [string, string] => entry[1] !== undefined,
      ),
    );
    return autostart.enable(daemonLaunchTarget.scriptPath, {
      execPath: daemonLaunchTarget.nodePath,
      env,
    });
  }
  // V2-T13, D-045 item 1: pre-gathers the two "something CLI-owned already exists" facts
  // `shouldOfferDaemonOwnershipTransition` needs — a live daemon (whoever started it; the app
  // hasn't started one of its own until this same dialog is accepted) or a registered autostart
  // entry (`enabled`/`brokenPath` both count as "something is registered", D-024's four-state
  // `AutostartStatus` collapsed to the one bit this decision needs).
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
      cliAutostartEnabled:
        autostartStatus.kind === 'enabled' || autostartStatus.kind === 'brokenPath',
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
    clock,
    home,
    homeDir,
    tabEnv,
    defaultShell: shellForLoginPath,
    // V2-T6: the bundled (Windows Terminal) ConPTY, Windows only — see NodePtyAdapterOptions.
    buildPtyManager: (callbacks) =>
      new PtyManager(new NodePtyAdapter({ useConptyDll: platform === 'win32' }), callbacks),
    sessionProvider,
    storage,
    processControl: realProcessControl,
    autostart,
    daemonOwner,
    enableAppAutostart,
    checkDaemonOwnershipTransitionOffer,
    applyDaemonOwnershipTransition,
    config,
    directoryExistence: new FsDirectoryExistence(),
    platformHint,
    resolveHarnessCommand: (command, args) =>
      resolveCommand(command, args, {
        platform,
        pathEnv,
        pathExtEnv,
        fs: realCommandResolutionFs,
      }),
    transcriptReader: new TranscriptFileReader({ claudeHome: home.claudeHome }),
    gitReader: new GitAdapter({ clock }),
    leanGenerator: new LeanHandoffGenerator(generatorOptions),
    deepGenerator: new DeepHandoffGenerator({
      ...generatorOptions,
      seeyaHome: home.seeyaHome,
      clock,
    }),
    forkCleanup: new DiscoveryForkCleanup({
      claudeHome: home.claudeHome,
      seeyaHome: home.seeyaHome,
      clock,
    }),
    notifier: realNotifier,
    startDaemon,
    stopDaemon,
    loginShellPathSource,
  };
}
