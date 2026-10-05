/**
 * `AppContext` and the app home (V2-T51: split out of `composition/index.ts`, which still re-exports
 * them — `index.ts` is the composition root, `buildAppContext` is its job).
 */
import os from 'node:os';
import path from 'node:path';
import { type ResolveCommandResult } from '@seeya-ai/engine/adapters/process/resolve-command.js';
import type {
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
  SessionIdLookup,
  SessionProvider,
  Storage,
  TranscriptReader,
  WorkspaceRepository,
} from '@seeya-ai/engine/core/ports.js';
import type { DaemonOwner, DaemonOwnershipTransitionAnswer } from '@seeya-ai/engine/core/types.js';
import type { PathPlatformHint } from '@seeya-ai/engine/core/cwd-normalization.js';
import { PtyManager, type PtyManagerCallbacks } from '../pty/pty-manager.js';
import { type ShellCommand } from '../pty/default-shell.js';
import { type TerminalFontOptions } from '../state/terminal-font.js';

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
  /** V2-T55 item 1/4: the direct, `relevanceHours`-ignoring lookup — the window's own id-search
   * field (`electron/session-search-ipc.ts`) and, mirroring the CLI, the "Adopt…" fallback when a
   * click refers to a session that aged out of `sessionProvider`'s own windowed list between two
   * refresh ticks (`electron/project-ipc.ts`'s own `adoptSession` handler). Never wired into the
   * ambient 10s refresh cycle — see `core/ports.ts#SessionIdLookup`'s own docstring for why. */
  readonly sessionIdLookup: SessionIdLookup;
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
   * V2-T70: verification-only, same spirit as `leanGenerator`/`deepGenerator` above — lets a
   * screenshot script exercise the real "Adopt…" flow (`renderer/features/adoption/`) through the
   * real `adoptSession()` pipeline without ever spawning a real `claude` session.
   * `main/main.ts`'s own `SEEYA_APP_VERIFY_ADOPTION_FAKE` is the ONE real caller — see
   * `composition/verification-fake-adoption-launcher.ts`'s own docstring for the fake
   * implementation. Every real window leaves this `undefined` and `main/project-ipc.ts` builds
   * the real `ProjectAdoptTabLauncher`, exactly as before this task.
   */
  readonly adoptionLauncherOverride: SessionAdoptionLauncher | undefined;
  /**
   * V2-T82: verification-only, same spirit as `adoptionLauncherOverride` — lets a screenshot script
   * click the adoption result's real **Open project** button without ever spawning `claude`.
   * `main/main.ts`'s own `SEEYA_APP_VERIFY_FAKE_HARNESS_LOG` is the ONE real caller.
   */
  readonly harnessLauncherOverride: HarnessLauncher | undefined;
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
