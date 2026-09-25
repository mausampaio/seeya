/**
 * D-047 item 4's own pre-check, pure: "recusa se algum commit posterior de outra sessão mexeu nos
 * mesmos arquivos: nunca reverte pela metade." Given a session's own commits inside one project
 * (oldest first) and every commit that came after the LAST of them (also oldest first, both from
 * `core/ports.ts#WorkspaceRepository.findSessionCommits`/`findCommitsAfter`), decides whether
 * `seeya project revert-adoption` may proceed at all — before a single `git revert` ever runs.
 */
import type { RevertCommitInfo } from './ports.js';

/**
 * D-024: three outcomes, never a boolean plus an optional blocking commit — `nothingToRevert` and
 * `blocked` need different messages, and only `proceed` carries anything to actually revert.
 */
export type RevertPlan =
  | { readonly kind: 'nothingToRevert' }
  | { readonly kind: 'blocked'; readonly blockingCommit: string }
  | { readonly kind: 'proceed'; readonly commitsNewestFirst: readonly string[] };

/**
 * `sessionCommits`/`laterCommits` are both already scoped to ONE project (`findSessionCommits`'s
 * own docstring) — this function only ever compares the file paths each side already reports,
 * never re-derives scope itself.
 *
 * @example
 * planAdoptionRevert(
 *   [{ hash: 'a', files: ['auth-hardening/AGENTS.md'] }],
 *   [{ hash: 'b', files: ['auth-hardening/AGENTS.md'] }],
 * )
 * // { kind: 'blocked', blockingCommit: 'b' }
 */
export function planAdoptionRevert(
  sessionCommits: readonly RevertCommitInfo[],
  laterCommits: readonly RevertCommitInfo[],
): RevertPlan {
  if (sessionCommits.length === 0) {
    return { kind: 'nothingToRevert' };
  }
  const sessionFiles = new Set(sessionCommits.flatMap((commit) => commit.files));
  const blocking = laterCommits.find((commit) =>
    commit.files.some((file) => sessionFiles.has(file)),
  );
  if (blocking !== undefined) {
    return { kind: 'blocked', blockingCommit: blocking.hash };
  }
  // Newest first, "do mais novo para o mais antigo" (the task's own words) — `sessionCommits`
  // arrives oldest first (`findSessionCommits`'s own contract), so this is a plain reverse.
  return {
    kind: 'proceed',
    commitsNewestFirst: [...sessionCommits].reverse().map((commit) => commit.hash),
  };
}
