/**
 * D-047's own "guarda" (V2-T34 item 1): the pure decision behind the workspace's `commit-msg` git
 * hook. `application/verify-commit.ts` gathers the facts (staged files, the raw message, the
 * project's own lock and its liveness) and this function decides what the hook does with them —
 * silently complete the two commit trailers a commit is missing, or refuse with a reason a person
 * (or a session) can act on. Pure: no git, no filesystem, no process check — every fact arrives
 * already resolved, the same split `core/project-lock.ts#decideProjectLockAcquisition` already
 * draws for the lock itself.
 *
 * **What this refuses, precisely — and what it doesn't (item 7's own "onde o guarda-corpo
 * termina").** Refuses: a commit that stages files inside more than one project directory; a
 * commit that stages the project's own `.seeya-lock`; a commit into a project whose lock is held by
 * a DIFFERENT, live session; a commit message whose trailer already contradicts what this guard
 * independently knows. Passes, unchanged: a commit that touches no project directory at all (e.g.
 * only the workspace's own top-level `.gitignore`) — D-047 has nothing to say about that. A commit
 * made by hand, with no `CLAUDE_CODE_SESSION_ID` in the environment and the project's lock free (or
 * stale), always passes too — attributed to session `unknown` (D-025,
 * `core/project-commit.ts#UNKNOWN_SESSION_TRAILER_VALUE`), never refused for lacking an identity
 * nobody claimed.
 *
 * **Where it can't reach at all, documented rather than silently absent.** This can't detect a
 * forged `CLAUDE_CODE_SESSION_ID` (the hook trusts the environment it's handed, the same way every
 * other reader of that variable in this project already does), and it never runs at all for a
 * commit made with `git commit --no-verify` — `core/harness-hook-config.ts` covers that second gap
 * from inside the one harness this project drives, for a session that reaches the project through
 * its own `cwd` (V2-T34 item 2's own docstring on where THAT layer stops, too). Neither one covers
 * history rewritten after the fact outside any hook at all — `seeya project audit` is what looks at
 * what already landed and reports what escaped, later (`core/project-audit.ts`).
 *
 * **V2-T34 hotfix (PO review, 2026-09-25): a same-process authorization, alongside the session
 * one.** The maintainer found, on real use, that EVERY commit `seeya` itself makes while holding a
 * project's own lock was refused by this very guard — `open`'s own leftover-changes commit, an
 * adoption's commit, `remove`/`remove-repo`/`revert-adoption` — because none of them run inside a
 * Claude Code session whose `CLAUDE_CODE_SESSION_ID` happens to equal the lock's `sessionId` (that
 * field is either a freshly generated id `open`/`adopt` invented for a session that hasn't started
 * running yet, or simply absent when `seeya` runs from a plain terminal or the packaged app — and
 * an ABSENT `lock.sessionId` was never treated as matching an ABSENT `currentSessionId` either,
 * D-025's own "don't guess an identity" cutting the wrong way here). `decideSessionConflict` now
 * ALSO accepts a commit whose `currentProcess` (`LockHolderProcess`, `core/lock-holder-process.ts`)
 * matches the lock's own `pid`/`procStart` — the process itself, not a session inside it, is who's
 * asking. **Where THIS one ends (same "cobre o descuido" discipline as the session id above):** a
 * forged `SEEYA_LOCK_HOLDER_PID`/`SEEYA_LOCK_HOLDER_PROC_START` pair that happens to match a real
 * lock authorizes the commit the same way the real thing would — this covers the same class of
 * accident the session id already covers, never a deliberate attempt to defeat the guard from a
 * shell that already has permission to set arbitrary environment variables in the first place.
 */
import type { LockHolderProcess } from './lock-holder-process.js';
import {
  PROJECT_ID_TRAILER_KEY,
  SESSION_ID_TRAILER_KEY,
  UNKNOWN_SESSION_TRAILER_VALUE,
  extractCommitTrailer,
} from './project-commit.js';
import { distinctProjectDirs } from './workspace-paths.js';

/** What the guard needs to know about a project's lock — a subset of `ProjectLockInfo`
 * (`core/project-lock.ts`) plus the liveness fact only `ProcessControl.isAlive` can resolve
 * (`application/verify-commit.ts` is what resolves it before calling this function). */
export interface CommitGuardLockFact {
  readonly sessionId: string | undefined;
  readonly pid: number;
  /** V2-T34 hotfix: compared against `CommitGuardInput.currentProcess` for the same-process
   * authorization above — `ProjectLockInfo.procStart`'s own tolerance (D-025), unchanged here. */
  readonly procStart: string | undefined;
  readonly isAlive: boolean;
  readonly acquiredAt: Date;
}

