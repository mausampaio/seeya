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
 */
import { mkdir, readdir, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import type {
  RejectedDiscoveryRecord,
  RevertCommitInfo,
  RevertExecutionOutcome,
  WorkspaceRepository,
} from '../../core/ports.js';
import type { ProjectManifest, ProjectSkeleton } from '../../core/types.js';
import { runGit } from '../git/run-git.js';
import { writeFileAtomic } from '../storage/atomic-write.js';
import { resolveSchemaVersion } from '../storage/schema-version.js';
import { isEnoent } from './fs-errors.js';
import {
  PROJECT_MANIFEST_SCHEMA_VERSION,
  parseProjectManifestDocument,
  serializeProjectManifestDocument,
} from './project-manifest-schema.js';
import { PROJECT_LOCK_FILE_NAME } from './project-lock.js';
import { findCommitsAfter, findSessionCommits, revertCommitSequence } from './revert.js';

export { FsProjectLock } from './project-lock.js';

/** `seeya`'s own author/committer identity for every commit it makes in the workspace — never the
 * operator's real `git config user.*` (this file's own module comment; same technique
 * `tests/integration/git/_fixtures.ts#commitAt` uses for the identical reason). `.localhost` is an
 * RFC 6761 reserved suffix — deliberately not a real, ownable address (`scripts/
 * verificar-termos-locais.mjs`'s own reserved-domain exception documents why that matters for a
 * value that lives in versioned source, not just in a test fixture). */
const COMMIT_IDENTITY_ENV: NodeJS.ProcessEnv = {
  GIT_AUTHOR_NAME: 'seeya',
  GIT_AUTHOR_EMAIL: 'seeya@localhost',
  GIT_COMMITTER_NAME: 'seeya',
  GIT_COMMITTER_EMAIL: 'seeya@localhost',
};

function manifestPath(root: string, projectId: string): string {
  return path.join(root, projectId, 'seeya.json');
}

const GITIGNORE_FILE_NAME = '.gitignore';

/**
 * D-047 item 2: "o lock nunca é commitado: entra no `.gitignore` do espaço de trabalho, criado ou
 * atualizado pelo próprio seeya." Called at the start of every `commitAll`, not only once at
 * `initialize()` — a workspace created before this task never got the line, and `.gitignore`
 * without a leading/trailing slash on `PROJECT_LOCK_FILE_NAME` matches that name at ANY depth
 * (git's own pattern rule), so one line covers every project's own `.seeya-lock`, present or
 * future. Idempotent: a `.gitignore` that already has the line is left untouched (no rewrite, no
 * extra commit).
 */
async function ensureWorkspaceGitignoreIgnoresProjectLock(root: string): Promise<void> {
  const gitignorePath = path.join(root, GITIGNORE_FILE_NAME);
  let current: string;
  try {
    current = await readFile(gitignorePath, 'utf8');
  } catch (error) {
    if (!isEnoent(error)) {
      throw new Error(`reading ${gitignorePath} failed: ${String(error)}`);
    }
    current = '';
  }
  const alreadyPresent = current.split('\n').some((line) => line.trim() === PROJECT_LOCK_FILE_NAME);
  if (alreadyPresent) {
    return;
  }
  const withTrailingNewline =
    current.length === 0 || current.endsWith('\n') ? current : `${current}\n`;
  await writeFileAtomic(gitignorePath, `${withTrailingNewline}${PROJECT_LOCK_FILE_NAME}\n`);
}

/** Shared by `writeProjectSkeleton` and `writeProjectManifest` (V2-T28) — the one place that
 * serializes a `ProjectManifest` to `seeya.json`, atomically. */
async function writeManifestFile(
  root: string,
  projectId: string,
  manifest: ProjectManifest,
): Promise<void> {
  await writeFileAtomic(
    manifestPath(root, projectId),
    JSON.stringify(serializeProjectManifestDocument(manifest), null, 2) + '\n',
  );
}

/** Reads and validates one `seeya.json` — throws on anything malformed (bad JSON, schema
 * mismatch, unsupported `schemaVersion`), `null` only when the file doesn't exist at all (D-025).
 * Shared by `readProjectManifest` (throws straight to its caller, a single explicit lookup) and
 * `listProjects` (catches this into a `RejectedDiscoveryRecord`, D-022) — same split
 * `adapters/storage/index.ts#readVersionedDocument`/`readOneHandoffOrRejection` already draw, just
 * relocated: this document doesn't live under `~/.seeya/`, so it isn't that module's to read. */
async function readManifestDocument(filePath: string): Promise<Record<string, unknown> | null> {
  let text: string;
  try {
    text = await readFile(filePath, 'utf8');
  } catch (error) {
    if (isEnoent(error)) {
      return null;
    }
    throw new Error(`reading ${filePath} failed: ${String(error)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`${filePath} is not valid JSON: ${String(error)}`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${filePath} must be a JSON object at the root`);
  }
  // Same narrowing `adapters/storage/index.ts#readVersionedDocument` uses: the checks above
  // already ruled out `null`/array/non-object, so this `as` documents a fact just proven, not a
  // guess (AGENTS.md: `as` is only acceptable when the compiler genuinely can't see what the code
  // just checked).
  return resolveSchemaVersion(
    filePath,
    parsed as Record<string, unknown>,
    {},
    PROJECT_MANIFEST_SCHEMA_VERSION,
  );
}

async function readManifestOrRejection(
  root: string,
  projectId: string,
): Promise<ProjectManifest | RejectedDiscoveryRecord | null> {
  const filePath = manifestPath(root, projectId);
  try {
    const resolved = await readManifestDocument(filePath);
    return resolved === null ? null : parseProjectManifestDocument(resolved);
  } catch (error) {
    return {
      file: filePath,
      raw: undefined,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

function isRejection(
  value: ProjectManifest | RejectedDiscoveryRecord | null,
): value is RejectedDiscoveryRecord {
  return value !== null && 'reason' in value;
}

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

  async projectExists(root: string, projectId: string): Promise<boolean> {
    try {
      await stat(manifestPath(root, projectId));
      return true;
    } catch (error) {
      if (isEnoent(error)) {
        return false;
      }
      throw new Error(`checking ${manifestPath(root, projectId)} failed: ${String(error)}`);
    }
  }

  async writeProjectSkeleton(
    root: string,
    projectId: string,
    skeleton: ProjectSkeleton,
  ): Promise<void> {
    const projectDir = path.join(root, projectId);
    for (const relativeDir of skeleton.directories) {
      await mkdir(path.join(projectDir, relativeDir), { recursive: true });
    }
    for (const file of skeleton.files) {
      await writeFileAtomic(path.join(projectDir, file.relativePath), file.content);
    }
    await writeManifestFile(root, projectId, skeleton.manifest);
  }

  /** V2-T28: overwrites only `seeya.json` — `add-repo` is the one caller, right after reading the
   * current manifest and appending one `AssociatedRepository` to `repositories`. */
  async writeProjectManifest(
    root: string,
    projectId: string,
    manifest: ProjectManifest,
  ): Promise<void> {
    await writeManifestFile(root, projectId, manifest);
  }

  async commitAll(root: string, projectId: string, message: string): Promise<void> {
    // D-047 item 3's own bug fix: `git add <projectId> .gitignore`, never `-A` — a second
    // project's own pending change must never ride along on this commit (see this method's own
    // regression test, "commitAll only ever stages the one project it was called for").
    await ensureWorkspaceGitignoreIgnoresProjectLock(root);
    const add = await runGit(root, ['add', projectId, GITIGNORE_FILE_NAME]);
    if (!add.ran || add.exitCode !== 0) {
      throw new Error(
        `git add failed in workspace at "${root}": ${add.ran ? `exit ${add.exitCode}` : add.reason}`,
      );
    }
    // Exit 0: nothing staged differs from HEAD — a no-op, never an empty commit (this port's own
    // docstring on `commitAll`). Exit 1: something IS staged, proceed to commit. Anything else
    // (`ran: false`) is a real failure to surface.
    const diff = await runGit(root, ['diff', '--cached', '--quiet']);
    if (diff.ran && diff.exitCode === 0) {
      return;
    }
    if (!diff.ran) {
      throw new Error(`git diff failed in workspace at "${root}": ${diff.reason}`);
    }
    const commit = await runGit(root, ['commit', '-m', message], {
      ...process.env,
      ...COMMIT_IDENTITY_ENV,
    });
    if (!commit.ran || commit.exitCode !== 0) {
      throw new Error(
        `git commit failed in workspace at "${root}": ` +
          `${commit.ran ? `exit ${commit.exitCode}` : commit.reason}`,
      );
    }
  }

  async listProjects(
    root: string,
  ): Promise<{ manifests: ProjectManifest[]; rejected: RejectedDiscoveryRecord[] }> {
    let entries;
    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch (error) {
      if (isEnoent(error)) {
        // No workspace created on this device yet (D-025): zero projects, not an error.
        return { manifests: [], rejected: [] };
      }
      return {
        manifests: [],
        rejected: [
          { file: root, raw: undefined, reason: `listing ${root} failed: ${String(error)}` },
        ],
      };
    }
    const candidateIds = entries.filter((entry) => entry.isDirectory() && entry.name !== '.git');
    const outcomes = await Promise.all(
      candidateIds.map((entry) => readManifestOrRejection(root, entry.name)),
    );
    const manifests: ProjectManifest[] = [];
    const rejected: RejectedDiscoveryRecord[] = [];
    for (const outcome of outcomes) {
      if (outcome === null) {
        continue;
      }
      if (isRejection(outcome)) {
        rejected.push(outcome);
      } else {
        manifests.push(outcome);
      }
    }
    return { manifests, rejected };
  }

  async readProjectManifest(root: string, projectId: string): Promise<ProjectManifest | null> {
    const resolved = await readManifestDocument(manifestPath(root, projectId));
    return resolved === null ? null : parseProjectManifestDocument(resolved);
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
  ): Promise<RevertExecutionOutcome> {
    void projectId; // `commitsNewestFirst` already came from THIS project's own history.
    return revertCommitSequence(root, commitsNewestFirst, message);
  }
}
