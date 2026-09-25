/**
 * `seeya project open <id> [--with <harness>]`'s own orchestration (V2-T28,
 * `docs/PLANO-DE-ENTREGA.md` item 3). Resolves which associated repositories are actually
 * reachable on this device, then hands the project's own directory and their local paths to
 * `HarnessLauncher` — the port is the only thing here that touches a real process.
 */
import path from 'node:path';
import type {
  Clock,
  DirectoryExistence,
  HarnessLauncher,
  ProcessControl,
  ProjectAuditMarker,
  ProjectLock,
  Storage,
  WorkspaceRepository,
} from '../core/ports.js';
import type { ProjectLockInfo, ProjectOpenLockOutcome } from '../core/project-lock.js';
import { formatProjectLockWarningLines } from '../core/project-lock-message.js';
import { buildProjectWorkingRulesText } from '../core/project-working-rules.js';
import { buildProjectCommitMessage } from '../core/project-commit.js';
import type { AssociatedRepository, ProjectManifest } from '../core/types.js';
import { isValidProjectId } from '../core/project-id.js';
import { findRepositoryMapEntry } from '../core/repository-map.js';
import { resolveWorkspaceRoot } from './workspace.js';
import { ensureWorkspaceHooksInstalled } from './workspace-hooks.js';
import { ensureHarnessHookInstalled } from './harness-hook.js';
import { auditProject, type ProjectAuditReport } from './project-audit.js';
import {
  acquireProjectLock,
  describeProjectLockStatus,
  releaseProjectLock,
  type ProjectLockStatus,
} from './project-lock.js';

export type { ProjectOpenLockOutcome };

/** V2-T28 item 5: only `claude` this task — `docs/spikes/N-adocao-de-sessao.md` measured the
 * Codex resume-with-message path, never the `--add-dir` equivalent `open` also needs, so
 * supporting it here would be inventing untested behavior. */
export const SUPPORTED_HARNESS = 'claude';

export interface ProjectOpenDeps {
  readonly storage: Storage;
  readonly workspace: WorkspaceRepository;
  readonly directoryExistence: DirectoryExistence;
  readonly harnessLauncher: HarnessLauncher;
  readonly projectLock: ProjectLock;
  readonly processControl: ProcessControl;
  readonly clock: Clock;
  readonly seeyaHome: string;
  /** Same `CLAUDE_CODE_SESSION_ID` source as `application/workspace.ts
   * #WorkspaceCommandDeps.sessionId` (D-047) — the CALLER's own session, when `open` itself runs
   * from inside one. **No longer used to identify `open`'s own lock holder (V2-T35 item 4):** the
   * lock is always attributed to `launchedSessionId` below instead, so a project opened from a
   * plain terminal is never "unidentified" any more, and a project opened from inside another
   * session is never attributed to the WRONG session (the one that ran `open`, not the one it
   * launched). Kept here only because every other `project` subcommand still reads it through the
   * same `ProjectContext` this type extends (create/add-repo commit trailers). */
  readonly sessionId: string | undefined;
  /** This `seeya project open` invocation's OWN process — `open` blocks for the harness's entire
   * interactive lifetime (`core/ports.ts#HarnessLauncher.open`'s `stdio: 'inherit'`), so its
   * liveness IS the lock's liveness (`core/project-lock.ts#ProjectLockInfo`'s own docstring).
   * `packages/cli/src/project-command.ts#runProjectOpenCommand` captures `procStart` the same way
   * `cli/index.ts`'s daemon branch already does for `daemon.lock` — a composition-root-only call. */
  readonly pid: number;
  readonly procStart: string | undefined;
  /**
   * V2-T35 item 4: the id `open` itself generates for the session it's ABOUT to launch —
   * `packages/cli/src/composition.ts#buildProjectOpenDeps` (`node:crypto#randomUUID`; generating an
   * id is randomness, so it happens at the composition root, never inside `core/`/`application/`).
   * Passed to `claude --session-id <id>` and written into `.seeya-lock` as this attempt's own
   * `sessionId` — replacing the env-derived `sessionId` above for exactly this one purpose. Always
   * known (never optional): `open` always launches a fresh `claude` and always knows its own
   * generated id before doing so, unlike `sessionId`, which is absent whenever `open` itself wasn't
   * run from inside a session.
   */
  readonly launchedSessionId: string;
  /** V2-T34 item 1: same pair `application/workspace.ts#WorkspaceCommandDeps` already carries for
   * `createProject` — `openProject` reasserts the workspace's own `commit-msg` hook right at the
   * start of every run ("reafirmados a cada open"). */
  readonly nodePath: string;
  readonly cliEntryPath: string;
  /** Same optional escape hatch as `application/workspace.ts#WorkspaceCommandDeps.hookEnv` — only
   * `packages/app/src/composition/index.ts` supplies it. */
  readonly hookEnv?: Readonly<Record<string, string>>;
  /** V2-T34 item 3: `application/project-audit.ts#auditProject`'s own extra dependency —
   * `openProject` audits BEFORE ever taking the lock (item 3's own "chamada também pelo open,
   * antes de tomar o lock"). */
  readonly auditMarker: ProjectAuditMarker;
  /** `adapters/workspace/project-lock.ts#PROJECT_LOCK_FILE_NAME`, injected by the composition root
   * (`application/` cannot import `adapters/`) — `auditProject`'s own dependency, threaded through
   * here rather than duplicated as a bare literal. */
  readonly lockFileName: string;
}

