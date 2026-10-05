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
import { systemClock } from '@seeya-ai/engine/adapters/clock/index.js';
import { buildResumptionEnv } from '@seeya-ai/engine/adapters/resumption/env.js';
import { processControl as realProcessControl } from '@seeya-ai/engine/adapters/process/index.js';
import {
  resolveCommand,
  realCommandResolutionFs,
} from '@seeya-ai/engine/adapters/process/resolve-command.js';
import {
  DiscoverySessionProvider,
  DiscoveryForkCleanup,
  DiscoverySessionIdLookup,
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
import { FsWorkspaceRepository } from '@seeya-ai/engine/adapters/workspace/index.js';
import { FsProjectLock } from '@seeya-ai/engine/adapters/workspace/project-lock.js';
import { GenerationForkRegistration } from '@seeya-ai/engine/adapters/generation/fork-registration.js';
import { captureObservedProcStart } from '@seeya-ai/engine/adapters/process/proc-start.js';
import { processExists } from '@seeya-ai/engine/adapters/process/existence.js';
import type { PathPlatformHint } from '@seeya-ai/engine/core/cwd-normalization.js';
import { NodePtyAdapter } from '../pty/node-pty-adapter.js';
import { PtyManager } from '../pty/pty-manager.js';
import { defaultShellCommand } from '../pty/default-shell.js';
import { resolveTerminalFontOptions } from '../state/terminal-font.js';
import { readLoginShellPath } from './read-login-shell-path.js';
import { buildDaemonWiring } from './daemon-wiring.js';

import { type AppContext, resolveAppHome } from './app-context.js';
import type { BuildAppContextOverrides } from './app-context-overrides.js';

export { resolveAppHome } from './app-context.js';
export type { AppContext, AppHome } from './app-context.js';
export type { BuildAppContextOverrides } from './app-context-overrides.js';
export type { AppProcessIdentity } from './deps-builders.js';
export {
  toEndDayDeps,
  buildProjectWorkspaceDeps,
  buildProjectOpenDeps,
  buildProjectAdoptDeps,
  buildAddRepositoryDeps,
  buildRemoveRepositoryDeps,
  buildArchiveProjectDeps,
  buildRemoveProjectDeps,
  buildRevertAdoptionDeps,
} from './deps-builders.js';

/**
 * Builds everything `electron/main.ts` needs, reading the real `process.env`/`process.platform`
 * exactly once (mirrors `packages/cli/src/composition.ts#buildCliContext`'s own "read once" shape).
 *
 * **Not async, unlike `buildCliContext`.** `cli/composition.ts#buildCliContext` awaits
 * `storage.readConfig()` before building `SessionProvider` (it needs `relevanceHours` first) —
 * this function can't do the same and stay synchronous, so `config` here is read the same way but
 * the whole function returns a `Promise`, awaited once by `electron/main.ts` at startup.
 */
export async function buildAppContext(
  homeDir: string = os.homedir(),
  overrides: BuildAppContextOverrides = {},
): Promise<AppContext> {
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
  const sessionIdLookup = new DiscoverySessionIdLookup({
    claudeHome: home.claudeHome,
    seeyaHome: home.seeyaHome,
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
  const autostart = overrides.autostart ?? buildAutostart(homeDir, home.seeyaHome);
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
  // V2-T13, D-045 item 2: the OS's own installation record, asked once at startup — see
  // AppContext#daemonOwner's own docstring for why this never re-queries mid-session. V2-T46:
  // `overrides.appInstallation`, when given, replaces the real per-platform query — see
  // `BuildAppContextOverrides`'s own docstring.
  const appInstallation = overrides.appInstallation ?? buildAppInstallation(platform);
  const {
    daemonOwner,
    startDaemon,
    stopDaemon,
    enableAppAutostart,
    checkDaemonOwnershipTransitionOffer,
    applyDaemonOwnershipTransition,
  } = await buildDaemonWiring({
    storage,
    clock,
    platformHint,
    tabEnv,
    autostart,
    appInstallation,
  });
  // V2-T30: `AppContext#resolveProcessIdentity`'s own docstring has the "why lazy" reasoning —
  // computed at most once per window, only the first time Open/Adopt actually needs it.
  let cachedProcessIdentity: { pid: number; procStart: string | undefined } | null = null;
  async function resolveProcessIdentity(): Promise<{
    readonly pid: number;
    readonly procStart: string | undefined;
  }> {
    if (cachedProcessIdentity !== null) {
      return cachedProcessIdentity;
    }
    const procStartCapture = await captureObservedProcStart(process.pid, processExists);
    cachedProcessIdentity = {
      pid: process.pid,
      procStart: procStartCapture.kind === 'value' ? procStartCapture.value : undefined,
    };
    return cachedProcessIdentity;
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
    sessionIdLookup,
    storage,
    processControl: realProcessControl,
    autostart,
    daemonOwner,
    enableAppAutostart,
    checkDaemonOwnershipTransitionOffer,
    applyDaemonOwnershipTransition,
    // V2-T16 item 2: the ONE snapshot of `config` this context still exposes — see
    // `AppContext#initialTerminalFontOptions`'s own docstring for why this one field is exempt
    // from "read fresh every time".
    initialTerminalFontOptions: resolveTerminalFontOptions(config),
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
    leanGenerator: overrides.leanGenerator ?? new LeanHandoffGenerator(generatorOptions),
    deepGenerator:
      overrides.deepGenerator ??
      new DeepHandoffGenerator({
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
    workspace: overrides.workspace ?? new FsWorkspaceRepository(),
    projectLock: new FsProjectLock(),
    forkRegistration: new GenerationForkRegistration(home.seeyaHome),
    adoptionLauncherOverride: overrides.adoptionLauncher,
    harnessLauncherOverride: overrides.harnessLauncher,
    sessionId: process.env.CLAUDE_CODE_SESSION_ID,
    resolveProcessIdentity,
  };
}
