/**
 * `application/project-adopt.ts`'s own "what happened after the fork's interactive harness
 * closed" — split out (V2-T72) so that file stays under the ~500-line ceiling AGENTS.md sets for
 * a single responsibility. This one: read what the copy left behind (both committed and
 * uncommitted), ask about what's pending when there's someone to ask, and decide the outcome.
 * `adoptSession` itself (still in `project-adopt.ts`) only calls `finishAdoption` — everything in
 * here is a private implementation detail of that one call.
 */
import type { RevertCommitInfo } from '../core/ports.js';
import { buildProjectCommitMessage } from '../core/project-commit.js';
import type {
  AdoptSessionCallbacks,
  AdoptSessionDeps,
  AdoptSessionResult,
  ConfirmAdoptionAnswer,
} from './project-adopt-types.js';

/** Item 2's own cleanup for both "declined" and "nothing to confirm": deletes the fork's transcript
 * (the D-012 exception, `ForkCleanup.deleteFork`) and drops its `forks.json` entry
 * (`ForkRegistration.unregister`) — "a cópia é apagada e nada fica registrado". */
async function discardFork(deps: AdoptSessionDeps): Promise<void> {
  await deps.forkCleanup.deleteFork(deps.forkSessionId);
  await deps.forkRegistration.unregister(deps.forkSessionId);
}

/** V2-T72 item 1: the deduplicated set of files across every commit `findSessionCommits` found for
 * the fork — `RevertCommitInfo.files` is already scoped to `projectId` (same scoping `commitAll`'s
 * own `git add <projectId>` uses), so no filtering is needed here, only flattening. */
function uniqueCommittedFiles(commits: readonly RevertCommitInfo[]): readonly string[] {
  const files = new Set<string>();
  for (const commit of commits) {
    for (const file of commit.files) {
      files.add(file);
    }
  }
  return [...files];
}

/** Item 4's own promotion, now item 1's own registration path (V2-T72): drops the `forks.json`
 * entry WITHOUT deleting the transcript (unlike `discardFork` — this fork is being kept) and
 * records the adoption so the original can never be adopted again. Split out of `commitAdoption`
 * so the "copy already committed everything itself, nothing left to ask" path (`decideAdoptionOutcome`
 * below) can register without ever calling `commitAll` for a diff that doesn't exist — `commitAll`
 * itself would no-op on it, but skipping the call avoids writing a commit message for a commit that
 * never happens. */
async function registerAdoption(
  deps: AdoptSessionDeps,
  projectId: string,
  originalSessionId: string,
  changedFiles: readonly string[],
  alreadyCommittedFiles: readonly string[],
  pendingFiles: readonly string[],
  now: Date,
  pendingCommitFailedReason?: string,
): Promise<AdoptSessionResult> {
  await deps.forkRegistration.unregister(deps.forkSessionId);
  const adoptions = await deps.storage.readAdoptions();
  await deps.storage.saveAdoptions([
    ...adoptions,
    { originalSessionId, forkSessionId: deps.forkSessionId, projectId, adoptedAt: now },
  ]);
  // `exactOptionalPropertyTypes` (tsconfig): `pendingCommitFailedReason` is only ever SET, never
  // explicitly `undefined` — the ordinary case (no failure) omits the key entirely instead.
  return {
    kind: 'adopted',
    projectId,
    forkSessionId: deps.forkSessionId,
    changedFiles,
    alreadyCommittedFiles,
    pendingFiles,
    ...(pendingCommitFailedReason === undefined ? {} : { pendingCommitFailedReason }),
  };
}

/** The person said "commit" to what's still pending: writes it with the fork's own identity in
 * the trailer (D-047 item 6: the fork IS the project's session from here on), then registers via
 * `registerAdoption`.
 *
 * V2-T72 item 1: when the copy already left commits of its own behind (`alreadyCommittedFiles`
 * non-empty), a failure here no longer reports the flat `commitFailed` refusal — that would leave
 * the fork registered as merely "pending" in `forks.json`, exposed to `forkCleanupDays` eventually
 * deleting real, already-committed work just because ONE MORE commit attempt on top of it failed.
 * Instead the adoption is still registered, with the failure named in `pendingCommitFailedReason`
 * so the person can finish it later via `seeya project open`. Without any prior commits, the
 * pre-existing `commitFailed` behavior is unchanged — that fork still has nothing on the record
 * worth protecting from cleanup yet. */
