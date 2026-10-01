/**
 * `WorkspaceRepository.projectExists`/`writeProjectSkeleton`/`writeProjectManifest`/
 * `readProjectManifest`/`listProjects`'s own filesystem mechanics (V2-T76, Q-101) — split out of
 * `index.ts` the same way `revert.ts`/`audit.ts`/`manifest-restore.ts` already are: this file is
 * about reading and writing one project's own `seeya.json`, never about committing it (that stays
 * in `commit.ts`) or about the workspace's own init/identity lifecycle (that stays in `index.ts`).
 * `FsWorkspaceRepository`'s own methods below are left as one-line delegates, same shape as
 * `findSessionCommits`/`revertCommits`/`listCommitsForAudit`/`restoreProjectManifestIfChanged`.
 */
import { mkdir, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import type { RejectedDiscoveryRecord } from '../../core/ports.js';
import type { ProjectManifest, ProjectSkeleton } from '../../core/types.js';
import { PROJECT_MANIFEST_FILE_NAME } from '../../core/project-manifest-ownership.js';
import { writeFileAtomic } from '../storage/atomic-write.js';
import { resolveSchemaVersion } from '../storage/schema-version.js';
import { isEnoent } from './fs-errors.js';
import {
  PROJECT_MANIFEST_SCHEMA_VERSION,
  parseProjectManifestDocument,
  serializeProjectManifestDocument,
} from './project-manifest-schema.js';

export function manifestPath(root: string, projectId: string): string {
  return path.join(root, projectId, PROJECT_MANIFEST_FILE_NAME);
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

export async function projectExists(root: string, projectId: string): Promise<boolean> {
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

export async function writeProjectSkeleton(
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
export async function writeProjectManifest(
  root: string,
  projectId: string,
  manifest: ProjectManifest,
): Promise<void> {
  await writeManifestFile(root, projectId, manifest);
}

export async function readProjectManifest(
  root: string,
  projectId: string,
): Promise<ProjectManifest | null> {
  const resolved = await readManifestDocument(manifestPath(root, projectId));
  return resolved === null ? null : parseProjectManifestDocument(resolved);
}

export async function listProjects(
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
