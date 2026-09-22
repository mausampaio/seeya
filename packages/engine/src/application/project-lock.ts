/**
 * Wires `core/project-lock.ts`'s pure decisions to the real `ProjectLock`/`ProcessControl` ports
 * (D-047 item 1). Same split `scheduler/lock.ts` already established for the daemon's own
 * single-instance lock — check/acquire/release, mirrored here for a lock that lives inside a
 * project's own directory instead of `~/.seeya/`. `application/project-open.ts#openProject` is the
 * one production caller (item 4): acquires before opening the harness, releases once it exits.
 */
import type { ProcessControl, ProjectLock } from '../core/ports.js';
import {
  decideProjectLockAcquisition,
  decideProjectLockRelease,
  type ProjectLockAcquisitionDecision,
  type ProjectLockInfo,
  type ProjectLockReleaseDecision,
} from '../core/project-lock.js';

export interface ProjectLockDeps {
  readonly projectLock: ProjectLock;
  readonly processControl: ProcessControl;
}

/** Shared by `checkProjectLock` and `acquireProjectLock` (AGENTS.md: "nada de duplicação") — reads
 * the current lock (if any), checks its `pid`'s liveness via `ProcessControl`, and decides. Passes
 * `existing.procStart` through to `isAlive`, the SAME recycled-pid tie-break
 * `scheduler/lock.ts#checkDaemonLock` already documents for itself (D-047 item 2: "a mesma
 * checagem de vivacidade que o `daemon.lock` já usa" — reused, not reimplemented). */
async function readAndDecide(
  deps: ProjectLockDeps,
  root: string,
  projectId: string,
): Promise<{ existing: ProjectLockInfo | null; decision: ProjectLockAcquisitionDecision }> {
  const existing = await deps.projectLock.read(root, projectId);
  const existingIsAlive =
    existing === null ? false : await deps.processControl.isAlive(existing.pid, existing.procStart);
  return { existing, decision: decideProjectLockAcquisition(existing, existingIsAlive) };
}

/**
 * Never writes anything, so a caller that only wants to know ("is someone else holding this?")
 * doesn't also have to want to acquire — `application/project-open.ts#openProject` uses this
 * SEPARATELY from `acquireProjectLock` for exactly that reason (item 4: open for reading first,
 * decide what to do with the answer, only THEN acquire for real).
 */
export async function checkProjectLock(
  deps: ProjectLockDeps,
  root: string,
  projectId: string,
): Promise<ProjectLockAcquisitionDecision> {
  return (await readAndDecide(deps, root, projectId)).decision;
}

/** What `seeya project open` (V2-T28's own `open`) tells the person right before it takes over
 * their terminal — D-047 item 1's own "aviso" when a stale (dead-process) lock gets reclaimed
 * instead of a genuinely free one. `null` means there was nothing to reclaim at all. */
export interface ProjectLockAcquireOutcome {
  readonly decision: ProjectLockAcquisitionDecision;
  readonly reclaimedStale: ProjectLockInfo | null;
}

/**
 * `checkProjectLock` plus, only on `'acquire'`, the actual write — `holder`'s three fields are all
 * the CALLER's own (the `seeya project open` process's own `pid`/`procStart`, and whatever
 * `CLAUDE_CODE_SESSION_ID` the composition root read), never re-derived here so this file stays
 * free of `node:process`/`adapters/process/`.
 *
 * @example
 * const outcome = await acquireProjectLock(
 *   deps, root, projectId, { pid: process.pid, procStart, sessionId }, clock.now(),
 * );
 * if (outcome.decision.kind === 'refuse') { ... }
 */
export async function acquireProjectLock(
  deps: ProjectLockDeps,
  root: string,
  projectId: string,
  holder: {
    readonly pid: number;
    readonly procStart: string | undefined;
    readonly sessionId: string | undefined;
  },
  now: Date,
): Promise<ProjectLockAcquireOutcome> {
  const { existing, decision } = await readAndDecide(deps, root, projectId);
  if (decision.kind !== 'acquire') {
    return { decision, reclaimedStale: null };
  }
  await deps.projectLock.write(root, projectId, {
    sessionId: holder.sessionId,
    pid: holder.pid,
    procStart: holder.procStart,
    acquiredAt: now,
  });
  // `existing` is non-null here only when it was found DEAD (a live one would have made `decision`
  // `'refuse'` above) — exactly the "stale lock reclaimed" case the caller warns about.
  return { decision, reclaimedStale: existing };
}

/**
 * `seeya project show <id>`'s own view of the lock (D-047 item 5) — three states, never flattened
 * (D-024): a project that was never locked has to read differently from one whose lock exists but
 * is dead, even though BOTH would let `acquireProjectLock` proceed. `checkProjectLock`'s bare
 * `'acquire'`/`'refuse'` collapses exactly that distinction (on purpose, for `project open`, which
 * only cares whether it can proceed) — this is the richer read `show` needs instead, built from
 * the same `readAndDecide`.
 */
export type ProjectLockStatus =
  | { readonly kind: 'unlocked' }
  | { readonly kind: 'heldByLiveSession'; readonly lock: ProjectLockInfo }
  | { readonly kind: 'staleLock'; readonly lock: ProjectLockInfo };

export async function describeProjectLockStatus(
  deps: ProjectLockDeps,
  root: string,
  projectId: string,
): Promise<ProjectLockStatus> {
  const { existing, decision } = await readAndDecide(deps, root, projectId);
  if (existing === null) {
    return { kind: 'unlocked' };
  }
  return decision.kind === 'refuse'
    ? { kind: 'heldByLiveSession', lock: existing }
    : { kind: 'staleLock', lock: existing };
}

/**
 * Releases the lock, but only if `releasingPid` is the pid that actually holds it (D-047 item 1:
 * "liberar lock que não é seu recusa") — `core/project-lock.ts#decideProjectLockRelease` makes the
 * call; this function only clears the file when that decision is `'released'`.
 */
export async function releaseProjectLock(
  deps: Pick<ProjectLockDeps, 'projectLock'>,
  root: string,
  projectId: string,
  releasingPid: number,
): Promise<ProjectLockReleaseDecision> {
  const existing = await deps.projectLock.read(root, projectId);
  const decision = decideProjectLockRelease(existing, releasingPid);
  if (decision.kind === 'released') {
    await deps.projectLock.clear(root, projectId);
  }
  return decision;
}
