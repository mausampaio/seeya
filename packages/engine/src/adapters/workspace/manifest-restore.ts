/**
 * `WorkspaceRepository.restoreProjectManifestIfChanged`'s own git mechanics (V2-T73 item 2) — split
 * out of `adapters/workspace/index.ts` the same way `revert.ts`/`audit.ts` already are (that file
 * was already over AGENTS.md's own ~500-line ceiling before this task; `FsWorkspaceRepository`'s
 * own method below is left as a one-line delegate, same shape as `findSessionCommits`/
 * `revertCommits`/`listCommitsForAudit`).
 *
 * `<projectId>/seeya.json` restored to its own last COMMITTED content whenever the working tree
 * (staged or not — item 1 guarantees no session-authored edit to this path ever lands in a commit,
 * so the only way it can differ from `HEAD` is an uncommitted edit) disagrees with it — `git
 * checkout HEAD -- <path>`, which rewrites both the index and the working tree from that revision,
 * covering every shape the task names: a modified file, an invalid one (git diffs text, never
 * parses it, so a broken JSON restores exactly like a valid-but-wrong one), and a deleted one
 * (`checkout` recreates it). `noCommittedVersion` (D-025) is the honest answer when `HEAD` itself
 * doesn't resolve yet — a workspace with no commits at all, unreachable for an EXISTING project in
 * practice (`createProject` always commits the skeleton that includes `seeya.json` before
 * returning), but never silently treated as "unchanged" instead.
 */
import type { ManifestRestoreOutcome } from '../../core/ports.js';
import { PROJECT_MANIFEST_FILE_NAME } from '../../core/project-manifest-ownership.js';
import { runGit } from '../git/run-git.js';

async function headResolves(root: string): Promise<boolean> {
  const result = await runGit(root, ['rev-parse', '--verify', '--quiet', 'HEAD']);
  if (!result.ran) {
    throw new Error(`git rev-parse failed in workspace at "${root}": ${result.reason}`);
  }
  // Real git exit code 1 here means "HEAD doesn't resolve" (`--quiet` suppresses the noisy stderr
  // that flag exists for) — any other non-zero code is a genuine failure to surface.
  if (result.exitCode !== 0 && result.exitCode !== 1) {
    throw new Error(
      `git rev-parse failed in workspace at "${root}": exit ${result.exitCode}: ${result.stderr.trim()}`,
    );
  }
  return result.exitCode === 0;
}

export async function restoreProjectManifestIfChanged(
  root: string,
  projectId: string,
): Promise<ManifestRestoreOutcome> {
  if (!(await headResolves(root))) {
    return { kind: 'noCommittedVersion' };
  }
  const relativePath = `${projectId}/${PROJECT_MANIFEST_FILE_NAME}`;
  const quiet = await runGit(root, ['diff', '--quiet', 'HEAD', '--', relativePath]);
  if (!quiet.ran || (quiet.exitCode !== 0 && quiet.exitCode !== 1)) {
    throw new Error(
      `git diff failed in workspace at "${root}": ` +
        `${quiet.ran ? `exit ${quiet.exitCode}: ${quiet.stderr.trim()}` : quiet.reason}`,
    );
  }
  if (quiet.exitCode === 0) {
    return { kind: 'unchanged' };
  }
  const stat = await runGit(root, ['diff', '--stat', 'HEAD', '--', relativePath]);
  const diffSummary = stat.ran ? stat.stdout.trim() : `${relativePath} changed`;
  const checkout = await runGit(root, ['checkout', 'HEAD', '--', relativePath]);
  if (!checkout.ran || checkout.exitCode !== 0) {
    throw new Error(
      `git checkout failed in workspace at "${root}": ` +
        `${checkout.ran ? `exit ${checkout.exitCode}: ${checkout.stderr.trim()}` : checkout.reason}`,
    );
  }
  return { kind: 'restored', diffSummary };
}
