/**
 * `DirectoryExistence` (`core/ports.ts`, V2-T9 item 1): a plain `fs.promises.stat`, wrapped so
 * `application/cwd-history.ts` never imports `node:fs` itself (D-020's layer matrix — `core/`
 * doesn't import `node:*`, and `application/` doesn't import a concrete adapter either).
 */
import { stat } from 'node:fs/promises';
import type { DirectoryExistence } from '../../core/ports.js';

export class FsDirectoryExistence implements DirectoryExistence {
  /**
   * `false` for anything short of "a directory is really there right now" — a missing path, a
   * path that exists but is a file, or a `stat` that fails for any other reason (permission
   * denied, a component removed mid-check) all collapse to the same honest "no" (D-025: none of
   * those cases license claiming the directory exists), same discipline
   * `adapters/git/canonical-path.ts#canonicalPath` already applies to a comparable question.
   */
  async exists(cwd: string): Promise<boolean> {
    try {
      const info = await stat(cwd);
      return info.isDirectory();
    } catch {
      return false;
    }
  }
}
