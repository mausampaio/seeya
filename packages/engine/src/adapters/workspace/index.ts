/**
 * `WorkspaceRepository`'s concrete implementation (`core/ports.ts`, V2-T27). Over the real
 * filesystem and the real `git` binary — reusing `adapters/git/run-git.ts#runGit` (the project
 * already has a git adapter; this is not a second one) and
 * `adapters/storage/atomic-write.ts#writeFileAtomic` (the same "temporário + rename" every write
 * under `~/.seeya/` already gets, applied here to the workspace instead).
 *
 * No constructor state at all — every method takes `root` explicitly (`core/ports.ts#
 * WorkspaceRepository`'s own docstring on why), so a single instance is safe to reuse across every
 * `seeya project` command a CLI invocation runs (`packages/cli/src/composition.ts`).
 *
 * V2-T76 (Q-101): this file had grown past AGENTS.md's ~500-line ceiling. Its git-mechanics-heavy
 * methods are split by group of operation into sibling files — `revert.ts`/`audit.ts`/
 * `manifest-restore.ts` already drew this line before this task; `project-manifest-files.ts`
 * (manifest read/write), `commit.ts` (the commit lifecycle, including `.gitignore` upkeep) and
 * `generated-files.ts` (the git hook/harness hook/`CLAUDE.md` seeya itself writes into a project)
 * are the three new ones. This file keeps the class itself, the workspace's own init/identity
 * lifecycle, a handful of small git queries with no sibling of their own yet, and a one-line
 * delegate per extracted method — the public shape (`FsWorkspaceRepository`, importable from this
 * exact path) doesn't change.
 */
import { mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import type {
  ManifestRestoreOutcome,
  RejectedDiscoveryRecord,
  RevertCommitInfo,
  RevertExecutionOutcome,
  WorkspaceRepository,
} from '../../core/ports.js';
import type { AuditableCommit } from '../../core/project-audit.js';
import type { ProjectManifest, ProjectSkeleton } from '../../core/types.js';
import type { LockHolderProcess } from '../../core/lock-holder-process.js';
import { runGit } from '../git/run-git.js';
import { isEnoent } from './fs-errors.js';
import { SEEYA_IDENTITY_EMAIL, SEEYA_IDENTITY_NAME, commitAll as commitAllImpl } from './commit.js';
import {
  installCommitMsgHook as installCommitMsgHookImpl,
  installGeneratedClaudeMd as installGeneratedClaudeMdImpl,
  installHarnessHook as installHarnessHookImpl,
  isClaudeMdVersioned as isClaudeMdVersionedImpl,
} from './generated-files.js';
import {
  listProjects as listProjectsImpl,
  projectExists as projectExistsImpl,
  readProjectManifest as readProjectManifestImpl,
  writeProjectManifest as writeProjectManifestImpl,
  writeProjectSkeleton as writeProjectSkeletonImpl,
} from './project-manifest-files.js';
import { findCommitsAfter, findSessionCommits, revertCommitSequence } from './revert.js';
import { listCommitsForAudit as listCommitsForAuditImpl } from './audit.js';
import { restoreProjectManifestIfChanged as restoreProjectManifestIfChangedImpl } from './manifest-restore.js';

export { FsProjectLock } from './project-lock.js';
export { FsProjectAuditMarker } from './project-audit-marker.js';
export { FsCommitMessageFile } from './commit-message-file.js';

export class FsWorkspaceRepository implements WorkspaceRepository {
  async isInitialized(root: string): Promise<boolean> {
    try {
      await stat(path.join(root, '.git'));
      return true;
    } catch (error) {
      if (isEnoent(error)) {
        return false;
      }
      throw new Error(`checking ${root} failed: ${String(error)}`);
    }
  }

  async initialize(root: string): Promise<void> {
    await mkdir(root, { recursive: true });
    // `--initial-branch=main`, same convention `tests/integration/git/_fixtures.ts#createGitFixture`
    // already uses — an explicit name instead of whatever `init.defaultBranch` the machine running
    // this happens to have configured (or not).
    const result = await runGit(root, ['init', '--initial-branch=main']);
    if (!result.ran || result.exitCode !== 0) {
      throw new Error(
        `git init failed for workspace at "${root}": ${result.ran ? `exit ${result.exitCode}` : result.reason}`,
      );
    }
  }

  /** V2-T58 (D-047 emendment): `git config --local <key> <value>` for `user.name`/`user.email` —
   * `--local` writes into `root/.git/config`, never the operator's own `~/.gitconfig`. `git
   * config` replaces a single existing value in place, which is exactly the "sobrescreve
   * identidade local existente" the task calls for; it never touches any other key already in that
   * file. */
  async configureIdentity(root: string): Promise<void> {
    const entries: readonly [string, string][] = [
      ['user.name', SEEYA_IDENTITY_NAME],
      ['user.email', SEEYA_IDENTITY_EMAIL],
    ];
    for (const [key, value] of entries) {
      const result = await runGit(root, ['config', '--local', key, value]);
      if (!result.ran || result.exitCode !== 0) {
        throw new Error(
          `git config --local ${key} "${value}" failed in workspace at "${root}": ` +
            `${result.ran ? `exit ${result.exitCode}: ${result.stderr.trim()}` : result.reason}`,
        );
      }
    }
  }

  projectExists(root: string, projectId: string): Promise<boolean> {
    return projectExistsImpl(root, projectId);
  }

  writeProjectSkeleton(root: string, projectId: string, skeleton: ProjectSkeleton): Promise<void> {
    return writeProjectSkeletonImpl(root, projectId, skeleton);
  }

  /** V2-T28: overwrites only `seeya.json` — `add-repo` is the one caller, right after reading the
   * current manifest and appending one `AssociatedRepository` to `repositories`. */
  writeProjectManifest(root: string, projectId: string, manifest: ProjectManifest): Promise<void> {
    return writeProjectManifestImpl(root, projectId, manifest);
  }

  commitAll(
    root: string,
    projectId: string,
    message: string,
    lockHolder?: LockHolderProcess,
    manifestWriteAuthorized?: boolean,
  ): Promise<void> {
    return commitAllImpl(root, projectId, message, lockHolder, manifestWriteAuthorized);
  }

  listProjects(
    root: string,
  ): Promise<{ manifests: ProjectManifest[]; rejected: RejectedDiscoveryRecord[] }> {
    return listProjectsImpl(root);
  }

  readProjectManifest(root: string, projectId: string): Promise<ProjectManifest | null> {
    return readProjectManifestImpl(root, projectId);
  }

  /**
   * V2-T29: `git status --porcelain -- <projectId>`, scoped the same way `commitAll` scopes its own
   * `git add` (D-047 item 3) — a second project's own pending change is never mixed in. Each
   * `--porcelain` line is `XY <path>` (two status characters, one space, the path); renamed entries
   * (`R  old -> new`) keep their `old -> new` form here too — this is a display list for
   * `adoptSession`'s own confirmation prompt, never fed back into a `git add`, so a raw-but-honest
   * line is preferable to a parser that has to get every porcelain edge case right for no benefit.
   */
  async listChangedFiles(root: string, projectId: string): Promise<readonly string[]> {
    // `--untracked-files=all`: without it, git collapses a newly created directory (e.g. a
    // session's first write into an empty `context/`) into one line naming the DIRECTORY, not the
    // file inside it — useless for a confirmation prompt that exists to show what would be
    // committed. `all` lists every individual file instead, at any depth.
    const status = await runGit(root, [
      'status',
      '--porcelain',
      '--untracked-files=all',
      '--',
      projectId,
    ]);
    if (!status.ran || status.exitCode !== 0) {
      throw new Error(
        `git status failed in workspace at "${root}": ` +
          `${status.ran ? `exit ${status.exitCode}` : status.reason}`,
      );
    }
    return status.stdout
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => line.slice(3));
  }

  /** V2-T32: `seeya project remove`'s own physical deletion — `root/projectId` only, `commitAll`
   * (a separate, explicit call) is what stages and commits the removal afterward. Tolerates the
   * directory already being gone (D-025: nothing left to remove is not a failure). */
  async removeProjectDirectory(root: string, projectId: string): Promise<void> {
    await rm(path.join(root, projectId), { recursive: true, force: true });
  }

  /** V2-T32: `git rev-parse HEAD` — `null` when the workspace has no commits yet (D-025), same
   * "absence, not corruption" reading every other `null` on this port already carries. */
  async currentCommit(root: string): Promise<string | null> {
    const result = await runGit(root, ['rev-parse', 'HEAD']);
    if (!result.ran) {
      throw new Error(`git rev-parse failed in workspace at "${root}": ${result.reason}`);
    }
    // Real git exit code 128 here means "unknown revision" — an empty repository, never a
    // different kind of failure `rev-parse` reports this same way (D-025: the least-specific true
    // reading of "HEAD doesn't resolve").
    return result.exitCode === 0 ? result.stdout.trim() : null;
  }

  /** V2-T32: `git ls-files -- projectId` — the count of files tracked inside one project, scoped
   * the same way every other project-scoped git call on this port already is. */
  async countProjectFiles(root: string, projectId: string): Promise<number> {
    const result = await runGit(root, ['ls-files', '--', projectId]);
    if (!result.ran || result.exitCode !== 0) {
      throw new Error(
        `git ls-files failed in workspace at "${root}": ` +
          `${result.ran ? `exit ${result.exitCode}` : result.reason}`,
      );
    }
    return result.stdout.split('\n').filter((line) => line.trim().length > 0).length;
  }

  findSessionCommits(
    root: string,
    projectId: string,
    sessionId: string,
  ): Promise<readonly RevertCommitInfo[]> {
    return findSessionCommits(root, projectId, sessionId);
  }

  findCommitsAfter(
    root: string,
    projectId: string,
    afterCommit: string,
  ): Promise<readonly RevertCommitInfo[]> {
    return findCommitsAfter(root, projectId, afterCommit);
  }

  revertCommits(
    root: string,
    projectId: string,
    commitsNewestFirst: readonly string[],
    message: string,
    lockHolder?: LockHolderProcess,
  ): Promise<RevertExecutionOutcome> {
    void projectId; // `commitsNewestFirst` already came from THIS project's own history.
    return revertCommitSequence(root, commitsNewestFirst, message, lockHolder);
  }

  /** V2-T34 item 1: `git diff --cached --name-only`, unscoped — every file staged for the NEXT
   * commit, across every project, so `core/workspace-commit-guard.ts` can tell whether it touches
   * more than one. */
  async listStagedFiles(root: string): Promise<readonly string[]> {
    const diff = await runGit(root, ['diff', '--cached', '--name-only']);
    if (!diff.ran || diff.exitCode !== 0) {
      throw new Error(
        `git diff failed in workspace at "${root}": ` +
          `${diff.ran ? `exit ${diff.exitCode}` : diff.reason}`,
      );
    }
    return diff.stdout.split('\n').filter((line) => line.trim().length > 0);
  }

  installCommitMsgHook(root: string, scriptContent: string): Promise<void> {
    return installCommitMsgHookImpl(root, scriptContent);
  }

  listCommitsForAudit(
    root: string,
    projectId: string,
    sinceCommit: string | null,
  ): Promise<readonly AuditableCommit[]> {
    return listCommitsForAuditImpl(root, projectId, sinceCommit);
  }

  installHarnessHook(root: string, projectId: string, settingsJsonContent: string): Promise<void> {
    return installHarnessHookImpl(root, projectId, settingsJsonContent);
  }

  isClaudeMdVersioned(root: string, projectId: string): Promise<boolean> {
    return isClaudeMdVersionedImpl(root, projectId);
  }

  installGeneratedClaudeMd(root: string, projectId: string, content: string): Promise<void> {
    return installGeneratedClaudeMdImpl(root, projectId, content);
  }

  /** V2-T73 item 2 — mechanics in `adapters/workspace/manifest-restore.ts`, same delegate shape as
   * `findSessionCommits`/`revertCommits`/`listCommitsForAudit` above. */
  restoreProjectManifestIfChanged(
    root: string,
    projectId: string,
  ): Promise<ManifestRestoreOutcome> {
    return restoreProjectManifestIfChangedImpl(root, projectId);
  }
}