async function commitAdoption(
  deps: AdoptSessionDeps,
  root: string,
  projectId: string,
  originalSessionId: string,
  changedFiles: readonly string[],
  alreadyCommittedFiles: readonly string[],
  now: Date,
): Promise<AdoptSessionResult> {
  const message = buildProjectCommitMessage(
    `Adopt session ${originalSessionId} into project ${projectId}`,
    projectId,
    deps.forkSessionId,
  );
  // V2-T34 production defect (PO review, 2026-09-25): caught here, not left to propagate — a
  // refused commit (most often the workspace's own git hook) is an EXPECTED outcome this function
  // reports through its own return type (`AdoptSessionResult`'s own `commitFailed`), the same way
  // `decideAdoptionOutcome`'s `declined` branch already does for "the person said no." Nothing
  // below this catch runs: the fork stays registered pending, the files stay on disk, no
  // `adoptions.json` entry — exactly the state a later `seeya project adopt` retry needs to find.
  try {
    // V2-T34 hotfix (PO review, 2026-09-25): this commit is made WHILE this adoption holds the
    // project's lock (under `deps.forkSessionId`, never a session the environment's own
    // CLAUDE_CODE_SESSION_ID could ever equal) — `lockHolder` is how the workspace's own
    // commit-msg hook recognizes it anyway.
    await deps.workspace.commitAll(root, projectId, message, {
      pid: deps.pid,
      procStart: deps.procStart,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (alreadyCommittedFiles.length > 0) {
      return registerAdoption(
        deps,
        projectId,
        originalSessionId,
        [],
        alreadyCommittedFiles,
        changedFiles,
        now,
        reason,
      );
    }
    return {
      kind: 'commitFailed',
      projectId,
      forkSessionId: deps.forkSessionId,
      changedFiles,
      reason,
    };
  }
  return registerAdoption(
    deps,
    projectId,
    originalSessionId,
    changedFiles,
    alreadyCommittedFiles,
    [],
    now,
  );
}

/** Asks `callbacks.confirmCommit`, or resolves `'unavailable'` when none was given (D-025 — same
 * "never a silent default" `application/project-open.ts#confirmReadOnlyOpen` already applies). */
async function confirmCommit(
  callbacks: AdoptSessionCallbacks | undefined,
  changedFiles: readonly string[],
): Promise<ConfirmAdoptionAnswer> {
  if (callbacks?.confirmCommit === undefined) {
    return 'unavailable';
  }
  return callbacks.confirmCommit(changedFiles);
}

/** What to do once the fork session has closed AND the person (or the absence of one) has
 * answered — the three-way branch item 4's spec describes (now four, with `commitFailed`), kept
 * separate from `finishAdoption` so each concern reads on its own.
 *
 * **V2-T72 item 1's own fix — the bug the maintainer found in production, 2026-09-30.** Before
 * this, `changedFiles.length === 0` always meant `discardFork` + `noChanges`, even when the copy
 * had already committed its work itself — legitimate, under D-047 item 4 ("quem segura o lock
 * commita"), since it held the project's own lock the entire time. Deleting that fork threw away
 * real, already-committed work. `alreadyCommittedFiles` (found by `finishAdoption` below, via the
 * fork's own `Seeya-Session-Id` trailer) now decides which path applies: with prior commits,
 * `changedFiles.length === 0` means "the copy committed everything itself and left nothing
 * pending" — an adoption on its own, registered without asking anything. With prior commits AND
 * something still uncommitted, the person is still asked about the pending part only, but
 * whatever they answer (`decline`/`unavailable`), the adoption is registered anyway — the fork is
 * never discarded once it has left so much as one commit behind. */
async function decideAdoptionOutcome(
  deps: AdoptSessionDeps,
  root: string,
  projectId: string,
  originalSessionId: string,
  changedFiles: readonly string[],
  alreadyCommittedFiles: readonly string[],
  callbacks: AdoptSessionCallbacks | undefined,
): Promise<AdoptSessionResult> {
  const hasPriorCommits = alreadyCommittedFiles.length > 0;
  const now = deps.clock.now();
  if (changedFiles.length === 0) {
    if (!hasPriorCommits) {
      await discardFork(deps);
      return { kind: 'noChanges', projectId, forkSessionId: deps.forkSessionId };
    }
    return registerAdoption(deps, projectId, originalSessionId, [], alreadyCommittedFiles, [], now);
  }
  const answer = await confirmCommit(callbacks, changedFiles);
  if (answer === 'commit') {
    return commitAdoption(
      deps,
      root,
      projectId,
      originalSessionId,
      changedFiles,
      alreadyCommittedFiles,
      now,
    );
  }
  if (!hasPriorCommits) {
    if (answer === 'decline') {
      await discardFork(deps);
      return { kind: 'declined', projectId, forkSessionId: deps.forkSessionId, changedFiles };
    }
    return {
      kind: 'confirmationUnavailable',
      projectId,
      forkSessionId: deps.forkSessionId,
      changedFiles,
    };
  }
  // The copy already left commits behind — declining (or having no terminal to ask through)
  // leaves `changedFiles` uncommitted, but the adoption still registers (see docstring above).
  return registerAdoption(
    deps,
    projectId,
    originalSessionId,
    [],
    alreadyCommittedFiles,
    changedFiles,
    now,
  );
}

/** The tail of `adoptSession`, after the fork's interactive harness has already closed: reads what
 * changed inside the project (`listChangedFiles`) AND what the copy already committed on its own
 * while it held the lock (`findSessionCommits` against its own `forkSessionId`, V2-T72 item 1),
 * then decides the outcome (item 4). Lock release is no longer done here — `adoptSession`'s own
 * `finally` is the single place that happens now, so it also covers a throw from THIS function's
 * own calls, not just their normal return. */
export async function finishAdoption(
  deps: AdoptSessionDeps,
  root: string,
  projectId: string,
  originalSessionId: string,
  callbacks: AdoptSessionCallbacks | undefined,
): Promise<AdoptSessionResult> {
  const changedFiles = await deps.workspace.listChangedFiles(root, projectId);
  const priorCommits = await deps.workspace.findSessionCommits(root, projectId, deps.forkSessionId);
  const alreadyCommittedFiles = uniqueCommittedFiles(priorCommits);
  return decideAdoptionOutcome(
    deps,
    root,
    projectId,
    originalSessionId,
    changedFiles,
    alreadyCommittedFiles,
    callbacks,
  );
}