export interface CommitGuardInput {
  /** `git diff --cached --name-only` at the moment `commit-msg` runs, workspace-relative, always
   * forward-slash separated (git's own convention, even on Windows). */
  readonly stagedFiles: readonly string[];
  /** The commit-msg hook's own temp file content — subject, optional body, and any trailer a
   * person or a session already typed by hand. */
  readonly rawMessage: string;
  /** `process.env.CLAUDE_CODE_SESSION_ID`, read by `application/verify-commit.ts` at the same spot
   * every other reader of this variable in this project does (composition-root-adjacent, never
   * inside `core/`). */
  readonly currentSessionId: string | undefined;
  /** V2-T34 hotfix: `SEEYA_LOCK_HOLDER_PID`/`SEEYA_LOCK_HOLDER_PROC_START`, read by
   * `application/verify-commit.ts`'s own caller the same composition-root-adjacent way
   * `currentSessionId` already is. `undefined` for an ordinary commit `seeya` isn't making while
   * holding the touched project's own lock (a person's own `git commit`, most commonly). */
  readonly currentProcess: LockHolderProcess | undefined;
  /** `null` when the touched project has never had a lock taken (D-025) — never confused with a
   * lock that WAS taken but died, which is `{ ..., isAlive: false }` instead. */
  readonly lock: CommitGuardLockFact | null;
  /** `adapters/workspace/project-lock.ts#PROJECT_LOCK_FILE_NAME` — passed in rather than imported,
   * since `core/` cannot import from `adapters/` (D-020's own matrix). */
  readonly lockFileName: string;
}

/** `allow.message` is the message the hook should actually write back to the commit-msg file — the
 * original text, or the original text with the missing trailer(s) appended. `refuse.reason` is
 * printed to the person/session verbatim (AGENTS.md § "Mensagens de erro": names what's wrong and
 * what to do about it), and becomes the hook's own non-zero exit. */
export type CommitGuardDecision =
  | { readonly kind: 'allow'; readonly message: string }
  | { readonly kind: 'refuse'; readonly reason: string };

/** D-024: named, not a boolean — a commit that's fine either has no conflict to speak of, or was
 * authorized specifically by the SAME-PROCESS check (`authorizedBySameProcess: true`), a
 * distinction `decideCommitGuard` needs below to decide whether an ALREADY-WRITTEN session trailer
 * should be trusted as-is (V2-T34 hotfix item 2) rather than recomputed and possibly contradicted. */
type SessionConflictOutcome =
  | { readonly kind: 'ok'; readonly authorizedBySameProcess: boolean }
  | { readonly kind: 'conflict'; readonly reason: string };

function isLockHolderProcess(
  currentProcess: LockHolderProcess | undefined,
  lock: CommitGuardLockFact,
): boolean {
  if (currentProcess === undefined) {
    return false;
  }
  return currentProcess.pid === lock.pid && currentProcess.procStart === lock.procStart;
}

/** `'ok'` for a free lock, a stale (dead-process) one, a live one this same SESSION already holds,
 * or — the V2-T34 hotfix — a live one this same PROCESS holds (`isLockHolderProcess` above).
 * Otherwise the refusal text, naming who holds it and since when
 * (`core/project-lock-message.ts#formatLockHolderDescription`'s own wording, duplicated in spirit
 * rather than imported: that module formats a full `ProjectLockInfo`, this one only ever has the
 * narrower `CommitGuardLockFact`). */
function decideSessionConflict(
  projectId: string,
  currentSessionId: string | undefined,
  currentProcess: LockHolderProcess | undefined,
  lock: CommitGuardLockFact | null,
): SessionConflictOutcome {
  if (lock === null || !lock.isAlive) {
    return { kind: 'ok', authorizedBySameProcess: false };
  }
  if (lock.sessionId !== undefined && lock.sessionId === currentSessionId) {
    return { kind: 'ok', authorizedBySameProcess: false };
  }
  if (isLockHolderProcess(currentProcess, lock)) {
    return { kind: 'ok', authorizedBySameProcess: true };
  }
  const holder =
    lock.sessionId === undefined ? 'an unidentified session' : `session ${lock.sessionId}`;
  return {
    kind: 'conflict',
    reason:
      `project "${projectId}" is locked by ${holder} (pid ${lock.pid}) since ` +
      `${lock.acquiredAt.toISOString()} — only that session may commit here until it releases the ` +
      'lock (D-047 item 4).',
  };
}

type TrailerCheck =
  | { readonly kind: 'present' }
  | { readonly kind: 'missing' }
  | { readonly kind: 'conflict'; readonly reason: string };

function decideTrailerValue(existing: string | null, computed: string, key: string): TrailerCheck {
  if (existing === null) {
    return { kind: 'missing' };
  }
  if (existing === computed) {
    return { kind: 'present' };
  }
  return {
    kind: 'conflict',
    reason:
      `this commit message already has "${key}: ${existing}", but it should be ` +
      `"${key}: ${computed}" — remove the trailer and let it be added automatically.`,
  };
}

