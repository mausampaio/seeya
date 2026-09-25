/**
 * `ProjectAuditMarker`'s concrete implementation (`core/ports.ts`, V2-T34 item 3) — a one-line text
 * file, `.seeya-audit`, INSIDE `root/projectId` (same location discipline as `.seeya-lock`,
 * `adapters/workspace/project-lock.ts#PROJECT_LOCK_FILE_NAME`'s own docstring), never committed
 * (`FsWorkspaceRepository#commitAll` reasserts the workspace's `.gitignore` to cover this name too,
 * the same way it already does for the lock file).
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ProjectAuditMarker } from '../../core/ports.js';
import { writeFileAtomic } from '../storage/atomic-write.js';
import { isEnoent } from './fs-errors.js';

/** Exported so `FsWorkspaceRepository#commitAll` can reassert the exact same name in the
 * workspace's `.gitignore` — same pattern `PROJECT_LOCK_FILE_NAME` already establishes. */
export const PROJECT_AUDIT_FILE_NAME = '.seeya-audit';

function auditMarkerPath(root: string, projectId: string): string {
  return path.join(root, projectId, PROJECT_AUDIT_FILE_NAME);
}

export class FsProjectAuditMarker implements ProjectAuditMarker {
  async read(root: string, projectId: string): Promise<string | null> {
    try {
      const text = await readFile(auditMarkerPath(root, projectId), 'utf8');
      const trimmed = text.trim();
      return trimmed.length === 0 ? null : trimmed;
    } catch (error) {
      if (isEnoent(error)) {
        // Never audited on this device yet (D-025) — not an error.
        return null;
      }
      throw new Error(`reading ${auditMarkerPath(root, projectId)} failed: ${String(error)}`);
    }
  }

  async write(root: string, projectId: string, commitHash: string): Promise<void> {
    await writeFileAtomic(auditMarkerPath(root, projectId), `${commitHash}\n`);
  }
}
