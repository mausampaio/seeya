/**
 * `seeya project revert-adoption <id> [<session>]`'s own orchestration (V2-T32, item 3, expanded by
 * the PO's 2026-09-24 review into items 5-8). D-047 item 4's whole reason to exist: "reverter uma
 * adoção é reverter os commits daquela sessão naquele projeto, do mais novo para o mais antigo,
 * recusando se algum commit posterior de outra origem mexeu nos mesmos arquivos." The git mechanics
 * live in `adapters/workspace/revert.ts` (behind `WorkspaceRepository`) and the pre-check itself is
 * pure (`core/project-revert.ts#planAdoptionRevert`) — this module only sequences the two together,
 * the lock (item 8, same take-then-release-at-the-end shape `application/project-remove.ts` already
 * gives), the confirmation (item 3), and the adopted copy's own fate afterward (item 6).
 */
import type {
  Clock,
  ForkCleanup,
  ProcessControl,
  ProjectLock,
  Storage,
  WorkspaceRepository,
} from '../core/ports.js';
import type { ProjectLockInfo } from '../core/project-lock.js';
import type { AdoptionRecord } from '../core/types.js';
import { isValidProjectId } from '../core/project-id.js';
import { selectProjectAdoption } from '../core/adoption-registry.js';
import { planAdoptionRevert, type RevertPlan } from '../core/project-revert.js';
import { decideAdoptedCopyGrowth, type AdoptedCopyGrowth } from '../core/adopted-copy-growth.js';
import { buildProjectCommitMessage } from '../core/project-commit.js';
import { resolveWorkspaceRoot } from './workspace.js';
import { acquireProjectLock, releaseProjectLock } from './project-lock.js';

export interface RevertAdoptionDeps {
  readonly storage: Storage;
  readonly workspace: WorkspaceRepository;
  readonly projectLock: ProjectLock;
  readonly processControl: ProcessControl;
  readonly forkCleanup: ForkCleanup;
  readonly clock: Clock;
  readonly seeyaHome: string;
  /** This invocation's own commit trailer AND the lock's own holder — same reasoning
   * `application/project-remove.ts#RemoveProjectDeps.sessionId` already gives: no new session is
   * launched here, so the acting identity is whichever session ran `seeya project
   * revert-adoption` itself, never `record.forkSessionId` (misattributing the REVERT to the very
   * session being undone would be exactly backwards). */
  readonly sessionId: string | undefined;
  readonly pid: number;
  readonly procStart: string | undefined;
}

export type ConfirmRevertAdoptionAnswer = 'proceed' | 'decline' | 'unavailable';

export type ConfirmRevertAdoption = (info: {
  readonly projectId: string;
  readonly originalSessionId: string;
  readonly forkSessionId: string;
  readonly commitsNewestFirst: readonly string[];
}) => Promise<ConfirmRevertAdoptionAnswer>;

export type ConfirmDeleteAdoptedCopyAnswer = 'delete' | 'keep' | 'unavailable';

/** Item 6: asked only when `AdoptedCopyGrowth` isn't `unchanged` — `growth` is `grew`/`unknown`,
 * never `unchanged` here (an unchanged copy is deleted without asking, see `resolveAdoptedCopy`
 * below). */
export type ConfirmDeleteAdoptedCopy = (info: {
  readonly forkSessionId: string;
  readonly adoptedAt: Date;
  readonly growth: Extract<AdoptedCopyGrowth, { readonly kind: 'grew' | 'unknown' }>;
}) => Promise<ConfirmDeleteAdoptedCopyAnswer>;

export interface RevertAdoptionCallbacks {
  /** `undefined` behaves like `'unavailable'` (D-025) — every production caller supplies one. */
  readonly confirmRevert?: ConfirmRevertAdoption;
  /** `undefined` behaves like `'unavailable'`, which `resolveAdoptedCopy` reads as "keep" — item
   * 6's own "resposta padrão é manter" applied to the one caller (a test, or a non-interactive
   * run) that never supplies this at all. */
  readonly confirmDeleteCopy?: ConfirmDeleteAdoptedCopy;
}

/** D-024: `deleted` carries nothing else to say; `kept` always says why, so the report can read
 * differently for "it grew, and the answer was no" than for "there was no way to ask". */
export type AdoptedCopyOutcome =
  | { readonly kind: 'deleted' }
  | {
      readonly kind: 'kept';
      readonly reason: 'grew' | 'unknownGrowth' | 'confirmationUnavailable';
    };