/** D-024: one repository `open` couldn't attach, and exactly why — never conflated with a
 * repository that WAS attached. */
export type MissingRepositoryRecord =
  | { readonly name: string; readonly reason: 'notInDeviceMap' }
  | { readonly name: string; readonly reason: 'pathMissing'; readonly path: string };

/**
 * `ProjectOpenLockOutcome` itself now lives in `core/project-lock.ts` (re-exported above,
 * unchanged import path for every existing caller) — moved there in V2-T35 so
 * `core/project-lock-message.ts` (pure, shared by `cli/` and `application/`) can describe it
 * without either layer reaching into the other.
 */

/** V2-T35 item 1: what `confirmReadOnlyOpen` answers, asked ONLY when the lock outcome is
 * `readOnly` (a genuinely free — or just-reclaimed — lock never pauses for a question, "com o
 * lock livre, nada muda"). Never flattened into a boolean (D-024): `unavailable` is its own case,
 * not a silent `decline` — `formatOpenProjectReport` needs to tell the two apart ("you said no" vs
 * "there was no way to ask"). */
export type ReadOnlyOpenAnswer = 'proceed' | 'decline' | 'unavailable';

/** Reads from the terminal exactly like `start-day-command.ts#makeFallbackConfirmer` does — a real
 * question over `node:readline/promises`, `cli/project-command.ts#makeReadOnlyOpenConfirmer`'s own
 * implementation — but unlike that confirmer, a missing TTY here is never a silent default answer:
 * it resolves `'unavailable'`, and `openProject` refuses outright (item 1's own "sem entrada
 * interativa, recusa dizendo o porquê" — this is the one confirmation in this project that does
 * NOT fall back to guessing). */
export type ConfirmReadOnlyOpen = (heldBy: ProjectLockInfo) => Promise<ReadOnlyOpenAnswer>;

/** V2-T34 item 4: what `confirmLeftoverChanges` answers, asked ONLY when this attempt actually
 * ACQUIRED the lock (a read-only open never writes, so a previous session's leftovers are none of
 * its business) and `WorkspaceRepository.listChangedFiles` reports something uncommitted. Never
 * flattened into a boolean (D-024): "commit it now" and "proceed, but tell the new session" are two
 * different actions, not a yes/no — and `unavailable` is its own case, same "no way to ask" reading
 * `ReadOnlyOpenAnswer` already established, never a silent default either way. */
export type LeftoverChangesAnswer = 'commitNow' | 'proceedWithoutCommitting' | 'unavailable';

export type ConfirmLeftoverChanges = (
  changedFiles: readonly string[],
) => Promise<LeftoverChangesAnswer>;

export interface OpenProjectCallbacks {
  readonly onBeforeLaunch?: (info: {
    readonly missing: readonly MissingRepositoryRecord[];
    readonly lock: ProjectOpenLockOutcome;
    /** V2-T34 item 3: what `auditProject` found since the last audit — `null` only if the audit
     * itself couldn't run (never in production: `openProject` already validated `projectId` and
     * confirmed the project exists before this point). */
    readonly audit: ProjectAuditReport | null;
  }) => void;
  /** `undefined` behaves exactly like `'unavailable'` (D-025: never silently proceed without an
   * explicit yes) — every production caller (`cli/project-command.ts`) always supplies one; a test
   * that never reaches a `readOnly` lock never needs to either. */
  readonly confirmReadOnlyOpen?: ConfirmReadOnlyOpen;
  /** Same `undefined` → `'unavailable'` discipline as `confirmReadOnlyOpen` above — a test that
   * never leaves changed files behind never needs to supply this either. */
  readonly confirmLeftoverChanges?: ConfirmLeftoverChanges;
}

