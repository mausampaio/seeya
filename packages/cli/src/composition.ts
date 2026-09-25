/**
 * The project's single composition root (D-020): the only module allowed to name a concrete
 * adapter and wire it behind a `core/ports.ts` interface. `index.ts` calls `buildCliContext` once
 * per invocation with the real home directory; every test that needs these ports builds them by
 * hand against a `tmpdir` instead of importing this file, the same way `docs/TESTES.md` already
 * asks integration tests to do for each adapter on its own.
 */
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type {
  Autostart,
  Clock,
  DirectoryExistence,
  ForkCleanup,
  ForkRegistration,
  GitReader,
  HarnessLauncher,
  Notifier,
  ProcessControl,
  ProjectAuditMarker,
  ProjectLock,
  SessionAdoptionLauncher,
  SessionProvider,
  SessionResumer,
  Storage,
  WorkspaceRepository,
} from '@seeya-ai/engine/core/ports.js';
import type { Config, DaemonOwner } from '@seeya-ai/engine/core/types.js';
import type { PathPlatformHint } from '@seeya-ai/engine/core/cwd-normalization.js';
import { processControl as realProcessControl } from '@seeya-ai/engine/adapters/process/index.js';
import { captureObservedProcStart } from '@seeya-ai/engine/adapters/process/proc-start.js';
import { processExists } from '@seeya-ai/engine/adapters/process/existence.js';
import { systemClock } from '@seeya-ai/engine/adapters/clock/index.js';
import { StorageAdapter } from '@seeya-ai/engine/adapters/storage/index.js';
import { FsDirectoryExistence } from '@seeya-ai/engine/adapters/filesystem/index.js';
import { buildAutostart } from '@seeya-ai/engine/adapters/autostart/index.js';
import {
  FsWorkspaceRepository,
  FsProjectLock,
  FsProjectAuditMarker,
  FsCommitMessageFile,
} from '@seeya-ai/engine/adapters/workspace/index.js';
import { PROJECT_LOCK_FILE_NAME } from '@seeya-ai/engine/adapters/workspace/project-lock.js';
import { buildAppInstallation } from '@seeya-ai/engine/adapters/installation/index.js';
import { resolveDaemonOwner } from '@seeya-ai/engine/application/daemon-ownership.js';
import {
  DiscoverySessionProvider,
  DiscoveryForkCleanup,
  discoverEarlyWarnings,
} from '@seeya-ai/engine/adapters/discovery/index.js';
import { TranscriptFileReader } from '@seeya-ai/engine/adapters/transcript/index.js';
import { GitAdapter } from '@seeya-ai/engine/adapters/git/index.js';
import {
  LeanHandoffGenerator,
  DeepHandoffGenerator,
} from '@seeya-ai/engine/adapters/generation/index.js';
import { GenerationForkRegistration } from '@seeya-ai/engine/adapters/generation/fork-registration.js';
import { ClaudeSessionResumer } from '@seeya-ai/engine/adapters/resumption/index.js';
import { ClaudeHarnessLauncher } from '@seeya-ai/engine/adapters/harness/index.js';
import { ClaudeSessionAdoptionLauncher } from '@seeya-ai/engine/adapters/harness/session-adoption.js';
import {
  notifier as realNotifier,
  buildNotifier,
} from '@seeya-ai/engine/adapters/notification/index.js';
import type { EndDayDeps } from '@seeya-ai/engine/application/types.js';
import type { ProjectOpenDeps } from '@seeya-ai/engine/application/project-open.js';
import type { VerifyCommitDeps } from '@seeya-ai/engine/application/verify-commit.js';
import type { ProjectAuditDeps } from '@seeya-ai/engine/application/project-audit.js';
import type { AdoptSessionDeps } from '@seeya-ai/engine/application/project-adopt.js';
import type { RemoveProjectDeps } from '@seeya-ai/engine/application/project-remove.js';
import type { RemoveRepositoryDeps } from '@seeya-ai/engine/application/project-remove-repo.js';
import type { RevertAdoptionDeps } from '@seeya-ai/engine/application/project-revert-adoption.js';
import type { DaemonDeps } from '@seeya-ai/engine/scheduler/index.js';

