/**
 * V2-T34 hotfix (PO review, 2026-09-25): a `seeya` process's own pid + process-start-time pair — a
 * SECOND way (besides a Claude Code session id) the workspace's own commit-msg hook can recognize
 * "this commit comes from the exact process that holds the touched project's lock." Every commit
 * `seeya` itself makes WHILE holding a project's lock (`open`'s own leftover-changes commit, an
 * adoption's commit, `remove`/`remove-repo`/`revert-adoption`) needs this: none of them ever run
 * INSIDE the Claude Code session the lock nominally belongs to (the lock's `sessionId` is either a
 * freshly generated id `open`/`adopt` invented for a session that hasn't started yet, or simply
 * absent — `core/workspace-commit-guard.ts`'s own docstring on why `CLAUDE_CODE_SESSION_ID` alone
 * can never authorize these). `core/workspace-commit-guard.ts#decideCommitGuard` is what actually
 * uses this fact; `adapters/workspace/lock-holder-env.ts` is the one place that turns it into, and
 * back out of, the two environment variables that carry it across the `git commit` process
 * boundary (`core/` cannot do that itself — no `node:*`, no environment, D-020's own matrix).
 *
 * Same shape as `ProjectLockInfo`'s own `pid`/`procStart` pair (`core/project-lock.ts`) —
 * deliberately not reused wholesale: a `ProjectLockInfo` also carries `sessionId`/`acquiredAt`,
 * neither of which describes "the process currently trying to commit."
 */
export interface LockHolderProcess {
  readonly pid: number;
  /** Same recycled-pid tie-break tolerance `ProjectLockInfo.procStart`/`daemon.lock`'s own
   * `procStart` already carry — `undefined` only when this platform's capture failed, never read
   * as "no process" (D-025). */
  readonly procStart: string | undefined;
}