export type OpenProjectResult =
  | { readonly kind: 'invalidId'; readonly projectId: string }
  | { readonly kind: 'notFound'; readonly projectId: string }
  | { readonly kind: 'noHarnessChosen'; readonly projectId: string }
  | { readonly kind: 'unsupportedHarness'; readonly harness: string }
  | { readonly kind: 'failedToStart'; readonly projectId: string; readonly harness: string }
  /** V2-T35 item 1: the person was asked (the warning was already on screen) and explicitly said
   * no — `open` never ran the harness at all, so there is nothing left to release. */
  | {
      readonly kind: 'lockConfirmationDeclined';
      readonly projectId: string;
      readonly heldBy: ProjectLockInfo;
    }
  /** V2-T35 item 1: locked, and there was no interactive terminal to ask through — `open` refuses
   * rather than silently opening (read-only) without anyone having seen the question. */
  | {
      readonly kind: 'lockConfirmationUnavailable';
      readonly projectId: string;
      readonly heldBy: ProjectLockInfo;
    }
  /** V2-T34 item 4: this attempt acquired the lock, found changes a previous session left
   * uncommitted, and there was no interactive terminal to ask what to do with them — `open` refuses
   * (releasing the lock it just took) rather than guessing "commit" or "proceed" on the person's
   * behalf (item 4's own "nunca descarta," extended: it never silently commits OR silently proceeds
   * either). */
  | {
      readonly kind: 'leftoverChangesConfirmationUnavailable';
      readonly projectId: string;
      readonly changedFiles: readonly string[];
    }
  | {
      readonly kind: 'opened';
      readonly projectId: string;
      readonly harness: string;
      readonly exitCode: number;
      readonly addedDirs: readonly string[];
      readonly missing: readonly MissingRepositoryRecord[];
      readonly lock: ProjectOpenLockOutcome;
      /** V2-T35 item 3: the lock's state read fresh, AFTER the harness closed (and after THIS
       * session's own release, when it held the lock) — "diz como ficou," never the pre-launch
       * snapshot repeated as if it were still current. */
      readonly finalLockStatus: ProjectLockStatus;
    };

interface ResolvedDirs {
  readonly addDirs: readonly string[];
  readonly missing: readonly MissingRepositoryRecord[];
}

/** For each associated repository: a local path this device knows about AND that still exists
 * becomes a `--add-dir`; anything else becomes a `MissingRepositoryRecord` (item 4: `open` warns
 * and continues, never aborts over one missing repository, D-025). */
async function resolveRepositoryDirs(
  deps: ProjectOpenDeps,
  projectId: string,
  repositories: readonly AssociatedRepository[],
): Promise<ResolvedDirs> {
  const map = await deps.storage.readRepositoryMap();
  const addDirs: string[] = [];
  const missing: MissingRepositoryRecord[] = [];
  for (const repository of repositories) {
    const entry = findRepositoryMapEntry(map, projectId, repository);
    if (entry === null) {
      missing.push({ name: repository.name, reason: 'notInDeviceMap' });
      continue;
    }
    if (await deps.directoryExistence.exists(entry.path)) {
      addDirs.push(entry.path);
    } else {
      missing.push({ name: repository.name, reason: 'pathMissing', path: entry.path });
    }
  }
  return { addDirs, missing };
}

function resolveHarness(
  manifest: ProjectManifest,
  harnessOverride: string | undefined,
): string | null {
  return harnessOverride ?? manifest.defaultHarness;
}

/** D-047 item 4: takes the project lock before opening, releases it after the harness closes —
 * only for a session that actually acquired it (`readOnly` never calls `releaseProjectLock`, there
 * is nothing this process holds to release). V2-T35 item 4: the lock's `sessionId` is always
 * `deps.launchedSessionId` — the id `open` generated for the session it's about to launch — never
 * `deps.sessionId` (the CALLER's own, if any): the dono of the lock is the session `open` opened,
 * never the one that ran `open`. */
