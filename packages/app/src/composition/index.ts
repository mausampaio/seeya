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
import { systemClock } from '@seeya-ai/engine/adapters/clock/index.js';
import { buildResumptionEnv } from '@seeya-ai/engine/adapters/resumption/env.js';
import { processControl as realProcessControl } from '@seeya-ai/engine/adapters/process/index.js';
import {
  resolveCommand,
  realCommandResolutionFs,
  type ResolveCommandResult,
} from '@seeya-ai/engine/adapters/process/resolve-command.js';
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
  return {
    clock,
    home,
    homeDir,
    tabEnv: buildResumptionEnv(process.env),
    defaultShell: defaultShellCommand(platform, process.env),
    buildPtyManager: (callbacks) => new PtyManager(new NodePtyAdapter(), callbacks),
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
  };
}
