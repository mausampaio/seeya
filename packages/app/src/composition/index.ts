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
import { buildAutostartEnv } from '@seeya-ai/engine/adapters/autostart/env.js';
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
import { FsWorkspaceRepository } from '@seeya-ai/engine/adapters/workspace/index.js';
import {
  FsProjectLock,
  PROJECT_LOCK_FILE_NAME,
} from '@seeya-ai/engine/adapters/workspace/project-lock.js';
import { FsProjectAuditMarker } from '@seeya-ai/engine/adapters/workspace/project-audit-marker.js';
import { GenerationForkRegistration } from '@seeya-ai/engine/adapters/generation/fork-registration.js';
import { captureObservedProcStart } from '@seeya-ai/engine/adapters/process/proc-start.js';
import { processExists } from '@seeya-ai/engine/adapters/process/existence.js';
import type {
  AppInstallation,
  Autostart,
  AutostartEnableResult,
  Clock,
  DirectoryExistence,
  ForkCleanup,
  ForkRegistration,
  GitReader,
  HandoffGenerator,
  HarnessLauncher,
  Notifier,
  ProcessControl,
  ProjectLock,
  SessionAdoptionLauncher,
  SessionProvider,
  Storage,
  TranscriptReader,
  WorkspaceRepository,
} from '@seeya-ai/engine/core/ports.js';
import type { ProjectOpenDeps } from '@seeya-ai/engine/application/project-open.js';
import type { AdoptSessionDeps } from '@seeya-ai/engine/application/project-adopt.js';
import type { WorkspaceCommandDeps } from '@seeya-ai/engine/application/workspace.js';
import type { DaemonOwner, DaemonOwnershipTransitionAnswer } from '@seeya-ai/engine/core/types.js';
import type { PathPlatformHint } from '@seeya-ai/engine/core/cwd-normalization.js';
import type { EndDayDeps } from '@seeya-ai/engine/application/types.js';
import { NodePtyAdapter } from '../pty/node-pty-adapter.js';
import { PtyManager, type PtyManagerCallbacks } from '../pty/pty-manager.js';
import { defaultShellCommand, type ShellCommand } from '../pty/default-shell.js';
import { resolveTerminalFontOptions, type TerminalFontOptions } from '../state/terminal-font.js';
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
  /**
   * V2-T16 item 2: the ONE config-derived value this context still hands out — everything else
   * that used to live on a general-purpose `AppContext.config` field (read once, here, at window
   * startup) was removed; every other reader now calls `context.storage.readConfig()` itself, at
   * the moment it actually needs the value (`electron/main.ts`'s own IPC handlers,
   * `state/schedule-actions.ts`). This field alone is exempt, by name and by design: the
   * renderer's very first `new Terminal({...})` (`electron/main.ts`'s own
   * `CHANNELS.getTerminalFontConfig` handler) needs SOME font before it exists, and once that
   * terminal exists its font is never live-updated (docs/PLANO-DE-ENTREGA.md V2-T16's own "o que
   * não entra": "mudar a fonte do terminal já aplicada numa aba aberta") — so, unlike every value
   * this task removed, there is no live counterpart this one could ever fall back to being stale
   * against. A field whose own name says "read once, at startup, for one purpose" is exactly
   * D-024's "o tipo torna o estado inválido irrepresentável": nothing here reads like a general
   * config a caller could reach for by mistake.
   */
  readonly initialTerminalFontOptions: TerminalFontOptions;
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
  /**
   * V2-T30: the same `WorkspaceRepository`/`ProjectLock`/`ForkRegistration` ports
   * `packages/cli/src/composition.ts#buildProjectContext`/`buildProjectAdoptContext` wire, so
   * `seeya project create`/`list`/`open`/`adopt`'s own `application/` orchestration runs
   * identically from the window (`electron/project-ipc.ts`, `app/`'s own composition, D-043: never
   * reused from `cli/`'s functions directly).
   */
  readonly workspace: WorkspaceRepository;
  readonly projectLock: ProjectLock;
  readonly forkRegistration: ForkRegistration;
  /**
   * `process.env.CLAUDE_CODE_SESSION_ID`, read once here (D-020) — same source
   * `cli/composition.ts#readCurrentSessionId` reads, for the identical reason: a project's commit
   * trailer (`core/project-commit.ts`) names whichever session ran `create`/`add-repo`/`adopt`.
   * Almost always `undefined` for the app (a desktop window is not usually launched from inside a
   * Claude Code session) — D-025 never guesses otherwise.
   */
  readonly sessionId: string | undefined;
  /**
   * This process's own `pid`/`procStart` (Q-087 item 3: "o pid gravado no lock é o do processo
   * principal do app" — the app's own equivalent of the CLI process that blocks for the whole of
   * `seeya project open`/`adopt`, since a project's lock here is held for as long as the APP
   * lives, not for as long as one tab does). **Resolved lazily, once, and cached** — never eagerly
   * at startup: `captureObservedProcStart`'s own `powershell.exe` cost on Windows (500-880ms even
   * warm, `packages/cli/src/composition.ts`'s own measurement) would otherwise land on every
   * window launch's "time until the session list appears" budget
   * (`docs/DESEMPENHO.md`'s measure (a)) even for a person who never opens or adopts a project this
   * run.
   */
  resolveProcessIdentity(): Promise<{
    readonly pid: number;
    readonly procStart: string | undefined;
  }>;
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
 * V2-T30: `seeya project create`/`list`/`show`'s own `WorkspaceCommandDeps`, assembled from an
 * `AppContext` — mirrors `packages/cli/src/composition.ts#buildProjectContext`'s own shape, pure
 * fiação (no I/O of its own), so `electron/project-ipc.ts` (excluded from this package's coverage
 * floor) never carries a mapping worth testing on its own; this one does, via
 * `tests/integration/app/composition.test.ts`.
 */