export type RevertAdoptionResult =
  | { readonly kind: 'invalidId'; readonly projectId: string }
  | { readonly kind: 'noAdoption'; readonly projectId: string }
  | {
      readonly kind: 'sessionNotFound';
      readonly projectId: string;
      readonly sessionRef: string;
    }
  | {
      readonly kind: 'ambiguousAdoption';
      readonly projectId: string;
      readonly matches: readonly AdoptionRecord[];
    }
  | { readonly kind: 'projectLocked'; readonly projectId: string; readonly heldBy: ProjectLockInfo }
  /** D-025: the fork was adopted (a record exists) but never actually committed anything inside
   * this project — reachable only if the adoption's own commit step (V2-T29) never ran, which
   * `adoptSession` never leaves a record for; kept as its own case rather than an error because
   * nothing here is corrupt, just empty. */
  | {
      readonly kind: 'nothingToRevert';
      readonly projectId: string;
      readonly originalSessionId: string;
      readonly forkSessionId: string;
    }
  | {
      readonly kind: 'blocked';
      readonly projectId: string;
      readonly originalSessionId: string;
      readonly forkSessionId: string;
      readonly blockingCommit: string;
    }
  | {
      readonly kind: 'confirmationDeclined';
      readonly projectId: string;
      readonly originalSessionId: string;
      readonly forkSessionId: string;
    }
  | {
      readonly kind: 'confirmationUnavailable';
      readonly projectId: string;
      readonly originalSessionId: string;
      readonly forkSessionId: string;
    }
  /** The pre-check (`planAdoptionRevert`) said this was safe, but `git revert` itself hit an
   * unexpected conflict mid-sequence — the safety net `WorkspaceRepository.revertCommits`'s own
   * docstring describes, never reachable when the pre-check's own reasoning holds. */
  | {
      readonly kind: 'revertFailed';
      readonly projectId: string;
      readonly originalSessionId: string;
      readonly forkSessionId: string;
      readonly failedCommit: string;
    }
  | {
      readonly kind: 'reverted';
      readonly projectId: string;
      readonly originalSessionId: string;
      readonly forkSessionId: string;
      readonly revertedCommits: readonly string[];
      readonly copyOutcome: AdoptedCopyOutcome;
    };

async function confirmRevert(
  callbacks: RevertAdoptionCallbacks | undefined,
  info: Parameters<ConfirmRevertAdoption>[0],
): Promise<ConfirmRevertAdoptionAnswer> {
  if (callbacks?.confirmRevert === undefined) {
    return 'unavailable';
  }
  return callbacks.confirmRevert(info);
}

async function confirmDeleteCopy(
  callbacks: RevertAdoptionCallbacks | undefined,
  info: Parameters<ConfirmDeleteAdoptedCopy>[0],
): Promise<ConfirmDeleteAdoptedCopyAnswer> {
  if (callbacks?.confirmDeleteCopy === undefined) {
    return 'unavailable';
  }
  return callbacks.confirmDeleteCopy(info);
}

/**
 * Item 6: deletes the copy without asking when it never wrote anything after being adopted
 * (`unchanged`); otherwise asks, with "keep" as both the explicit decline AND the no-way-to-ask
 * default (item 6's own "resposta padrão é manter" — the one confirmation in this task where
 * `unavailable` and an explicit "no" produce the exact same action, unlike `remove`'s own
 * confirmation, because here NOT acting is always the safe side).
 */
async function resolveAdoptedCopy(
  deps: RevertAdoptionDeps,
  record: AdoptionRecord,
  callbacks: RevertAdoptionCallbacks | undefined,
): Promise<AdoptedCopyOutcome> {
  const check = await deps.forkCleanup.checkForkActivity(record.forkSessionId);
  const growth = decideAdoptedCopyGrowth(check, record.adoptedAt);
  if (growth.kind === 'unchanged') {
    await deps.forkCleanup.deleteFork(record.forkSessionId);
    return { kind: 'deleted' };
  }
  const answer = await confirmDeleteCopy(callbacks, {
    forkSessionId: record.forkSessionId,
    adoptedAt: record.adoptedAt,
    growth,
  });
  if (answer === 'unavailable') {
    return { kind: 'kept', reason: 'confirmationUnavailable' };
  }
  if (answer === 'delete') {
    await deps.forkCleanup.deleteFork(record.forkSessionId);
    return { kind: 'deleted' };
  }
  return { kind: 'kept', reason: growth.kind === 'unknown' ? 'unknownGrowth' : 'grew' };
}

/** Item 3/4: computes the plan (`planAdoptionRevert`), refusing outright when it's `blocked` or
 * there's `nothingToRevert` — neither ever reaches the confirmation question. */
async function planRevert(
  deps: RevertAdoptionDeps,
  root: string,
  projectId: string,
  record: AdoptionRecord,
): Promise<RevertPlan> {
  const sessionCommits = await deps.workspace.findSessionCommits(
    root,
    projectId,
    record.forkSessionId,
  );
  if (sessionCommits.length === 0) {
    return { kind: 'nothingToRevert' };
  }
  const lastSessionCommit = sessionCommits[sessionCommits.length - 1] as { readonly hash: string };
  const laterCommits = await deps.workspace.findCommitsAfter(
    root,
    projectId,
    lastSessionCommit.hash,
  );
  return planAdoptionRevert(sessionCommits, laterCommits);
}

