/**
 * `GitReader.readRemoteUrl`'s implementation (V2-T28) — `git remote get-url origin` at `cwd`.
 * A separate, small module rather than folded into `git-adapter.ts`'s own `readFacts`: this reads
 * exactly one thing, for a different caller (`application/repository-association.ts#addRepository`,
 * never the evidence-gathering pipeline `readFacts`/`readEvidenceAcrossRepos` serve), and needs
 * none of `git-adapter.ts`'s worktree/branch/status machinery.
 */
import { runGit } from './run-git.js';

/**
 * `null` covers every ordinary "no remote to report" case alike — `cwd` isn't a git repository at
 * all, it is one but has no `origin` remote configured, or the command itself fails for any other
 * reason (`ran: false`, or `ran: true` with a non-zero exit). `core/ports.ts#GitReader
 * .readRemoteUrl`'s own docstring: this port never throws, and the caller has no use for telling
 * these apart (D-025) — all of them mean "add-repo can't fill in an identity here".
 */
export async function readRemoteUrl(cwd: string): Promise<string | null> {
  const result = await runGit(cwd, ['remote', 'get-url', 'origin']);
  if (!result.ran || result.exitCode !== 0) {
    return null;
  }
  const trimmed = result.stdout.trim();
  return trimmed === '' ? null : trimmed;
}