async function acquireOpenLock(
  deps: ProjectOpenDeps,
  root: string,
  projectId: string,
): Promise<ProjectOpenLockOutcome> {
  const outcome = await acquireProjectLock(
    deps,
    root,
    projectId,
    { pid: deps.pid, procStart: deps.procStart, sessionId: deps.launchedSessionId },
    deps.clock.now(),
  );
  if (outcome.decision.kind === 'refuse') {
    return { kind: 'readOnly', heldBy: outcome.decision.heldBy };
  }
  return { kind: 'acquired', reclaimedStale: outcome.reclaimedStale };
}

/** V2-T35 item 1: asks `callbacks.confirmReadOnlyOpen` when given, otherwise resolves
 * `'unavailable'` directly (D-025: never a silent default answer — see `ConfirmReadOnlyOpen`'s own
 * docstring). Only ever called with a `readOnly` lock — a free or just-reclaimed one never reaches
 * this function at all. */
async function confirmReadOnlyOpen(
  callbacks: OpenProjectCallbacks | undefined,
  heldBy: ProjectLockInfo,
): Promise<ReadOnlyOpenAnswer> {
  if (callbacks?.confirmReadOnlyOpen === undefined) {
    return 'unavailable';
  }
  return callbacks.confirmReadOnlyOpen(heldBy);
}

/** V2-T35 item 1's own gate, extracted so `openProject` stays a straight-line sequence (AGENTS.md
 * § "Retorno cedo"). `null` means "proceed" — a free/just-reclaimed lock, or an explicit yes to a
 * `readOnly` one; anything else is the final `OpenProjectResult` `openProject` should return
 * immediately, never calling `harnessLauncher.open` at all. */
async function blockedByLock(
  callbacks: OpenProjectCallbacks | undefined,
  projectId: string,
  lock: ProjectOpenLockOutcome,
): Promise<OpenProjectResult | null> {
  if (lock.kind !== 'readOnly') {
    return null;
  }
  const answer = await confirmReadOnlyOpen(callbacks, lock.heldBy);
  if (answer === 'proceed') {
    return null;
  }
  return {
    kind: answer === 'decline' ? 'lockConfirmationDeclined' : 'lockConfirmationUnavailable',
    projectId,
    heldBy: lock.heldBy,
  };
}

/**
 * V2-T34 item 5: `core/project-working-rules.ts#buildProjectWorkingRulesText`, always present —
 * unlike the V2-T35 item 2 lock warning below (which is empty for a genuinely free lock), the
 * working rules are delivered on EVERY `open`, since D-047 item 5's own "valer sempre" doesn't stop
 * mattering just because nobody else is holding the lock right now. V2-T35 item 2's own lock
 * warning (`core/project-lock-message.ts#formatProjectLockWarningLines`, the SAME text
 * `cli/format-project.ts` prints to the terminal) is appended when there's something to say, and
 * V2-T34 item 4's own leftover-files note is appended when `pendingFiles` isn't empty (only reached
 * when the person chose "proceed without committing" — item 4's own "a sessão nova recebe... a
 * lista do que está pendente").
 */
function systemPromptAppendFor(
  projectId: string,
  lock: ProjectOpenLockOutcome,
  pendingFiles: readonly string[],
): string {
  const sections = [buildProjectWorkingRulesText(projectId)];
  const lockLines = formatProjectLockWarningLines(projectId, lock);
  if (lockLines.length > 0) {
    sections.push(lockLines.join('\n'));
  }
  if (pendingFiles.length > 0) {
    sections.push(
      'Changes a previous session left uncommitted are still here (nobody committed them before ' +
        `closing):\n${pendingFiles.map((file) => `- ${file}`).join('\n')}`,
    );
  }
  return sections.join('\n\n');
}

/** V2-T34 item 4's own gate, extracted the same way `blockedByLock` already is (AGENTS.md §
 * "Retorno cedo") — only relevant once THIS attempt actually holds the lock (`lock.kind ===
 * 'readOnly'` never writes, so a previous session's leftovers are irrelevant to it). `pendingFiles`
 * is what `systemPromptAppendFor` folds into the new session's own context when the person chose to
 * proceed without committing; `null` means "stop here," with the final `OpenProjectResult` already
 * decided. */
