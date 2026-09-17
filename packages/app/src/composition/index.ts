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
import { buildAutostart } from '@seeya-ai/engine/adapters/autostart/index.js';
import { TranscriptFileReader } from '@seeya-ai/engine/adapters/transcript/index.js';
import { GitAdapter } from '@seeya-ai/engine/adapters/git/index.js';
import {
  LeanHandoffGenerator,
  DeepHandoffGenerator,
} from '@seeya-ai/engine/adapters/generation/index.js';
import { notifier as realNotifier } from '@seeya-ai/engine/adapters/notification/index.js';
import { checkDaemonLock } from '@seeya-ai/engine/scheduler/index.js';
import { runDaemonStop } from '@seeya-ai/engine/scheduler/daemon-control.js';
import type {
  Autostart,
  Clock,
  ForkCleanup,
  GitReader,
  HandoffGenerator,
  Notifier,
  ProcessControl,
  SessionProvider,
  Storage,
  TranscriptReader,
} from '@seeya-ai/engine/core/ports.js';
import type { Config } from '@seeya-ai/engine/core/types.js';
import type { EndDayDeps } from '@seeya-ai/engine/application/types.js';
import { NodePtyAdapter } from '../pty/node-pty-adapter.js';
import { PtyManager, type PtyManagerCallbacks } from '../pty/pty-manager.js';
import { defaultShellCommand, type ShellCommand } from '../pty/default-shell.js';

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
  readonly config: Config;
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
  const pathEnv = process.env.PATH;
  const pathExtEnv = process.env.PATHEXT;
  // V2-T5a item 5: same shape as cli/composition.ts#buildEndDayContext's own generatorOptions —
  // both generators are always built, never chosen here; captureSession (application/
  // capture-session.ts) picks between them per session (see EndDayDeps's own docstring on why).
  const generatorOptions = {
    model: config.captureModel,
    budgetPerSessionUsd: config.budgetPerSessionUsd,
  };
  const tabEnv = buildResumptionEnv(process.env);
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
  return {
    clock,
    home,
    homeDir,
    tabEnv,
    defaultShell: defaultShellCommand(platform, process.env),
    // V2-T6: the bundled (Windows Terminal) ConPTY, Windows only — see NodePtyAdapterOptions.
    buildPtyManager: (callbacks) =>
      new PtyManager(new NodePtyAdapter({ useConptyDll: platform === 'win32' }), callbacks),
    sessionProvider,
    storage,
    processControl: realProcessControl,
    autostart: buildAutostart(homeDir),
    config,
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
  };
}