/** D-047: the same `CLAUDE_CODE_SESSION_ID` D-017's own table already strips from a SPAWNED
 * `claude`'s environment (`adapters/generation/env.ts#INHERITED_SESSION_VARS`) — here it's read,
 * not stripped, because `seeya`'s OWN invocation (never a child it spawns) is what needs to know
 * which session it's running under, for the project lock and the two commit trailers
 * (`core/project-lock.ts`/`core/project-commit.ts`). `undefined` outside a Claude Code session
 * (D-025) — read only here, in the composition root, never inside `application/`. */
function readCurrentSessionId(): string | undefined {
  return process.env['CLAUDE_CODE_SESSION_ID'];
}

/** V2-T34 item 1: the absolute path this invocation's own CLI entry point was launched from —
 * `process.argv[1]` is that path for any Node process, whether launched by `node dist/index.js ...`
 * or through the `seeya` shebang symlink `npm link` installs (Node resolves either the same way
 * before setting `argv[1]`). Falls back to this MODULE's own compiled path
 * (`fileURLToPath(import.meta.url)`, `composition.js` next to `index.js` in the same flat `dist/`
 * — `packages/cli/tsconfig.build.json`'s own `rootDir`) only in the practically-unreachable case
 * `argv[1]` is somehow absent; either path resolves inside the same `dist/` this invocation was
 * built from, so the workspace's own `commit-msg` hook (`node "<this>" project verify-commit ...`)
 * calls back into a working `seeya`. */
function resolveCliEntryPath(): string {
  return process.argv[1] ?? fileURLToPath(import.meta.url);
}

export interface CliHome {
  readonly claudeHome: string;
  readonly seeyaHome: string;
}

export interface CliContext {
  readonly sessionProvider: SessionProvider;
  readonly config: Config;
  readonly clock: Clock;
  /**
   * S4-T13: `seeya status` needs `Storage`/`ProcessControl` to render the daemon section through
   * `cli/daemon-state.ts#describeDaemonState` — the same function `seeya daemon --status` calls
   * (`cli/composition.ts`'s own docstring on `buildDaemonContext` already sets this precedent:
   * every port a command needs is built here, once, by the one composition root, D-020).
   * `seeya sessions` (the other consumer of `CliContext`) simply never reads either field.
   */
  readonly storage: Storage;
  readonly processControl: ProcessControl;
  /** S5-T1: `seeya status` needs `Autostart` to render the autostart line through
   * `cli/autostart-state.ts#describeAutostartState` — the same function `seeya autostart status`
   * calls. `seeya sessions` (the other consumer of `CliContext`) never reads this field. */
  readonly autostart: Autostart;
}

/**
 * `os.homedir()` resolved once, here — the one place in the project allowed to call it at all
 * (every adapter takes its root injected instead, AGENTS.md § "Sistema de arquivos"). Node's
 * `homedir()` reads `HOME` (POSIX) / `USERPROFILE` (Windows) first, which is exactly the hook
 * docs/TESTES.md's e2e harness relies on to point a real compiled build at a `tmpdir` instead of
 * the operator's real home — nothing here needs its own test-only override.
 */
export function resolveCliHome(homeDir: string = os.homedir()): CliHome {
  return {
    claudeHome: path.join(homeDir, '.claude'),
    seeyaHome: path.join(homeDir, '.seeya'),
  };
}

function buildSessionProvider(
  home: CliHome,
  clock: Clock,
  processControl: ProcessControl,
  relevanceHours: number,
): SessionProvider {
  return new DiscoverySessionProvider({
    claudeHome: home.claudeHome,
    seeyaHome: home.seeyaHome,
    processControl,
    clock,
    relevanceHours,
  });
}

function buildStorage(home: CliHome): Storage {
  return new StorageAdapter(home.seeyaHome);
}

