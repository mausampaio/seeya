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
import { mkdir, readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { RejectedDiscoveryRecord, WorkspaceRepository } from '../../core/ports.js';
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
    await writeFileAtomic(
      manifestPath(root, projectId),
      JSON.stringify(serializeProjectManifestDocument(skeleton.manifest), null, 2) + '\n',
    );
  }

  async commitAll(root: string, message: string): Promise<void> {
    const add = await runGit(root, ['add', '-A']);
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
}
