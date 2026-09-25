/**
 * `seeya project audit <id>`'s own orchestration (D-047 item 5, V2-T34 item 3) — resolves the
 * project, reads its own "since when" marker, pulls every commit since (or the whole history, the
 * first time), and reports what `core/project-audit.ts#auditCommits` flags as never having gone
 * through the guard. Also called by `application/project-open.ts#openProject`, before the lock is
 * ever taken (item 3's own "chamada também pelo open, antes de tomar o lock") — same function,
 * same report, whichever caller triggers it.
 */
import type { ProjectAuditMarker, Storage, WorkspaceRepository } from '../core/ports.js';
import type { AuditedCommit } from '../core/project-audit.js';
import { auditCommits } from '../core/project-audit.js';
import { isValidProjectId } from '../core/project-id.js';
import { resolveWorkspaceRoot } from './workspace.js';

export interface ProjectAuditDeps {
  readonly storage: Storage;
  readonly workspace: WorkspaceRepository;
  readonly auditMarker: ProjectAuditMarker;
  readonly seeyaHome: string;
  /** `adapters/workspace/project-lock.ts#PROJECT_LOCK_FILE_NAME`, injected — `application/` cannot
   * import `adapters/` (D-020's own matrix), the same reason `application/verify-commit.ts
   * #VerifyCommitDeps.lockFileName` is injected too. */
  readonly lockFileName: string;
}

export interface ProjectAuditReport {
  readonly projectId: string;
  readonly commitsChecked: number;
  readonly escaped: readonly AuditedCommit[];
}

export type AuditProjectOutcome =
  | { readonly kind: 'invalidId'; readonly projectId: string }
  | { readonly kind: 'notFound'; readonly projectId: string }
  | { readonly kind: 'audited'; readonly report: ProjectAuditReport };

/**
 * @example
 * const outcome = await auditProject(deps, 'auth-hardening');
 * if (outcome.kind === 'audited' && outcome.report.escaped.length > 0) {
 *   // something landed in history without going through the commit-msg hook
 * }
 */
export async function auditProject(
  deps: ProjectAuditDeps,
  projectId: string,
): Promise<AuditProjectOutcome> {
  if (!isValidProjectId(projectId)) {
    return { kind: 'invalidId', projectId };
  }
  const root = await resolveWorkspaceRoot(deps.storage, deps.seeyaHome);
  if (!(await deps.workspace.projectExists(root, projectId))) {
    return { kind: 'notFound', projectId };
  }
  const since = await deps.auditMarker.read(root, projectId);
  const commits = await deps.workspace.listCommitsForAudit(root, projectId, since);
  const escaped = auditCommits(projectId, deps.lockFileName, commits);
  const lastCommit = commits[commits.length - 1];
  if (lastCommit !== undefined) {
    await deps.auditMarker.write(root, projectId, lastCommit.hash);
  }
  return {
    kind: 'audited',
    report: { projectId, commitsChecked: commits.length, escaped },
  };
}