/**
 * Builds every port a `sessions`/`status` command needs, reading `config.json` exactly once
 * (`relevanceHours` has to be known before the `SessionProvider` can be constructed — the config
 * read isn't optional plumbing, it's an input the provider needs). `homeDir` defaults to the real
 * `os.homedir()`; tests pass a `tmpdir` fixture instead, same convention as `resolveCliHome`.
 *
 * **`storage`/`processControl` (S4-T13)** are here for `status-command.ts`'s own call to
 * `cli/daemon-state.ts#describeDaemonState`, which re-reads `config.json`/`estado.json`/
 * `daemon.lock` itself — the one extra read this costs over `sessions` (which never touches
 * either field) is a plain file read, not the expensive part (`describeDaemonState`'s own
 * `ProcessControl.isAlive` liveness check, which still only runs once per `seeya status`).
 */
export async function buildCliContext(homeDir: string = os.homedir()): Promise<CliContext> {
  const home = resolveCliHome(homeDir);
  const clock = systemClock;
  const storage = buildStorage(home);
  const config = await storage.readConfig();
  const sessionProvider = buildSessionProvider(
    home,
    clock,
    realProcessControl,
    config.relevanceHours,
  );
  return {
    sessionProvider,
    config,
    clock,
    storage,
    processControl: realProcessControl,
    autostart: buildAutostart(homeDir, home.seeyaHome),
  };
}

export interface EndDayContext {
  readonly deps: EndDayDeps;
  readonly config: Config;
  /**
   * S4-T1: `cli/end-day-command.ts`'s own step 5 (docs/ESPECIFICACAO.md § `seeya end-day`,
   * "Notifica o resultado"). Not part of `EndDayDeps` — `application/end-day.ts`'s own docstring
   * earmarks notifying as happening OUTSIDE `endDay` itself, in whichever caller runs after it.
   */
  readonly notifier: Notifier;
}

/**
 * `seeya end-day`'s own composition (S2-T5, `notifier` added in S4-T1): every port
 * `application/endDay` orchestrates, wired to its real adapter, plus the `Notifier` its own
 * caller (`end-day-command.ts`) uses for step 5. Two pieces this task is the one to switch on,
 * both built and ready since earlier sprints (S2-T2's generators, S2-T6's `ForkCleanup`) but never
 * named by `cli/` until now — D-020 means nothing outside this file was allowed to instantiate
 * them first.
 *
 * `leanGenerator`/`deepGenerator` are both always built, never chosen here: `captureSession`
 * (`application/capture-session.ts`) picks between them per session, since that decision needs
 * `session.hasTranscript`, only known at capture time (see `EndDayDeps`'s own docstring).
 */
export async function buildEndDayContext(homeDir: string = os.homedir()): Promise<EndDayContext> {
  const home = resolveCliHome(homeDir);
  const clock = systemClock;
  const storage = buildStorage(home);
  const config = await storage.readConfig();
  const sessionProvider = buildSessionProvider(
    home,
    clock,
    realProcessControl,
    config.relevanceHours,
  );
  const generatorOptions = {
    model: config.captureModel,
    budgetPerSessionUsd: config.budgetPerSessionUsd,
  };
  const deps: EndDayDeps = {
    sessionProvider,
    transcriptReader: new TranscriptFileReader({ claudeHome: home.claudeHome }),
    gitReader: new GitAdapter({ clock }),
    leanGenerator: new LeanHandoffGenerator(generatorOptions),
    deepGenerator: new DeepHandoffGenerator({
      ...generatorOptions,
      seeyaHome: home.seeyaHome,
      clock,
    }),
    storage,
    processControl: realProcessControl,
    clock,
    forkCleanup: new DiscoveryForkCleanup({
      claudeHome: home.claudeHome,
      seeyaHome: home.seeyaHome,
      clock,
    }),
  };
  return { deps, config, notifier: realNotifier };
}

export interface StartDayContext {
  readonly storage: Storage;
  readonly clock: Clock;
  readonly sessionResumer: SessionResumer;
  /**
   * D-035: `findPendingBriefing`'s own scan ceiling (`Config.maxBriefingScanDays`) now lives in
   * config, so this command has to read `config.json` after all — see this function's own
   * docstring for what changed and why.
   */
  readonly config: Config;
  /** V2-T9 item 3: the cwd-history note `start-day-command.ts` prints alongside the plan. */
  readonly directoryExistence: DirectoryExistence;
  /** V2-T9 item 3 (Q-079's own correction): `process.platform`, resolved once here — the only
   * place in this file allowed to read it (D-020) — and handed to
   * `application/cwd-history.ts#readCwdHistory`, which never reads it itself. */
  readonly platformHint: PathPlatformHint;
}