/** Appends only the trailer(s) actually missing — a trailer already present with the right value is
 * left exactly where it was, never duplicated.
 *
 * `trustExistingSessionTrailer` (V2-T34 hotfix item 2): when the same-process check authorized
 * this commit, an ALREADY-PRESENT `Seeya-Session-Id` trailer is accepted verbatim, never compared
 * against `sessionId` — `sessionId` in that case is at best a fallback for a MISSING trailer
 * (`decideCommitGuard`'s own computation below), never a value the trailer that's already there
 * could be said to "contradict." Without this, `open`'s own leftover-changes commit (trailer
 * deliberately `unknown`, D-025 — nobody present can say whose it was) would be refused by THIS
 * function for "not matching" the lock's own `sessionId` (`launchedSessionId`, a real id that
 * describes the lock, not who wrote this particular catch-up commit) — the exact defect the
 * maintainer found. */
function decideTrailers(
  rawMessage: string,
  projectId: string,
  sessionId: string,
  trustExistingSessionTrailer: boolean,
): CommitGuardDecision {
  const project = decideTrailerValue(
    extractCommitTrailer(rawMessage, PROJECT_ID_TRAILER_KEY),
    projectId,
    PROJECT_ID_TRAILER_KEY,
  );
  if (project.kind === 'conflict') {
    return { kind: 'refuse', reason: project.reason };
  }
  const existingSession = extractCommitTrailer(rawMessage, SESSION_ID_TRAILER_KEY);
  const session: TrailerCheck =
    trustExistingSessionTrailer && existingSession !== null
      ? { kind: 'present' }
      : decideTrailerValue(existingSession, sessionId, SESSION_ID_TRAILER_KEY);
  if (session.kind === 'conflict') {
    return { kind: 'refuse', reason: session.reason };
  }
  if (project.kind === 'present' && session.kind === 'present') {
    return { kind: 'allow', message: rawMessage };
  }
  const missing: string[] = [];
  if (project.kind === 'missing') {
    missing.push(`${PROJECT_ID_TRAILER_KEY}: ${projectId}`);
  }
  if (session.kind === 'missing') {
    missing.push(`${SESSION_ID_TRAILER_KEY}: ${sessionId}`);
  }
  const trimmed = rawMessage.replace(/\s+$/, '');
  return { kind: 'allow', message: `${trimmed}\n\n${missing.join('\n')}\n` };
}

/**
 * @example
 * decideCommitGuard({
 *   stagedFiles: ['auth-hardening/status/current.md'],
 *   rawMessage: 'Write the current status\n',
 *   currentSessionId: '11111111-1111-4111-8111-111111111111',
 *   currentProcess: undefined,
 *   lock: null,
 *   lockFileName: '.seeya-lock',
 * });
 * // { kind: 'allow', message: 'Write the current status\n\nSeeya-Project-Id: auth-hardening\n
 * //   Seeya-Session-Id: 11111111-1111-4111-8111-111111111111\n' }
 */
export function decideCommitGuard(input: CommitGuardInput): CommitGuardDecision {
  const projectIds = distinctProjectDirs(input.stagedFiles);
  if (projectIds.length > 1) {
    return {
      kind: 'refuse',
      reason:
        `this commit touches ${projectIds.length} projects (${[...projectIds].sort().join(', ')}) ` +
        '— one project per commit (D-047 item 4). Split it into separate commits.',
    };
  }
  const projectId = projectIds[0];
  if (projectId === undefined) {
    // `projectIds.length === 0` — nothing project-scoped staged at all (this function's own
    // docstring on why that always passes, unchanged).
    return { kind: 'allow', message: input.rawMessage };
  }
  const lockFilePath = `${projectId}/${input.lockFileName}`;
  if (input.stagedFiles.includes(lockFilePath)) {
    return {
      kind: 'refuse',
      reason:
        `this commit stages the project lock (${lockFilePath}) — it is never committed ` +
        `(D-047 item 2). Unstage it: git restore --staged ${lockFilePath}`,
    };
  }
  const conflict = decideSessionConflict(
    projectId,
    input.currentSessionId,
    input.currentProcess,
    input.lock,
  );
  if (conflict.kind === 'conflict') {
    return { kind: 'refuse', reason: conflict.reason };
  }
  // V2-T34 hotfix item 2: authorized by the SAME-PROCESS check, `lock.sessionId` never enters the
  // fallback chain — it describes the lock, not who wrote THIS commit, and could contradict a
  // trailer seeya itself already wrote correctly (`decideTrailers`'s own docstring has the full
  // reasoning, and `trustExistingSessionTrailer` below is what actually protects it either way).
  const sessionId = conflict.authorizedBySameProcess
    ? (input.currentSessionId ?? UNKNOWN_SESSION_TRAILER_VALUE)
    : (input.currentSessionId ?? input.lock?.sessionId ?? UNKNOWN_SESSION_TRAILER_VALUE);
  return decideTrailers(input.rawMessage, projectId, sessionId, conflict.authorizedBySameProcess);
}