export function buildProjectWorkspaceDeps(context: AppContext): WorkspaceCommandDeps {
  return {
    storage: context.storage,
    workspace: context.workspace,
    projectLock: context.projectLock,
    processControl: context.processControl,
    seeyaHome: context.home.seeyaHome,
    sessionId: context.sessionId,
    ...projectHookIdentity(),
  };
}

/**
 * V2-T34 item 1: the interface's own `nodePath`/`cliEntryPath`/`hookEnv` for the workspace's
 * `commit-msg` hook — `resolveCliDaemonScriptPath()` already resolves `@seeya-ai/cli`'s own compiled
 * entry point for the daemon launch target above (`daemonLaunchTarget.scriptPath`); the SAME file
 * also dispatches `project verify-commit` (it's the whole `seeya` CLI, not a daemon-only script), so
 * reusing it here is calling back into a working `seeya`, not a second resolution mechanism. Runs
 * under `process.execPath` — Electron's own binary — so `ELECTRON_RUN_AS_NODE=1` has to travel with
 * it (`core/workspace-hooks.ts#buildCommitMsgHookScript`'s own docstring on why), the identical
 * pairing `daemonLaunchTarget.env` already carries for the same reason.
 */
function projectHookIdentity(): {
  readonly nodePath: string;
  readonly cliEntryPath: string;
  readonly hookEnv: Readonly<Record<string, string>>;
} {
  return {
    nodePath: process.execPath,
    cliEntryPath: resolveCliDaemonScriptPath(),
    hookEnv: { ELECTRON_RUN_AS_NODE: '1' },
  };
}

/** This invocation's own `pid`/`procStart` — see `AppContext#resolveProcessIdentity`'s own
 * docstring for why it's a separate, lazily-resolved value rather than a plain field here. */
export interface AppProcessIdentity {
  readonly pid: number;
  readonly procStart: string | undefined;
}

/**
 * `seeya project open`'s own `ProjectOpenDeps` (V2-T30 item 3), assembled from an `AppContext` plus
 * this invocation's own `processIdentity` (`AppContext#resolveProcessIdentity`, Q-087 item 3: the
 * app's own main process, not a per-open capture) and a fresh `HarnessLauncher`
 * (`resume/project-tab-launcher.ts#ProjectOpenTabLauncher`, constructed by the caller with this
 * open's own tab label — never reused from `cli/`'s `ClaudeHarnessLauncher`, D-043).
 * `launchedSessionId` is generated by the caller (`electron/project-ipc.ts`, `node:crypto
 * #randomUUID` — randomness stays out of `core/`/`application/`, same V2-T35 item 4 reasoning the
 * CLI's own `buildProjectOpenDeps` already follows).
 */
