/**
 * `seeya project adopt <session> <projectId>`'s own orchestration (V2-T29, D-045 item 4, D-047
 * item 6). Runs the adoption on a FORK of the chosen session, never the original — `--fork-session`
 * (already used by the deep capture generator since S2-T2) copies the transcript to a new file; the
 * original never receives a line. The fork is resumed interactively, in ITS OWN original directory
 * — a deliberate choice, not an accident (maintainer's own reasoning, 2026-09-24): the Claude Code
 * loads that directory's own `CLAUDE.md`, auto-memory, configuration and skills by working
 * directory, so opening there is what gives the fork all of that; opened in the project instead, it
 * would have only the transcript. The project itself is released via `--add-dir`, and
 * `adapters/harness/adopt-instruction.ts#buildAdoptionInstruction` asks the session to carry over
 * into the project whatever, from what's locally available to it, belongs to this specific work.
 * The person approves every write on the spot, per D-047's own reasoning for choosing interactive
 * resumption over any headless `--permission-mode` (docs/spikes/N-adocao-de-sessao.md's own "a
 * V2-T29 não pode assumir que retomar basta para poder escrever").
 *
 * Same shape `application/project-open.ts#openProject` already established for a command that
 * takes the project lock, blocks for an entire interactive `claude` lifetime, and releases the
 * lock afterward — reused here (`application/project-lock.ts#acquireProjectLock`/
 * `releaseProjectLock`), not reimplemented.
 *
 * **What happens after the fork's harness closes** (reading what it left behind, committed or
 * not, and deciding the outcome) lives in `application/project-adopt-outcome.ts` (V2-T72) — split
 * out to keep this file under AGENTS.md's own ~500-line ceiling. Every type this file's own public
 * surface exposes is re-exported here from `application/project-adopt-types.ts`, so nothing about
 * `@seeya-ai/engine/application/project-adopt.js` changes for any caller.
 */
import path from 'node:path';
import type { HarnessOpenResult } from '../core/ports.js';
import type { DiscoveredSession, SessionState } from '../core/types.js';
import { classifyState } from '../core/classification.js';
import { findAdoptionRecord } from '../core/adoption-registry.js';
import { isValidProjectId } from '../core/project-id.js';
import { createProject, resolveWorkspaceRoot } from './workspace.js';
import { acquireProjectLock, releaseProjectLock } from './project-lock.js';
import { finishAdoption } from './project-adopt-outcome.js';
import type {
  AdoptSessionCallbacks,
  AdoptSessionDeps,
  AdoptSessionResult,
  ConfirmAdoptionLaunchAnswer,
} from './project-adopt-types.js';

export type {
  AdoptSessionCallbacks,
  AdoptSessionDeps,
  AdoptSessionResult,
  ConfirmAdoptionAnswer,
  ConfirmAdoptionCommit,
  ConfirmAdoptionLaunch,
  ConfirmAdoptionLaunchAnswer,
} from './project-adopt-types.js';

/** Item 1's own "sessão aberta agora recusada": `alive`/`idle` both mean the process is running
 * right now — retomar o que está rodando abriria uma segunda cópia, so BOTH are refused, never
 * just `alive` (D-025: `idle` is still a live process, not a claim that nothing is happening). */
function isSessionRunning(state: SessionState): boolean {
  return state === 'alive' || state === 'idle';
}

/** The two refusals that never touch any port at all: a session running right now, or an original
 * already adopted somewhere on this device. `null` means "proceed". Extracted so `adoptSession`
 * itself stays a straight-line sequence (AGENTS.md § "Retorno cedo"). */
async function checkAdoptionPreconditions(
  deps: AdoptSessionDeps,
  original: DiscoveredSession,
  now: Date,
): Promise<AdoptSessionResult | null> {
  const state = classifyState(original, { now, idleMinutes: deps.idleMinutes });
  if (isSessionRunning(state)) {
    return { kind: 'sessionRunning', sessionId: original.sessionId, name: original.name, state };
  }
  const existing = findAdoptionRecord(await deps.storage.readAdoptions(), original.sessionId);
  if (existing === null) {
    return null;
  }
  return {
    kind: 'alreadyAdopted',
    sessionId: original.sessionId,
    projectId: existing.projectId,
    adoptedAt: existing.adoptedAt,
  };
}

/** Item 1: adopting into a project that doesn't exist yet creates it first — reuses `createProject`
 * (`application/workspace.ts`) rather than duplicating its skeleton-write-plus-commit sequence
 * (AGENTS.md: "nada de duplicação"). Its own `invalidId`/`alreadyExists` outcomes are both fine
 * here: `invalidId` is unreachable (the caller already checked), and `alreadyExists` is exactly the
 * "adopt into an existing project" case this function has to support anyway. */
