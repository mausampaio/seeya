/**
 * `WorkspaceRepository.installCommitMsgHook`/`installHarnessHook`/`isClaudeMdVersioned`/
 * `installGeneratedClaudeMd`'s own mechanics (V2-T76, Q-101) — split out of `index.ts` the same
 * way `revert.ts`/`audit.ts`/`manifest-restore.ts` already are: this file is about the files
 * `seeya` itself generates and reinstalls inside a project on every `open` (the git hook, the
 * harness hook config, the `CLAUDE.md` bridge), never about the ordinary manifest/commit
 * lifecycle. `FsWorkspaceRepository`'s own methods below are left as one-line delegates, same
 * shape as `findSessionCommits`/`revertCommits`/`listCommitsForAudit`.
 */
import { chmod } from 'node:fs/promises';
import path from 'node:path';
import { COMMIT_MSG_HOOK_FILE_NAME } from '../../core/workspace-hooks.js';
import { runGit } from '../git/run-git.js';
import { writeFileAtomic } from '../storage/atomic-write.js';

/** V2-T34 item 1: (re)writes `<root>/.git/hooks/commit-msg` and marks it executable — a no-op
 * read-back, always overwrites (`core/workspace-hooks.ts`'s own docstring: this file is
 * `seeya`'s own generated text, "reinstalled by every open"). `chmod` is a no-op on Windows
 * (NTFS has no POSIX executable bit) — harmless there; Git for Windows' own bundled `sh.exe`
 * doesn't check it before running a hook by that exact file name anyway (only a non-Windows git
 * checks the bit before invoking a hook file directly).
 */
export async function installCommitMsgHook(root: string, scriptContent: string): Promise<void> {
  const hookPath = path.join(root, '.git', 'hooks', COMMIT_MSG_HOOK_FILE_NAME);
  await writeFileAtomic(hookPath, scriptContent);
  await chmod(hookPath, 0o755);
}

/** V2-T34 item 2 (PO review): writes `<root>/<projectId>/.claude/settings.json` — always
 * overwrites, same "seeya's own generated text" discipline `installCommitMsgHook` already has. No
 * executable bit needed (unlike the git hook): this is plain JSON Claude Code itself reads, never
 * executed directly. */
export async function installHarnessHook(
  root: string,
  projectId: string,
  settingsJsonContent: string,
): Promise<void> {
  await writeFileAtomic(
    path.join(root, projectId, '.claude', 'settings.json'),
    settingsJsonContent,
  );
}

/** D-050/V2-T61: `git ls-files -- <projectId>/CLAUDE.md` — empty output means untracked (never
 * existed, or exists on disk from a previous `open`'s own generated write but was never
 * committed); any output means a person versioned their own `CLAUDE.md` for this project before
 * this task shipped. `projectId` never contains a path separator (`core/project-id.ts
 * #isValidProjectId`), so a plain forward-slash join is a valid git pathspec on every platform
 * this project supports, including Windows. */
export async function isClaudeMdVersioned(root: string, projectId: string): Promise<boolean> {
  const result = await runGit(root, ['ls-files', '--', `${projectId}/CLAUDE.md`]);
  if (!result.ran || result.exitCode !== 0) {
    throw new Error(
      `git ls-files failed in workspace at "${root}": ` +
        `${result.ran ? `exit ${result.exitCode}` : result.reason}`,
    );
  }
  return result.stdout.trim().length > 0;
}

/** D-050/V2-T61: always overwrites — `seeya`'s own generated text, `installHarnessHook`'s own
 * "reinstalled by every open" discipline, applied here. Only ever called after
 * `isClaudeMdVersioned` reported false (`application/claude-md-bridge.ts#
 * ensureGeneratedClaudeMdInstalled`'s own gate). */
export async function installGeneratedClaudeMd(
  root: string,
  projectId: string,
  content: string,
): Promise<void> {
  await writeFileAtomic(path.join(root, projectId, 'CLAUDE.md'), content);
}
