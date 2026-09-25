/**
 * `seeya project audit <id>`'s own pure decision (D-047 item 5, V2-T34 item 3): given every commit
 * inside a project's own history since the last audit, which of them shows a sign that it never
 * went through `core/workspace-commit-guard.ts` at all — history the git hook never got a chance to
 * check, whether because it wasn't installed yet, was bypassed (`git commit --no-verify`), or
 * predates this task entirely. `application/project-audit.ts` gathers the commits (unscoped file
 * lists, so a commit that secretly touched a second project can be caught) and calls this;
 * `application/project-open.ts#openProject` calls the same orchestration before ever taking the
 * lock (item 3's own "chamada também pelo open, antes de tomar o lock").
 *
 * **This is detection, not enforcement — and it can only see what git itself recorded.** A missing
 * or wrong trailer, a commit that reaches into a second project's directory, a commit that staged
 * the lock file: all visible from the commit's own message and file list, so all checked here. What
 * this can NEVER catch: a `Seeya-Session-Id` trailer that's syntactically present and even matches a
 * real session id, but wasn't that session's own commit (a forged identity) — there's nothing in git
 * history to tell a real trailer from a copied one. That's `core/workspace-commit-guard.ts`'s own
 * "onde o guarda-corpo termina" restated for the read side: the guard stops what it can see at
 * commit time; the audit reports what a hook — installed or not, honored or bypassed — would have
 * flagged, after the fact.
 */
import {
  PROJECT_ID_TRAILER_KEY,
  SESSION_ID_TRAILER_KEY,
  extractCommitTrailer,
} from './project-commit.js';
import { distinctProjectDirs } from './workspace-paths.js';

/** One commit's own hash, full message (subject + body + any trailer), and EVERY file it touched —
 * unscoped, unlike `RevertCommitInfo` (`core/ports.ts`), which is deliberately scoped to one
 * project already. Scoping away the audit's own ability to see a second project defeats the one
 * check that needs the unscoped list (`touchesOtherProjects` below). */
export interface AuditableCommit {
  readonly hash: string;
  readonly message: string;
  readonly files: readonly string[];
}

/** D-024: named, not a bag of booleans — each commit can carry more than one reason, and a reader
 * needs to tell "no session trailer at all" apart from "a project trailer that names a different
 * project" without parsing prose. */
export type CommitEscapeReason =
  | { readonly kind: 'missingOrWrongProjectTrailer'; readonly found: string | null }
  | { readonly kind: 'missingSessionTrailer' }
  | { readonly kind: 'touchesOtherProjects'; readonly otherProjects: readonly string[] }
  | { readonly kind: 'includesLockFile' };

export interface AuditedCommit {
  readonly hash: string;
  readonly reasons: readonly CommitEscapeReason[];
}

function auditOneCommit(
  projectId: string,
  lockFileName: string,
  commit: AuditableCommit,
): CommitEscapeReason[] {
  const reasons: CommitEscapeReason[] = [];
  const touched = distinctProjectDirs(commit.files);
  const others = touched.filter((id) => id !== projectId);
  if (others.length > 0) {
    reasons.push({ kind: 'touchesOtherProjects', otherProjects: others });
  }
  if (commit.files.includes(`${projectId}/${lockFileName}`)) {
    reasons.push({ kind: 'includesLockFile' });
  }
  const projectTrailer = extractCommitTrailer(commit.message, PROJECT_ID_TRAILER_KEY);
  if (projectTrailer !== projectId) {
    reasons.push({ kind: 'missingOrWrongProjectTrailer', found: projectTrailer });
  }
  if (extractCommitTrailer(commit.message, SESSION_ID_TRAILER_KEY) === null) {
    reasons.push({ kind: 'missingSessionTrailer' });
  }
  return reasons;
}

/**
 * @example
 * auditCommits('auth-hardening', '.seeya-lock', [
 *   { hash: 'abc', message: 'Fix bug', files: ['auth-hardening/status/current.md'] },
 * ]);
 * // [{ hash: 'abc', reasons: [
 * //   { kind: 'missingOrWrongProjectTrailer', found: null },
 * //   { kind: 'missingSessionTrailer' },
 * // ] }]
 */
export function auditCommits(
  projectId: string,
  lockFileName: string,
  commits: readonly AuditableCommit[],
): AuditedCommit[] {
  const escaped: AuditedCommit[] = [];
  for (const commit of commits) {
    const reasons = auditOneCommit(projectId, lockFileName, commit);
    if (reasons.length > 0) {
      escaped.push({ hash: commit.hash, reasons });
    }
  }
  return escaped;
}
