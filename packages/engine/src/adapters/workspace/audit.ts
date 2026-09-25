/**
 * `WorkspaceRepository.listCommitsForAudit`'s own git mechanics (V2-T34 item 3, D-047 item 5) —
 * split out of `index.ts` the same way `revert.ts` already is, for the same reason: this file is
 * about reading a slice of history, not the workspace's ordinary read/write lifecycle. Everything
 * here still goes through `adapters/git/run-git.ts#runGit`.
 *
 * **Deliberately its own, smaller sibling of `revert.ts#commitsWithFiles` — not a reuse of it.**
 * That function scopes `git show --name-only` to one project's own directory (`-- projectId`), on
 * purpose: `core/project-audit.ts`'s own `touchesOtherProjects` check needs to see EVERY file a
 * commit touched, in every project, or a commit that secretly reached into a second project would
 * look identical to one that didn't.
 */
import type { AuditableCommit } from '../../core/project-audit.js';
import { runGit } from '../git/run-git.js';

function parseLines(stdout: string): string[] {
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

async function readCommitMessage(root: string, hash: string): Promise<string> {
  const result = await runGit(root, ['log', '-1', '--format=%B', hash]);
  if (!result.ran || result.exitCode !== 0) {
    throw new Error(
      `git log failed in workspace at "${root}" for commit ${hash}: ` +
        `${result.ran ? `exit ${result.exitCode}` : result.reason}`,
    );
  }
  // `%B` already ends with its own trailing newline; trimmed once so callers compare/parse a plain
  // string, the same convention `core/project-commit.ts#buildProjectCommitMessage` produces.
  return result.stdout.replace(/\n$/, '');
}

/** Every file `hash` touched, in every project — UNSCOPED, unlike
 * `revert.ts#filesChangedInCommit`'s own `-- projectId` restriction (this file's own module
 * comment on why). */
async function readUnscopedFiles(root: string, hash: string): Promise<readonly string[]> {
  const show = await runGit(root, ['show', '--name-only', '--format=', hash]);
  if (!show.ran || show.exitCode !== 0) {
    throw new Error(
      `git show failed in workspace at "${root}" for commit ${hash}: ` +
        `${show.ran ? `exit ${show.exitCode}` : show.reason}`,
    );
  }
  return parseLines(show.stdout);
}

/**
 * Every commit that touched `root/projectId` (the same `-- projectId` scoping `commitAll`'s own
 * `git add` and `findSessionCommits` already use, applied to `git log` here only to pick WHICH
 * commits to look at) since `sinceCommit`, exclusive — or the whole history when `sinceCommit` is
 * `null`. Oldest first (`git log --reverse`), sequential per commit (same "shares the same working
 * tree/index as every other git call this adapter makes" reasoning `revert.ts#commitsWithFiles`
 * already documents for itself — this project's own commit volume never makes the latency worth the
 * concurrency risk).
 */
export async function listCommitsForAudit(
  root: string,
  projectId: string,
  sinceCommit: string | null,
): Promise<AuditableCommit[]> {
  const range = sinceCommit === null ? [] : [`${sinceCommit}..HEAD`];
  const log = await runGit(root, ['log', '--reverse', '--format=%H', ...range, '--', projectId]);
  if (!log.ran || log.exitCode !== 0) {
    throw new Error(
      `git log failed in workspace at "${root}": ${log.ran ? `exit ${log.exitCode}` : log.reason}`,
    );
  }
  const commits: AuditableCommit[] = [];
  for (const hash of parseLines(log.stdout)) {
    commits.push({
      hash,
      message: await readCommitMessage(root, hash),
      files: await readUnscopedFiles(root, hash),
    });
  }
  return commits;
}