/**
 * `seeya start-day`'s own composition (S3-T3): the two ports its five steps need
 * (docs/ESPECIFICACAO.md § `seeya start-day`) — `Storage` for the briefing and the per-session
 * resumed bookkeeping (step 5), `SessionResumer` for steps 4-5's actual resume. No
 * `SessionProvider`/git/generation here: unlike `end-day`, this command never re-discovers
 * sessions from `~/.claude/` — it works entirely from what `end-day` already persisted (D-004).
 *
 * **Reads `config.json` since D-035/S4-T3d, unlike before.** This command used to skip the read
 * entirely (it needed no config field at all); now `application/find-pending-briefing.ts
 * #findPendingBriefing`'s own scan ceiling is `Config.maxBriefingScanDays`, so `start-day-command.ts`
 * needs a real `Config` to pass it through.
 */
export async function buildStartDayContext(
  homeDir: string = os.homedir(),
): Promise<StartDayContext> {
  const home = resolveCliHome(homeDir);
  const clock = systemClock;
  const storage = buildStorage(home);
  const config = await storage.readConfig();
  const sessionResumer = new ClaudeSessionResumer({ seeyaHome: home.seeyaHome });
  const platformHint: PathPlatformHint = process.platform === 'win32' ? 'win32' : 'posix';
  return {
    storage,
    clock,
    sessionResumer,
    config,
    directoryExistence: new FsDirectoryExistence(),
    platformHint,
  };
}

export interface SnoozeContext {
  readonly storage: Storage;
  readonly clock: Clock;
  /** Read once, at invocation time — `seeya snooze`/`skip-today` is a one-shot CLI process, so
   * there is no "later" for this value to go stale against, unlike the daemon's long-running poll
   * loop (`buildDaemonContext`'s own docstring on `leanGenerator`/`deepGenerator`). */
  readonly config: Config;
}

/**
 * `seeya snooze`/`seeya skip-today`'s own composition (S4-T4): just `Storage` and `Clock` — both
 * commands only ever mutate `~/.seeya/estado.json` (docs/ESPECIFICACAO.md § "seeya snooze...":
 * "o estado é persistido, não guardado em memória"), never re-discovering sessions or touching
 * `adapters/process`/`adapters/discovery` at all. `config` is read here so
 * `cli/snooze-command.ts#renderSnoozeConfirmation` can show the resulting schedule decision
 * without a second `Storage` round trip inside the command itself.
 */
export async function buildSnoozeContext(homeDir: string = os.homedir()): Promise<SnoozeContext> {
  const home = resolveCliHome(homeDir);
  const clock = systemClock;
  const storage = buildStorage(home);
  const config = await storage.readConfig();
  return { storage, clock, config };
}

export interface ConfigContext {
  readonly storage: Storage;
}

/**
 * `seeya config`'s own composition (S4-T4): just `Storage` — `cli/config-command.ts` reads
 * `config.json` itself, fresh, inside every sub-action (`get`/`set`/`policy`), rather than this
 * function pre-reading it the way `buildSnoozeContext` does for `SnoozeContext.config` above.
 * `seeya config` is the one command whose whole job is writing that same document, so caching a
 * read of it here would risk a `set` overwriting a value this function saw stale before the write
 * even started, if the read here happened to matter — it doesn't (the command re-reads before
 * every write anyway), but not caching it here also means never *tempting* a future reader of this
 * file to skip that re-read.
 */
export function buildConfigContext(homeDir: string = os.homedir()): ConfigContext {
  const home = resolveCliHome(homeDir);
  return { storage: buildStorage(home) };
}