async function handleLeftoverChanges(
  deps: ProjectOpenDeps,
  callbacks: OpenProjectCallbacks | undefined,
  root: string,
  projectId: string,
  lock: ProjectOpenLockOutcome,
): Promise<{ readonly pendingFiles: readonly string[] } | { readonly result: OpenProjectResult }> {
  if (lock.kind !== 'acquired') {
    return { pendingFiles: [] };
  }
  const changedFiles = await deps.workspace.listChangedFiles(root, projectId);
  if (changedFiles.length === 0) {
    return { pendingFiles: [] };
  }
  const answer =
    callbacks?.confirmLeftoverChanges === undefined
      ? 'unavailable'
      : await callbacks.confirmLeftoverChanges(changedFiles);
  if (answer === 'commitNow') {
    // D-025: nobody present can say whose these were — `undefined` reads as `Seeya-Session-Id:
    // unknown` (`core/project-commit.ts#UNKNOWN_SESSION_TRAILER_VALUE`), never a guessed identity.
    const message = buildProjectCommitMessage(
      `Commit changes left uncommitted before opening ${projectId}`,
      projectId,
      undefined,
    );
    await deps.workspace.commitAll(root, projectId, message);
    return { pendingFiles: [] };
  }
  if (answer === 'proceedWithoutCommitting') {
    return { pendingFiles: changedFiles };
  }
  // `'unavailable'` (item 4's own "sem terminal interativo, recusa dizendo o porquê") — the caller
  // is responsible for releasing the lock this attempt already took (`openProject`'s own tail).
  return { result: { kind: 'leftoverChangesConfirmationUnavailable', projectId, changedFiles } };
}

/**
 * `docs/V2-RUMO.md` § "Abertura das sessões": "`open` só executa o CLI do harness escolhido com o
 * projeto como diretório de trabalho." Never writes anything to `seeya.json` — `--with` overrides
 * the harness for THIS invocation only, it's never persisted as the project's new `defaultHarness`.
 *
 * `callbacks.onBeforeLaunch`, when given, fires with the resolved `missing` list and `lock`
 * outcome right before the harness is actually spawned — `cli/project-command.ts
 * #runProjectOpenCommand` uses it to print "repository X is missing"/"read-only" warnings BEFORE
 * the interactive session takes over the terminal (item 4: the person needs to see this while they
 * can still act on it, not after `claude` has already exited). The final `OpenProjectResult` still
 * carries both, so a caller that doesn't need the early warning (a future test, for instance) can
 * read them from there instead.
 *
 * V2-T35 item 1: when `lock.kind === 'readOnly'`, `openProject` pauses right here —
 * `callbacks.onBeforeLaunch` has already shown the warning, and `callbacks.confirmReadOnlyOpen` is
 * asked next. Anything other than `'proceed'` returns without ever calling `harnessLauncher.open`
 * at all: no session launched, nothing to release (this attempt never held the lock).
 *
 * V2-T34 item 1: the workspace's own `commit-msg` hook is reasserted right at the top, before
 * anything else — "um gancho apagado volta sozinho." Item 2 (PO review): the project's own Claude
 * Code hook config is reasserted right after, same reasoning and same timing — both embed this
 * machine's current, absolute `seeya` path. Item 3: the project is audited next, still
 * BEFORE the lock is ever touched (`auditProject`'s own report reaches `callbacks.onBeforeLaunch`
 * alongside the missing-repository/lock info, same "print it before the harness takes the screen"
 * timing V2-T28 item 4 already established for the other two). Item 4: once this attempt actually
 * holds the lock (never for a `readOnly` open), `handleLeftoverChanges` asks what to do with
 * whatever a previous session left uncommitted, before the harness ever launches.
 */
