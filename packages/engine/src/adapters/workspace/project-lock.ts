/**
 * `ProjectLock`'s concrete implementation (`core/ports.ts`, D-047 item 1). Reads/writes/clears
 * `.seeya-lock` INSIDE `root/projectId` — never `~/.seeya/` (that's `storage/`'s job) and never
 * committed (`FsWorkspaceRepository#commitAll` keeps the workspace's own `.gitignore` current so
 * this file never gets staged, `index.ts`'s own module comment).
 *
 * Same shape `FsWorkspaceRepository` already uses for a versioned document outside `~/.seeya/`:
 * `resolveSchemaVersion` for the corruption policy, `writeFileAtomic` for the write, `isEnoent` for
 * "not there yet" — no new dependency, no new pattern.
 */
import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { ProjectLock } from '../../core/ports.js';
import type { ProjectLockInfo } from '../../core/project-lock.js';
import { writeFileAtomic } from '../storage/atomic-write.js';
import { resolveSchemaVersion } from '../storage/schema-version.js';
import { isEnoent } from './fs-errors.js';
import {
  PROJECT_LOCK_SCHEMA_VERSION,
  parseProjectLockDocument,
  serializeProjectLockDocument,
} from './project-lock-schema.js';

/** The lock's file name, fixed in `AGENTS.md`'s glossary before this code existed (D-047). A
 * leading dot, same convention `.git`/`.gitignore` already use inside the workspace — an operational
 * marker, never project content a person is meant to open. Exported so
 * `FsWorkspaceRepository#commitAll` can reference the exact same name when it reasserts the
 * workspace's `.gitignore` (D-047 item 2: "nunca é commitado"), instead of the two modules
 * duplicating the string. */
export const PROJECT_LOCK_FILE_NAME = '.seeya-lock';

export function projectLockPath(root: string, projectId: string): string {
  return path.join(root, projectId, PROJECT_LOCK_FILE_NAME);
}

export class FsProjectLock implements ProjectLock {
  async read(root: string, projectId: string): Promise<ProjectLockInfo | null> {
    const filePath = projectLockPath(root, projectId);
    let text: string;
    try {
      text = await readFile(filePath, 'utf8');
    } catch (error) {
      if (isEnoent(error)) {
        // No lock taken for this project yet (D-025), not an error.
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
    const resolved = resolveSchemaVersion(
      filePath,
      // Same narrowing `adapters/workspace/index.ts#readManifestDocument` already documents: the
      // checks above just proved this isn't null/an array/a non-object, so this `as` states a
      // fact just established, not a guess (AGENTS.md's own rule on `as`).
      parsed as Record<string, unknown>,
      {},
      PROJECT_LOCK_SCHEMA_VERSION,
    );
    return parseProjectLockDocument(resolved);
  }

  async write(root: string, projectId: string, lock: ProjectLockInfo): Promise<void> {
    await writeFileAtomic(
      projectLockPath(root, projectId),
      JSON.stringify(serializeProjectLockDocument(lock)),
    );
  }

  async clear(root: string, projectId: string): Promise<void> {
    const filePath = projectLockPath(root, projectId);
    try {
      await unlink(filePath);
    } catch (error) {
      // Already absent (D-025: releasing a lock that was never taken, or already released, is not
      // an error) — anything else (permission denied, a locked file) is a real problem to surface.
      if (!isEnoent(error)) {
        throw new Error(`clearing ${filePath} failed: ${String(error)}`);
      }
    }
  }
}
