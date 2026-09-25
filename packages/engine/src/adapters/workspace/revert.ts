/**
 * `WorkspaceRepository.findSessionCommits`/`findCommitsAfter`/`revertCommits`'s own git mechanics
 * (V2-T32, D-047 item 4) — split out of `index.ts` so that file stays about the workspace's
 * ordinary read/write lifecycle, this one about undoing a slice of its history. Everything here
 * still goes through `adapters/git/run-git.ts#runGit`, the same one adapter `index.ts` itself uses
 * — never a second way to shell out to git.
 */
import type { RevertCommitInfo, RevertExecutionOutcome } from '../../core/ports.js';
import type { LockHolderProcess } from '../../core/lock-holder-process.js';
import { SESSION_ID_TRAILER_KEY } from '../../core/project-commit.js';
import { runGit } from '../git/run-git.js';
import { buildLockHolderEnv } from './lock-holder-env.js';

const COMMIT_IDENTITY_ENV: NodeJS.ProcessEnv = {
  GIT_AUTHOR_NAME: 'seeya',
  GIT_AUTHOR_EMAIL: 'seeya@localhost',
  GIT_COMMITTER_NAME: 'seeya',
  GIT_COMMITTER_EMAIL: 'seeya@localhost',
};

function parseHashLines(stdout: string): string[] {
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** The files ONE commit changed, scoped to `projectId` (the same scoping `commitAll`'s own `git
 * add` and `listChangedFiles`'s own `git status` already use) — a workspace-wide file like
 * `.gitignore` never counts as something a project's own session "touched". */
async function filesChangedInCommit(
  root: string,
  projectId: string,
  hash: string,
): Promise<readonly string[]> {
  const show = await runGit(root, ['show', '--name-only', '--format=', hash, '--', projectId]);
  if (!show.ran || show.exitCode !== 0) {
    throw new Error(
      `git show failed in workspace at "${root}" for commit ${hash}: ` +
        `${show.ran ? `exit ${show.exitCode}` : show.reason}`,
    );
  }
  return parseHashLines(show.stdout);
}

/** `hashes` (already the right order — oldest or newest first, whichever the caller resolved) each
 * paired with the files IT changed. Shared by `findSessionCommits`/`findCommitsAfter` below, the
 * one place that turns a bare hash list into `RevertCommitInfo[]` (AGENTS.md: "nada de
 * duplicação"). */
export async function commitsWithFiles(
  root: string,
  projectId: string,
  hashes: readonly string[],
): Promise<RevertCommitInfo[]> {
  const commits: RevertCommitInfo[] = [];
  // Sequential, not `Promise.all`: each `git show` shares the same working tree/index as every
  // other git call this adapter makes against `root`, and the project has no volume of commits
  // that would make this loop's own latency worth the concurrency risk.
  for (const hash of hashes) {
    commits.push({ hash, files: await filesChangedInCommit(root, projectId, hash) });
  }
  return commits;
}

export async function findSessionCommits(
  root: string,
  projectId: string,
  sessionId: string,
): Promise<RevertCommitInfo[]> {
  const trailer = `${SESSION_ID_TRAILER_KEY}: ${sessionId}`;
  const log = await runGit(root, [
    'log',
    '--reverse',
    '--format=%H',
    '-F',
    `--grep=${trailer}`,
    '--',
    projectId,
  ]);
  if (!log.ran || log.exitCode !== 0) {
    throw new Error(
      `git log failed in workspace at "${root}": ${log.ran ? `exit ${log.exitCode}` : log.reason}`,
    );
  }
  return commitsWithFiles(root, projectId, parseHashLines(log.stdout));
}

export async function findCommitsAfter(
  root: string,
  projectId: string,
  afterCommit: string,
): Promise<RevertCommitInfo[]> {
  const log = await runGit(root, [
    'log',
    '--reverse',
    '--format=%H',
    `${afterCommit}..HEAD`,
    '--',
    projectId,
  ]);
  if (!log.ran || log.exitCode !== 0) {
    throw new Error(
      `git log failed in workspace at "${root}": ${log.ran ? `exit ${log.exitCode}` : log.reason}`,
    );
  }
  return commitsWithFiles(root, projectId, parseHashLines(log.stdout));
}

/** Reverts one commit without creating a commit for it — `null` on success, the raw failure reason
 * otherwise (never thrown: the caller decides whether to abort the whole sequence). */
async function revertOneWithoutCommitting(root: string, hash: string): Promise<string | null> {
  const revert = await runGit(root, ['revert', '--no-commit', '--no-edit', hash]);
  if (revert.ran && revert.exitCode === 0) {
    return null;
  }
  return revert.ran ? `exit ${revert.exitCode}` : revert.reason;
}

/**
 * Applies `commitsNewestFirst` with `git revert --no-commit`, in order, then makes ONE commit with
 * `message` — or aborts the whole sequence (`git revert --abort`) at the first one that doesn't
 * apply cleanly, per `core/ports.ts#WorkspaceRepository.revertCommits`'s own docstring on why a
 * partial revert is never left behind.
 */
export async function revertCommitSequence(
  root: string,
  commitsNewestFirst: readonly string[],
  message: string,
  lockHolder?: LockHolderProcess,
): Promise<RevertExecutionOutcome> {
  for (const hash of commitsNewestFirst) {
    const failureReason = await revertOneWithoutCommitting(root, hash);
    if (failureReason !== null) {
      await runGit(root, ['revert', '--abort']);
      return { kind: 'failed', hash, reason: failureReason };
    }
  }
  // Same "no-op, not an empty commit" check `commitAll` already runs before committing — a
  // sequence of reverts that cancels out to a net-zero diff against `HEAD` is a real, if rare,
  // possibility (e.g. reverting an add immediately followed by reverting its own removal).
  const diff = await runGit(root, ['diff', '--cached', '--quiet']);
  if (diff.ran && diff.exitCode === 0) {
    return { kind: 'noChanges' };
  }
  if (!diff.ran) {
    throw new Error(`git diff failed in workspace at "${root}": ${diff.reason}`);
  }
  // V2-T34 hotfix (PO review, 2026-09-25): same lock-holder authorization `index.ts#commitAll`
  // already has — a revert's own final commit is exactly the kind of "seeya committing while
  // holding the project's own lock" this fix targets.
  const commit = await runGit(root, ['commit', '-m', message], {
    ...process.env,
    ...COMMIT_IDENTITY_ENV,
    ...buildLockHolderEnv(lockHolder),
  });
  if (!commit.ran || commit.exitCode !== 0) {
    throw new Error(
      `git commit failed in workspace at "${root}": ` +
        `${commit.ran ? `exit ${commit.exitCode}` : commit.reason}`,
    );
  }
  return { kind: 'committed' };
}