/**
 * `seeya daemon`'s own composition (S4-T3): every port `scheduler/` orchestrates, wired to its
 * real adapter — same generators/`ForkCleanup`/`GitReader`/`TranscriptReader` `buildEndDayContext`
 * already wires for `seeya end-day`, since the daemon calls the exact same `application/endDay`
 * pipeline (docs/PLANO-DE-ENTREGA.md S4-T3's own brief: "a S4-T1 entregou a porta `Notifier`... o
 * daemon herda o escopo certo").
 *
 * **`buildSessionProvider` is a closure, not a pre-built `SessionProvider`** — see
 * `scheduler/types.ts#DaemonDeps.buildSessionProvider`'s own docstring for why a long-running
 * daemon can't reuse one instance built once at startup the way every other, short-lived command
 * safely does: a later `seeya config` edit to `relevanceHours` has to take effect on the daemon's
 * very next poll, not just after the daemon itself restarts.
 *
 * **`discoverEarlyWarnings` is likewise a closure** over this function's own `home`/`storage` —
 * `scheduler/` cannot import `adapters/discovery/` at all (docs/ARQUITETURA.md's layer matrix), so
 * this is what lets `scheduler/poll.ts` call the real S1-T7 detection without ever naming it.
 *
 * **`leanGenerator`/`deepGenerator` are also a closure, `buildGenerators` (S4-T12), not two
 * pre-built instances** — closing the gap docs/QUESTOES.md Q-049 item 8 flagged: before this task,
 * both were built once, here, from whatever `captureModel`/`budgetPerSessionUsd` `config.json` held
 * at daemon startup, so a later `seeya config set` to either only took effect after the daemon
 * itself restarted, unlike `relevanceHours` (already a closure, above) and the scheduling values
 * `scheduler/poll.ts` re-reads every poll. `scheduler/poll.ts#buildEndDayDeps` now calls
 * `buildGenerators` once per poll with THIS poll's freshly-read config — the exact same "rebuild
 * every cycle, it's cheap" treatment `buildSessionProvider` already gets, for the identical reason.
 */
// Not `async` (S4-T12 removed its one `await` — `storage.readConfig()` at startup — along with
// `leanGenerator`/`deepGenerator`'s eager construction, since neither is built from config any
// more): `Promise.resolve` keeps the return type `Promise<DaemonDeps>` for `cli/index.ts`'s
// existing `await buildDaemonContext()` call sites, without an `async` function body that has
// nothing left to await (`@typescript-eslint/require-await`).
export function buildDaemonContext(homeDir: string = os.homedir()): Promise<DaemonDeps> {
  const home = resolveCliHome(homeDir);
  const clock = systemClock;
  const storage = buildStorage(home);
  return Promise.resolve({
    clock,
    storage,
    // V2-T5b item 5: "quem manda o toast é o daemon" — this is the one place that needs to know
    // WHICH scheme (core/types.ts#ProtocolScheme) the interface last registered as its protocol
    // handler (Storage.readActiveProtocolScheme, reshaped from a boolean by V2-T10 item 2) before
    // a toast can safely carry a `launch` attribute
    // (adapters/notification/index.ts#buildNotifier's own docstring). Every other caller of this
    // package still imports the bare `notifier` singleton unchanged.
    notifier: buildNotifier(() => storage.readActiveProtocolScheme()),
    processControl: realProcessControl,
    transcriptReader: new TranscriptFileReader({ claudeHome: home.claudeHome }),
    gitReader: new GitAdapter({ clock }),
    forkCleanup: new DiscoveryForkCleanup({
      claudeHome: home.claudeHome,
      seeyaHome: home.seeyaHome,
      clock,
    }),
    buildSessionProvider: (relevanceHours) =>
      buildSessionProvider(home, clock, realProcessControl, relevanceHours),
    // S4-T12: called once per poll (`scheduler/poll.ts#buildEndDayDeps`) with THAT poll's
    // freshly-read `captureModel`/`budgetPerSessionUsd` — no config read up here at daemon
    // startup any more, since neither generator has anything left to build eagerly from.
    buildGenerators: (options) => ({
      leanGenerator: new LeanHandoffGenerator(options),
      deepGenerator: new DeepHandoffGenerator({ ...options, seeyaHome: home.seeyaHome, clock }),
    }),
    discoverEarlyWarnings: async (sessions) => {
      const result = await discoverEarlyWarnings(sessions, {
        claudeHome: home.claudeHome,
        storage,
      });
      return result.earlyWarnings;
    },
  });
}

export interface AutostartContext {
  readonly autostart: Autostart;
}