export async function openProject(
  deps: ProjectOpenDeps,
  projectId: string,
  harnessOverride?: string,
  callbacks?: OpenProjectCallbacks,
): Promise<OpenProjectResult> {
  if (!isValidProjectId(projectId)) {
    return { kind: 'invalidId', projectId };
  }
  const root = await resolveWorkspaceRoot(deps.storage, deps.seeyaHome);
  const manifest = await deps.workspace.readProjectManifest(root, projectId);
  if (manifest === null) {
    return { kind: 'notFound', projectId };
  }

  const harness = resolveHarness(manifest, harnessOverride);
  if (harness === null) {
    return { kind: 'noHarnessChosen', projectId };
  }
  if (harness !== SUPPORTED_HARNESS) {
    return { kind: 'unsupportedHarness', harness };
  }

  await ensureWorkspaceHooksInstalled(
    deps.workspace,
    root,
    deps.nodePath,
    deps.cliEntryPath,
    deps.hookEnv ?? {},
  );
  // V2-T34 item 2 (PO review): the Claude Code project hook is regenerated here too, same timing
  // and same reasoning as the git hook right above — both embed this machine's current, absolute
  // `seeya` path, which only `open` can know is fresh.
  await ensureHarnessHookInstalled(
    deps.workspace,
    root,
    projectId,
    deps.nodePath,
    deps.cliEntryPath,
    deps.hookEnv ?? {},
  );
  const auditOutcome = await auditProject(deps, projectId);
  const audit = auditOutcome.kind === 'audited' ? auditOutcome.report : null;

  const { addDirs, missing } = await resolveRepositoryDirs(deps, projectId, manifest.repositories);
  const lock = await acquireOpenLock(deps, root, projectId);
  callbacks?.onBeforeLaunch?.({ missing, lock, audit });

  // V2-T34 production defect (PO review, 2026-09-25): a `finally` around everything from here on,
  // on top of (not instead of) the explicit releases below — `handleLeftoverChanges`'s own
  // `commitAll` call can throw exactly the way `application/project-adopt.ts#commitAdoption`'s did
  // (the workspace's own git hook refusing the commit), and that throw used to skip every release
  // this function has. `releaseProjectLock` only ever clears a lock file whose `pid` is THIS
  // process's own (`core/project-lock.ts#decideProjectLockRelease`), so calling it again here after
  // an explicit release already ran (the normal path) is a safe, idempotent no-op — never another
  // session's lock, never a double-release error.
  try {
    const blocked = await blockedByLock(callbacks, projectId, lock);
    if (blocked !== null) {
      return blocked;
    }

    const leftover = await handleLeftoverChanges(deps, callbacks, root, projectId, lock);
    if ('result' in leftover) {
      // This attempt already acquired the lock (`handleLeftoverChanges` only asks in that case) —
      // release it before refusing, same best-effort discipline `finishOpen` uses for every other
      // early return after acquisition.
      await releaseProjectLock(deps, root, projectId, deps.pid);
      return leftover.result;
    }

    const projectDir = path.join(root, projectId);
    const result = await deps.harnessLauncher.open(
      projectDir,
      addDirs,
      deps.launchedSessionId,
      systemPromptAppendFor(projectId, lock, leftover.pendingFiles),
    );
    return await finishOpen(deps, root, projectId, { harness, addDirs, missing, lock }, result);
  } finally {
    await releaseProjectLock(deps, root, projectId, deps.pid);
  }
}

/** The tail of `openProject`, after the harness has already closed — releases the lock (only when
 * THIS session actually acquired it) and maps `HarnessOpenResult` onto `OpenProjectResult`.
 * Extracted so `openProject` itself stays a straight-line sequence of early returns (AGENTS.md §
 * "Retorno cedo"). */
async function finishOpen(
  deps: ProjectOpenDeps,
  root: string,
  projectId: string,
  opened: {
    readonly harness: string;
    readonly addDirs: readonly string[];
    readonly missing: readonly MissingRepositoryRecord[];
    readonly lock: ProjectOpenLockOutcome;
  },
  result: Awaited<ReturnType<HarnessLauncher['open']>>,
): Promise<OpenProjectResult> {
  if (opened.lock.kind === 'acquired') {
    // Best-effort release: `open` already has the harness's own `exitCode`/`failedToStart` to
    // report either way, and a release failure here would only ever be "the file was already
    // gone" (D-025, `core/project-lock.ts#decideProjectLockRelease`'s own `notHeld`) — never worth
    // turning a completed session into a reported failure.
    await releaseProjectLock(deps, root, projectId, deps.pid);
  }
  if (result.kind === 'failedToStart') {
    return { kind: 'failedToStart', projectId, harness: opened.harness };
  }
  // V2-T35 item 3: read FRESH, after the release above — never the pre-launch `opened.lock`
  // snapshot repeated as if it were still current (the whole bug this task fixes: the warning that
  // preceded the harness is one fact, "how it ended up" is a different one).
  const finalLockStatus = await describeProjectLockStatus(deps, root, projectId);
  return {
    kind: 'opened',
    projectId,
    harness: opened.harness,
    exitCode: result.exitCode,
    addedDirs: opened.addDirs,
    missing: opened.missing,
    lock: opened.lock,
    finalLockStatus,
  };
}
