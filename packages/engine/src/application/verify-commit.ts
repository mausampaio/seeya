/**
 * `seeya project verify-commit <messageFile>`'s own orchestration (V2-T34 item 1) — the workspace's
 * `commit-msg` git hook (`core/workspace-hooks.ts`) shells out to exactly this. Gathers every fact
 * `core/workspace-commit-guard.ts#decideCommitGuard` needs (the staged files, the draft message, the
 * touched project's lock and its liveness) and applies the decision: write the completed message
 * back, or report why the commit is refused.
 */
import type {
  CommitMessageFile,
  ProcessControl,
  ProjectLock,
  WorkspaceRepository,
} from '../core/ports.js';
import type { LockHolderProcess } from '../core/lock-holder-process.js';
import type { CommitGuardLockFact } from '../core/workspace-commit-guard.js';
import { decideCommitGuard } from '../core/workspace-commit-guard.js';
import { distinctProjectDirs } from '../core/workspace-paths.js';

export interface VerifyCommitDeps {
  readonly workspace: WorkspaceRepository;
  readonly projectLock: ProjectLock;
  readonly processControl: ProcessControl;
  readonly commitMessageFile: CommitMessageFile;
  /** `adapters/workspace/project-lock.ts#PROJECT_LOCK_FILE_NAME`, injected by the composition root
   * — `application/` cannot import `adapters/` (D-020's own matrix). */
  readonly lockFileName: string;
  /** `process.env.CLAUDE_CODE_SESSION_ID`, read once at the composition root, the same value every
   * other `project` subcommand already reads it as (`packages/cli/src/composition.ts
   * #readCurrentSessionId`). */
  readonly currentSessionId: string | undefined;
  /** V2-T34 hotfix (PO review, 2026-09-25): `SEEYA_LOCK_HOLDER_PID`/`SEEYA_LOCK_HOLDER_PROC_START`
   * (`adapters/workspace/lock-holder-env.ts#readLockHolderProcess`), read once at the composition
   * root the same way `currentSessionId` above already is — `core/workspace-commit-guard.ts`'s own
   * docstring on why session id alone can never authorize a commit `seeya` makes while holding the
   * touched project's own lock. */
  readonly currentProcess: LockHolderProcess | undefined;
}

export type VerifyCommitResult =
  { readonly kind: 'allowed' } | { readonly kind: 'refused'; readonly reason: string };

/** `null` when zero or more than one project is touched — `decideCommitGuard` refuses (>1) or
 * doesn't need a lock at all (0) in both those cases, so there is no single project to read a lock
 * for in the first place. */
async function resolveLockFact(
  deps: VerifyCommitDeps,
  root: string,
  stagedFiles: readonly string[],
): Promise<CommitGuardLockFact | null> {
  const projectIds = distinctProjectDirs(stagedFiles);
  const projectId = projectIds.length === 1 ? projectIds[0] : undefined;
  if (projectId === undefined) {
    return null;
  }
  const lock = await deps.projectLock.read(root, projectId);
  if (lock === null) {
    return null;
  }
  const isAlive = await deps.processControl.isAlive(lock.pid, lock.procStart);
  return {
    sessionId: lock.sessionId,
    pid: lock.pid,
    procStart: lock.procStart,
    isAlive,
    acquiredAt: lock.acquiredAt,
  };
}

/**
 * @example
 * const result = await verifyCommit(deps, workspaceRoot, '/tmp/COMMIT_EDITMSG');
 * if (result.kind === 'refused') {
 *   process.stderr.write(`${result.reason}\n`);
 *   process.exit(1);
 * }
 */
export async function verifyCommit(
  deps: VerifyCommitDeps,
  root: string,
  messageFilePath: string,
): Promise<VerifyCommitResult> {
  const [stagedFiles, rawMessage] = await Promise.all([
    deps.workspace.listStagedFiles(root),
    deps.commitMessageFile.read(messageFilePath),
  ]);
  const lock = await resolveLockFact(deps, root, stagedFiles);
  const decision = decideCommitGuard({
    stagedFiles,
    rawMessage,
    currentSessionId: deps.currentSessionId,
    currentProcess: deps.currentProcess,
    lock,
    lockFileName: deps.lockFileName,
  });
  if (decision.kind === 'refuse') {
    return { kind: 'refused', reason: decision.reason };
  }
  if (decision.message !== rawMessage) {
    await deps.commitMessageFile.write(messageFilePath, decision.message);
  }
  return { kind: 'allowed' };
}