/**
 * `seeya autostart enable | disable | status`'s own composition (S5-T1): just the `Autostart`
 * port, one per OS (`adapters/autostart/index.ts`). `binaryPath` itself is NOT resolved here —
 * `cli/index.ts` resolves it the same way `seeya daemon`'s own self-relaunch already does
 * (`fileURLToPath(import.meta.url)`) and passes it straight to `runAutostartEnableCommand`,
 * rather than this function reaching for it a second, different way.
 */
export function buildAutostartContext(homeDir: string = os.homedir()): AutostartContext {
  return { autostart: buildAutostart(homeDir, resolveCliHome(homeDir).seeyaHome) };
}

/**
 * V2-T13 (D-045 items 2/3): who owns the daemon/autostart on THIS machine — the one query
 * `cli/index.ts`'s `daemon` launcher branch and `seeya autostart enable` both need before doing
 * anything (`daemon-command.ts#runDaemonLauncher`, `autostart-command.ts#runAutostartEnableCommand`).
 * No `homeDir` parameter, unlike every other `build*Context` here: `AppInstallation` asks the OS's
 * own installation record, never `~/.seeya/` (D-045 item 2's own reasoning — see
 * `core/ports.ts#AppInstallation`'s docstring) — there is no root for this one to accept.
 */
export async function resolveCliDaemonOwner(): Promise<DaemonOwner> {
  const status = await buildAppInstallation().find();
  return resolveDaemonOwner(status);
}

export interface ProjectContext {
  readonly storage: Storage;
  readonly workspace: WorkspaceRepository;
  /** V2-T28: `add-repo`'s own read of a local clone's remote. */
  readonly gitReader: GitReader;
  /** V2-T28: `add-repo`'s path check and `open`'s per-repository liveness check. */
  readonly directoryExistence: DirectoryExistence;
  /** V2-T28: `open`'s own harness spawn. */
  readonly harnessLauncher: HarnessLauncher;
  /** V2-T33 (D-047 item 1): `open`'s own lock take/check/release; `show`'s own lock status. */
  readonly projectLock: ProjectLock;
  /** V2-T33: the lock's vivacity check — the SAME `ProcessControl` `daemon.lock` already uses. */
  readonly processControl: ProcessControl;
  /** V2-T33: `open`'s own `acquiredAt` (`ProjectLockInfo`). */
  readonly clock: Clock;
  readonly seeyaHome: string;
  /** V2-T33: `readCurrentSessionId()`'s own docstring above. */
  readonly sessionId: string | undefined;
  /** V2-T34 item 1: `open`/`create`'s own hook-reinstall — `resolveCliEntryPath()`'s own docstring
   * above. */
  readonly nodePath: string;
  readonly cliEntryPath: string;
  /** V2-T34 item 3: `open`'s own pre-lock audit (`application/project-audit.ts`). */
  readonly auditMarker: ProjectAuditMarker;
  /** `adapters/workspace/project-lock.ts#PROJECT_LOCK_FILE_NAME` — threaded through rather than
   * imported a second time by `application/` (D-020's own matrix: `application/` cannot import
   * `adapters/`). */
  readonly lockFileName: string;
}

/**
 * `seeya project create | list | show | add-repo | open`'s own composition (V2-T27/V2-T28/V2-T33):
 * `Storage` (for `Storage.readWorkspaceRoot`/`saveWorkspaceRoot`/`readRepositoryMap`/
 * `saveRepositoryMap`) and `WorkspaceRepository` (`FsWorkspaceRepository`, the only concrete
 * adapter this port has — D-020 means naming it here is this file's job, not
 * `application/workspace.ts`'s). No config read: unlike every other `build*Context` above, none
 * of these five commands needs `config.json` for anything.
 */
export function buildProjectContext(homeDir: string = os.homedir()): ProjectContext {
  const home = resolveCliHome(homeDir);
  return {
    storage: buildStorage(home),
    workspace: new FsWorkspaceRepository(),
    gitReader: new GitAdapter({ clock: systemClock }),
    directoryExistence: new FsDirectoryExistence(),
    harnessLauncher: new ClaudeHarnessLauncher(),
    projectLock: new FsProjectLock(),
    processControl: realProcessControl,
    clock: systemClock,
    seeyaHome: home.seeyaHome,
    sessionId: readCurrentSessionId(),
    nodePath: process.execPath,
    cliEntryPath: resolveCliEntryPath(),
    auditMarker: new FsProjectAuditMarker(),
    lockFileName: PROJECT_LOCK_FILE_NAME,
  };
}