/** The tail of `revertAdoption`, after the lock is already acquired — always releases it before
 * returning (AGENTS.md § "Retorno cedo": kept separate so the lock release is one unmissable line
 * at the end of every path through this function). */
async function performRevert(
  deps: RevertAdoptionDeps,
  root: string,
  projectId: string,
  record: AdoptionRecord,
  callbacks: RevertAdoptionCallbacks | undefined,
): Promise<RevertAdoptionResult> {
  const identity = {
    originalSessionId: record.originalSessionId,
    forkSessionId: record.forkSessionId,
  };
  const plan = await planRevert(deps, root, projectId, record);
  if (plan.kind === 'nothingToRevert') {
    await releaseProjectLock(deps, root, projectId, deps.pid);
    return { kind: 'nothingToRevert', projectId, ...identity };
  }
  if (plan.kind === 'blocked') {
    await releaseProjectLock(deps, root, projectId, deps.pid);
    return { kind: 'blocked', projectId, ...identity, blockingCommit: plan.blockingCommit };
  }

  const answer = await confirmRevert(callbacks, {
    projectId,
    ...identity,
    commitsNewestFirst: plan.commitsNewestFirst,
  });
  if (answer !== 'proceed') {
    await releaseProjectLock(deps, root, projectId, deps.pid);
    return {
      kind: answer === 'decline' ? 'confirmationDeclined' : 'confirmationUnavailable',
      projectId,
      ...identity,
    };
  }

  const message = buildProjectCommitMessage(
    `Revert adoption of session ${record.forkSessionId} from project ${projectId}`,
    projectId,
    deps.sessionId,
  );
  const outcome = await deps.workspace.revertCommits(
    root,
    projectId,
    plan.commitsNewestFirst,
    message,
  );
  if (outcome.kind === 'failed') {
    await releaseProjectLock(deps, root, projectId, deps.pid);
    return { kind: 'revertFailed', projectId, ...identity, failedCommit: outcome.hash };
  }

  await removeAdoptionRecord(deps.storage, record);
  const copyOutcome = await resolveAdoptedCopy(deps, record, callbacks);
  await releaseProjectLock(deps, root, projectId, deps.pid);
  return {
    kind: 'reverted',
    projectId,
    ...identity,
    revertedCommits: plan.commitsNewestFirst,
    copyOutcome,
  };
}

/** Item 3's own "desmarca a sessão original, que volta a poder ser adotada" — always run once the
 * revert itself committed, regardless of what happens to the copy afterward. */
async function removeAdoptionRecord(storage: Storage, record: AdoptionRecord): Promise<void> {
  const all = await storage.readAdoptions();
  await storage.saveAdoptions(
    all.filter(
      (candidate) =>
        !(
          candidate.originalSessionId === record.originalSessionId &&
          candidate.forkSessionId === record.forkSessionId &&
          candidate.projectId === record.projectId
        ),
    ),
  );
}

/**
 * @example
 * const result = await revertAdoption(deps, 'auth-hardening', undefined, {
 *   confirmRevert: ({ commitsNewestFirst }) => askThePerson(commitsNewestFirst),
 *   confirmDeleteCopy: ({ growth }) => askAboutTheCopy(growth),
 * });
 */
export async function revertAdoption(
  deps: RevertAdoptionDeps,
  projectId: string,
  sessionRef: string | undefined,
  callbacks?: RevertAdoptionCallbacks,
): Promise<RevertAdoptionResult> {
  if (!isValidProjectId(projectId)) {
    return { kind: 'invalidId', projectId };
  }
  const root = await resolveWorkspaceRoot(deps.storage, deps.seeyaHome);
  const allAdoptions = await deps.storage.readAdoptions();
  const selection = selectProjectAdoption(allAdoptions, projectId, sessionRef);
  if (selection.kind === 'noneForProject') {
    return { kind: 'noAdoption', projectId };
  }
  if (selection.kind === 'notFound') {
    return { kind: 'sessionNotFound', projectId, sessionRef: sessionRef ?? '' };
  }
  if (selection.kind === 'ambiguous') {
    return { kind: 'ambiguousAdoption', projectId, matches: selection.matches };
  }

  const lock = await acquireProjectLock(
    deps,
    root,
    projectId,
    { pid: deps.pid, procStart: deps.procStart, sessionId: deps.sessionId },
    deps.clock.now(),
  );
  if (lock.decision.kind === 'refuse') {
    return { kind: 'projectLocked', projectId, heldBy: lock.decision.heldBy };
  }

  // V2-T34 production defect (PO review, 2026-09-25): same guaranteed-release fix as the other
  // lock-taking flows in this package — `performRevert` calls `WorkspaceRepository.revertCommits`,
  // which, like `commitAll`, can throw. Idempotent alongside `performRevert`'s own explicit
  // releases (`core/project-lock.ts#decideProjectLockRelease`).
  try {
    return await performRevert(deps, root, projectId, selection.record, callbacks);
  } finally {
    await releaseProjectLock(deps, root, projectId, deps.pid);
  }
}