async function ensureProjectExists(deps: AdoptSessionDeps, projectId: string): Promise<void> {
  await createProject(deps, projectId);
}

/** Asks `callbacks.confirmLaunch`, or resolves `'unavailable'` when none was given (D-025 — same
 * "never a silent default" `application/project-open.ts#confirmReadOnlyOpen` already applies).
 * Item 8's own gate, asked before anything is created. */
async function confirmAdoptionLaunch(
  callbacks: AdoptSessionCallbacks | undefined,
  originalCwd: string,
  projectDir: string,
  projectId: string,
): Promise<ConfirmAdoptionLaunchAnswer> {
  if (callbacks?.confirmLaunch === undefined) {
    return 'unavailable';
  }
  return callbacks.confirmLaunch({ originalCwd, projectDir, projectId });
}

/** Registers the fork (before spawning — D-012, survives a crash the same way
 * `adapters/generation/fork-registration.ts#registerFork`'s own docstring argues for captures),
 * launches it, and unwinds the registration if it never actually started. Returns the raw
 * `HarnessOpenResult` — `adoptSession` decides what `failedToStart` means for the lock. */
async function launchAdoptionFork(
  deps: AdoptSessionDeps,
  projectDir: string,
  original: DiscoveredSession,
  now: Date,
): Promise<HarnessOpenResult> {
  await deps.forkRegistration.register(deps.forkSessionId, now);
  const launch = await deps.adoptionLauncher.adopt(
    original.cwd,
    projectDir,
    original.sessionId,
    deps.forkSessionId,
  );
  if (launch.kind === 'failedToStart') {
    await deps.forkRegistration.unregister(deps.forkSessionId);
  }
  return launch;
}

/**
 * @example
 * const result = await adoptSession(deps, discoveredSession, 'auth-hardening', {
 *   confirmCommit: (files) => askThePerson(files),
 * });
 */
export async function adoptSession(
  deps: AdoptSessionDeps,
  original: DiscoveredSession,
  projectId: string,
  callbacks?: AdoptSessionCallbacks,
): Promise<AdoptSessionResult> {
  if (!isValidProjectId(projectId)) {
    return { kind: 'invalidId', projectId };
  }

  const now = deps.clock.now();
  const refusal = await checkAdoptionPreconditions(deps, original, now);
  if (refusal !== null) {
    return refusal;
  }

  // Item 8: explained and confirmed BEFORE anything is created — the project doesn't exist yet,
  // no lock is taken, no fork is registered. `resolveWorkspaceRoot` alone is not "creating the
  // copy" (it only resolves/persists WHERE the workspace lives on this device, the same read
  // every other `seeya project` command does freely) — needed here only to compute `projectDir`
  // for the explanation text.
  const root = await resolveWorkspaceRoot(deps.storage, deps.seeyaHome);
  const projectDir = path.join(root, projectId);
  const confirmation = await confirmAdoptionLaunch(callbacks, original.cwd, projectDir, projectId);
  if (confirmation !== 'proceed') {
    return {
      kind:
        confirmation === 'decline' ? 'launchConfirmationDeclined' : 'launchConfirmationUnavailable',
      projectId,
    };
  }

  await ensureProjectExists(deps, projectId);

  const lock = await acquireProjectLock(
    deps,
    root,
    projectId,
    { pid: deps.pid, procStart: deps.procStart, sessionId: deps.forkSessionId },
    now,
  );
  if (lock.decision.kind === 'refuse') {
    return { kind: 'projectLocked', projectId, heldBy: lock.decision.heldBy };
  }

  // V2-T34 production defect (PO review, 2026-09-25): a single `finally`, not a `releaseProjectLock`
  // call hand-copied onto every branch below — the pre-fix version had exactly that (one on
  // `failedToStart`, one at the end of the old `finishAdoption`) and STILL leaked the lock, because
  // `commitAll` throwing from deeper inside `finishAdoption` skipped both of them. Anything commitAll
  // itself expects to fail (the workspace's own git hook refusing a commit) is now caught inside
  // `commitAdoption` (`project-adopt-outcome.ts`) and returned as `AdoptSessionResult`'s own
  // `commitFailed` — this `finally` is the safety net for everything else (a truly unexpected throw
  // anywhere in this span).
  try {
    const launch = await launchAdoptionFork(deps, projectDir, original, now);
    if (launch.kind === 'failedToStart') {
      return { kind: 'failedToStart', projectId };
    }
    return await finishAdoption(deps, root, projectId, original.sessionId, callbacks);
  } finally {
    await releaseProjectLock(deps, root, projectId, deps.pid);
  }
}