/**
 * `seeya project verify-commit <messageFile>`'s own composition (V2-T34 item 1) — the workspace's
 * `commit-msg` hook's one caller. No `homeDir` parameter: the hook already runs with `root` as its
 * own `cwd` (git's own hook-execution contract, `core/workspace-hooks.ts`'s own module comment), so
 * this needs no `~/.seeya/` lookup at all, unlike every other `build*Context` above.
 */
export function buildVerifyCommitDeps(): VerifyCommitDeps {
  return {
    workspace: new FsWorkspaceRepository(),
    projectLock: new FsProjectLock(),
    processControl: realProcessControl,
    commitMessageFile: new FsCommitMessageFile(),
    lockFileName: PROJECT_LOCK_FILE_NAME,
    currentSessionId: readCurrentSessionId(),
  };
}

/** `seeya project audit <id>`'s own composition (V2-T34 item 3) — a thin slice of
 * `ProjectContext`, built the same way rather than reused wholesale: `auditProject` never needs a
 * `HarnessLauncher`/`GitReader`/`DirectoryExistence` at all. */
export function buildProjectAuditDeps(context: ProjectContext): ProjectAuditDeps {
  return {
    storage: context.storage,
    workspace: context.workspace,
    auditMarker: context.auditMarker,
    seeyaHome: context.seeyaHome,
    lockFileName: context.lockFileName,
  };
}

/**
 * This invocation's own `pid`/`procStart` — captured here, not in `buildProjectContext`, because
 * most `seeya project` subcommands never need a `procStart` capture at all (S4-T3b's own
 * `powershell.exe` cost on Windows, 500-880ms even warm, `adapters/process/proc-start.ts`'s own
 * measurement — paying it for `list`/`show`/`create`/`add-repo` would be pure waste). Shared by
 * every `build*Deps` below that needs to attribute a `.seeya-lock` acquisition to THIS process
 * (D-047 items 1/8) — same composition-root-only self-capture `cli/index.ts`'s daemon `worker`
 * branch already does for `daemon.lock` (D-020), reused rather than repeated once per command.
 */
async function capturePidAndProcStart(): Promise<{
  readonly pid: number;
  readonly procStart: string | undefined;
}> {
  const procStartCapture = await captureObservedProcStart(process.pid, processExists);
  return {
    pid: process.pid,
    procStart: procStartCapture.kind === 'value' ? procStartCapture.value : undefined,
  };
}

/**
 * `seeya project open`'s own extra composition (V2-T33, D-047 items 1/4; V2-T35 item 4):
 * `ProjectContext` plus THIS INVOCATION's own `pid`/`procStart`.
 *
 * `launchedSessionId` (V2-T35 item 4): the id `open` generates for the session it's about to
 * launch — `node:crypto#randomUUID`, a plain read of Node's CSPRNG, no new dependency. Generating
 * an id is randomness, so it happens here, at the composition root, never inside `core/`/
 * `application/` (`application/project-open.ts#ProjectOpenDeps.launchedSessionId`'s own
 * docstring).
 */
export async function buildProjectOpenDeps(context: ProjectContext): Promise<ProjectOpenDeps> {
  return { ...context, ...(await capturePidAndProcStart()), launchedSessionId: randomUUID() };
}

/**
 * `seeya project adopt`'s own composition (V2-T29): `ProjectContext` plus the ports its own
 * orchestration needs that no other `seeya project` subcommand does — a `SessionProvider` (to
 * resolve the session argument against real discovery, `config.relevanceHours`-dependent, same
 * `buildSessionProvider` every other command's own `CliContext` already uses), `idleMinutes`
 * (`classifyState`'s own second input), and the fork registry/cleanup/launcher ports
 * `application/project-adopt.ts#AdoptSessionDeps` declares. Reads `config.json` once, unlike
 * `buildProjectContext` above (V2-T27's own docstring: "none of these five commands needs
 * config.json for anything") — `adopt` is the first `project` subcommand that does.
 */
