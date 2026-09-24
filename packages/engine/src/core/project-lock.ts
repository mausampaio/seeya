/**
 * D-047's project lock: "antes de escrever no projeto, a sessão segura o lock do projeto...
 * lock de processo morto é velho e pode ser tomado, com aviso — a mesma checagem de vivacidade
 * que o `daemon.lock` já usa (pid + `procStart`)." Pure, same split `core/daemon-lock.ts` already
 * established for the daemon's own single-instance lock: given what the lock file already says (or
 * `null`, nothing taken yet) and whether that PID is still alive — a fact only
 * `ProcessControl.isAlive` (`core/ports.ts`) can answer, resolved by the caller before this runs —
 * decide whether a new holder may take the lock.
 *
 * **Reuses the daemon lock's vivacity checking, does not reimplement it (D-047 item 2's own
 * instruction).** This file only mirrors `decideLockAcquisition`'s shape for a different lock
 * location and a different holder identity; the actual pid+`procStart` comparison still happens
 * inside `adapters/process/liveness.ts#resolveIsAlive`, called through the same `ProcessControl`
 * port `core/daemon-lock.ts` already depends on.
 */

/**
 * What `.seeya-lock` records, inside a project's own directory (`adapters/workspace/
 * project-lock.ts`'s on-disk shape) — never inside `~/.seeya/` (D-047 item 2: "mora dentro do
 * projeto, para o agente enxergar") and never committed (the workspace's own `.gitignore` excludes
 * it, `adapters/workspace/index.ts#FsWorkspaceRepository.commitAll`).
 */
export interface ProjectLockInfo {
  /**
   * The Claude Code session holding this lock. **V2-T35 item 4: for a lock `seeya project open`
   * writes, this is always the id `open` itself generated for the session it launched**
   * (`application/project-open.ts#ProjectOpenDeps.launchedSessionId`, `packages/cli/src/
   * composition.ts#buildProjectOpenDeps`'s own `randomUUID()`) — never `process.env
   * .CLAUDE_CODE_SESSION_ID`, which names the CALLER, not the session the lock actually belongs
   * to. Stays `string | undefined` regardless: a `.seeya-lock` left on disk by an OLDER `seeya`
   * (before this task) could still have `undefined` here, and a read has to stay tolerant of that
   * without guessing an identity that isn't there (D-025) — same optionality discipline
   * `core/daemon-lock.ts#DaemonLockInfo.launchedBy` already established for "don't know", never
   * "someone else".
   */
  readonly sessionId: string | undefined;
  /** The `seeya project open` process's own pid — it blocks for the harness's entire interactive
   * lifetime (`core/ports.ts#HarnessLauncher.open`'s own `stdio: 'inherit'` contract), so its
   * liveness IS the lock's liveness: no separate child pid to track. */
  readonly pid: number;
  /** Same recycled-PID tie-break `daemon.lock` already carries (S4-T3b) — `undefined` only when
   * this platform's capture failed for a reason other than "no such process", never read as
   * "dead" (D-025, `core/daemon-lock.ts#DaemonLockInfo.procStart`'s own docstring, unchanged here). */
  readonly procStart: string | undefined;
  /** The instant this lock was taken — D-047 item 1: "o instante em que foi tomado", shown in the
   * refusal message ("held since ..."). */
  readonly acquiredAt: Date;
}

export type ProjectLockAcquisitionDecision =
  { readonly kind: 'acquire' } | { readonly kind: 'refuse'; readonly heldBy: ProjectLockInfo };

/**
 * `existing === null` (nothing taken yet, D-025: absence, not corruption) or `existingIsAlive ===
 * false` (the recorded pid is gone — the previous holder crashed, or the machine restarted without
 * releasing it, D-047 item 2) both resolve to `'acquire'`. Only a live, currently-held lock
 * refuses, naming who holds it and since when — `refuse.heldBy` is the WHOLE existing lock, not
 * just its pid, so a caller can render "held by session X since Y" without a second read.
 *
 * @example
 * const lock = await projectLock.read(root, projectId);
 * const alive = lock === null ? false : await processControl.isAlive(lock.pid, lock.procStart);
 * const decision = decideProjectLockAcquisition(lock, alive);
 */
export function decideProjectLockAcquisition(
  existing: ProjectLockInfo | null,
  existingIsAlive: boolean,
): ProjectLockAcquisitionDecision {
  if (existing === null || !existingIsAlive) {
    return { kind: 'acquire' };
  }
  return { kind: 'refuse', heldBy: existing };
}

/**
 * D-047 item 1: "liberar lock que não é seu recusa." Unlike `daemon.lock` (a singleton the daemon
 * process itself is always the only writer of), a project lock can, in principle, be asked to
 * release by a process that never held it — this is the guard against that: `releasingPid` has to
 * match the pid the lock was actually acquired under.
 *
 * - `notHeld` — nothing to release (D-025: already free is not an error, same discipline
 *   `Storage.clearDaemonLock`'s own docstring already applies).
 * - `refuse` — a DIFFERENT pid currently holds it; `releasingPid` never gets to clear someone
 *   else's lock, alive or not (an application/project-lock.ts caller only ever calls this with its
 *   OWN pid, so this case means a bug or a forged release attempt, never an ordinary path).
 * - `released` — `releasingPid` matches; the caller (`application/project-lock.ts
 *   #releaseProjectLock`) is what actually clears the file.
 */
export type ProjectLockReleaseDecision =
  | { readonly kind: 'released' }
  | { readonly kind: 'notHeld' }
  | { readonly kind: 'refuse'; readonly heldBy: ProjectLockInfo };

export function decideProjectLockRelease(
  existing: ProjectLockInfo | null,
  releasingPid: number,
): ProjectLockReleaseDecision {
  if (existing === null) {
    return { kind: 'notHeld' };
  }
  if (existing.pid !== releasingPid) {
    return { kind: 'refuse', heldBy: existing };
  }
  return { kind: 'released' };
}

/**
 * `seeya project open`'s own outcome for its lock attempt (V2-T33/V2-T35, D-047 items 1/4) — never
 * flattened into a boolean (D-024): `acquired` is the normal case (this session now owns the
 * project, `reclaimedStale` set only when a DEAD lock was reclaimed, D-047 item 1's own "aviso");
 * `readOnly` is item 4's own carve-out — another session's lock is still live, so `open` pauses for
 * a confirmation (V2-T35 item 1) before still running, for reading. Moved here from
 * `application/project-open.ts` (re-exported there unchanged) so `project-lock-message.ts` — pure,
 * shared by `cli/` and `application/` alike — can describe it without either layer reaching into
 * the other (`docs/ARQUITETURA.md`'s matrix: `application` never imports from `cli`).
 */
export type ProjectOpenLockOutcome =
  | { readonly kind: 'acquired'; readonly reclaimedStale: ProjectLockInfo | null }
  | { readonly kind: 'readOnly'; readonly heldBy: ProjectLockInfo };