export function buildProjectOpenDeps(
  context: AppContext,
  processIdentity: AppProcessIdentity,
  harnessLauncher: HarnessLauncher,
  launchedSessionId: string,
): ProjectOpenDeps {
  return {
    storage: context.storage,
    workspace: context.workspace,
    directoryExistence: context.directoryExistence,
    harnessLauncher,
    projectLock: context.projectLock,
    processControl: context.processControl,
    clock: context.clock,
    seeyaHome: context.home.seeyaHome,
    sessionId: context.sessionId,
    pid: processIdentity.pid,
    procStart: processIdentity.procStart,
    launchedSessionId,
    ...projectHookIdentity(),
    auditMarker: new FsProjectAuditMarker(),
    lockFileName: PROJECT_LOCK_FILE_NAME,
  };
}

/**
 * `seeya project adopt`'s own `AdoptSessionDeps` (V2-T30 item 5) — same shape as
 * `buildProjectOpenDeps` above, for `application/project-adopt.ts#adoptSession` instead.
 * `idleMinutes` is read fresh by the caller (`context.storage.readConfig()`, same "never a startup
 * snapshot" discipline `electron/main.ts`'s own settings-aware handlers already follow) rather than
 * cached on `AppContext` itself.
 */
export function buildProjectAdoptDeps(
  context: AppContext,
  processIdentity: AppProcessIdentity,
  adoptionLauncher: SessionAdoptionLauncher,
  forkSessionId: string,
  idleMinutes: number,
): AdoptSessionDeps {
  return {
    storage: context.storage,
    workspace: context.workspace,
    projectLock: context.projectLock,
    processControl: context.processControl,
    clock: context.clock,
    forkRegistration: context.forkRegistration,
    forkCleanup: context.forkCleanup,
    adoptionLauncher,
    seeyaHome: context.home.seeyaHome,
    idleMinutes,
    sessionId: context.sessionId,
    pid: processIdentity.pid,
    procStart: processIdentity.procStart,
    forkSessionId,
    ...projectHookIdentity(),
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
 * V2-T46: the two ports `buildAppContext` otherwise builds from the real, per-platform OS
 * mechanism — a Windows registry query (`AppInstallation`) and a Task Scheduler query
 * (`Autostart`), each one a fresh `powershell.exe` spawn. Measured on the machine this task
 * shipped from: the registry query costs ~400ms once "warm" but ~3s on
 * the very first `powershell.exe` spawn of a test run; the Task Scheduler query costs ~1.3-4s on
 * EVERY call, because the `ScheduledTasks` PowerShell module has to reload inside a fresh
 * `powershell.exe` process each time — there is no warm state to fall back on the way the
 * registry query has. Every real caller (`electron/main.ts`) omits both fields and gets the exact
 * same real adapters this function has always built; `tests/integration/app/composition.test.ts`
 * is the only caller that passes either, so its own assertions never depend on — or pay the cost
 * of — whatever this machine's real installation/autostart state happens to be, except in the one
 * test whose whole purpose is proving that real wiring.
 */
export interface BuildAppContextOverrides {
  readonly appInstallation?: AppInstallation;
  readonly autostart?: Autostart;
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
  // AppContext#daemonOwner's own docstring for why this never re-queries mid-session. V2-T46:
  // `overrides.appInstallation`, when given, replaces the real per-platform query — see
  // `BuildAppContextOverrides`'s own docstring.
  const appInstallation = overrides.appInstallation ?? buildAppInstallation(platform);
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
    workspace: new FsWorkspaceRepository(),
    projectLock: new FsProjectLock(),
    forkRegistration: new GenerationForkRegistration(home.seeyaHome),
    sessionId: process.env.CLAUDE_CODE_SESSION_ID,
    resolveProcessIdentity,
  };
}