export interface ProjectAdoptContext extends ProjectContext {
  readonly sessionProvider: SessionProvider;
  readonly forkRegistration: ForkRegistration;
  readonly forkCleanup: ForkCleanup;
  readonly adoptionLauncher: SessionAdoptionLauncher;
  readonly idleMinutes: number;
}

export async function buildProjectAdoptContext(
  homeDir: string = os.homedir(),
): Promise<ProjectAdoptContext> {
  const home = resolveCliHome(homeDir);
  const clock = systemClock;
  const context = buildProjectContext(homeDir);
  const config = await context.storage.readConfig();
  return {
    ...context,
    sessionProvider: buildSessionProvider(home, clock, realProcessControl, config.relevanceHours),
    forkRegistration: new GenerationForkRegistration(home.seeyaHome),
    forkCleanup: new DiscoveryForkCleanup({
      claudeHome: home.claudeHome,
      seeyaHome: home.seeyaHome,
      clock,
    }),
    adoptionLauncher: new ClaudeSessionAdoptionLauncher(),
    idleMinutes: config.idleMinutes,
  };
}

/**
 * `ProjectAdoptContext` plus THIS INVOCATION's own `pid`/`procStart`/`forkSessionId` — same
 * per-invocation capture `buildProjectOpenDeps` already does for `open`'s `launchedSessionId`, for
 * the identical reason: `application/project-adopt.ts#AdoptSessionDeps.forkSessionId` is randomness
 * (`node:crypto#randomUUID`), which stays out of `core/`/`application/` (D-020).
 */
export async function buildProjectAdoptDeps(
  context: ProjectAdoptContext,
): Promise<AdoptSessionDeps> {
  return { ...context, ...(await capturePidAndProcStart()), forkSessionId: randomUUID() };
}

/**
 * `seeya project remove <id>`'s own composition (V2-T32): `ProjectContext` plus THIS INVOCATION's
 * own `pid`/`procStart` (D-047 item 8 — `remove` takes the project lock for the whole of its own,
 * synchronous run, same as `open`/`adopt`, but never launches anything, so there is no separate
 * generated session id here — the lock's holder is this invocation itself).
 */
export async function buildProjectRemoveDeps(context: ProjectContext): Promise<RemoveProjectDeps> {
  return { ...context, ...(await capturePidAndProcStart()) };
}

/** `seeya project remove-repo <id> <name>`'s own composition (V2-T32) — same shape as
 * `buildProjectRemoveDeps` above; a distinct function only because the two application-layer
 * `Deps` types are distinct (`RemoveProjectDeps`/`RemoveRepositoryDeps`), even though their own
 * shape is identical today. */
export async function buildProjectRemoveRepoDeps(
  context: ProjectContext,
): Promise<RemoveRepositoryDeps> {
  return { ...context, ...(await capturePidAndProcStart()) };
}

/**
 * `seeya project revert-adoption <id> [<session>]`'s own composition (V2-T32): `ProjectContext`
 * plus THIS INVOCATION's own `pid`/`procStart` (same D-047 item 8 reasoning as `buildProjectRemoveDeps`
 * above) and a `ForkCleanup` — the one extra port this command needs, to check whether the adopted
 * copy kept writing after being adopted (item 6) and, when authorized, to delete it (D-012). Built
 * fresh here rather than reused from `ProjectAdoptContext`: `revert-adoption` never needs the rest
 * of that context (`sessionProvider`/`forkRegistration`/`adoptionLauncher`/`idleMinutes`), and a
 * plain `ProjectContext` is all its own CLI wiring has in hand.
 */
export async function buildProjectRevertAdoptionDeps(
  context: ProjectContext,
  homeDir: string = os.homedir(),
): Promise<RevertAdoptionDeps> {
  const home = resolveCliHome(homeDir);
  return {
    ...context,
    ...(await capturePidAndProcStart()),
    forkCleanup: new DiscoveryForkCleanup({
      claudeHome: home.claudeHome,
      seeyaHome: home.seeyaHome,
      clock: systemClock,
    }),
  };
}
