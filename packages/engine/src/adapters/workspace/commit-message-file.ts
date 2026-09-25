/**
 * `CommitMessageFile`'s concrete implementation (`core/ports.ts`, V2-T34 item 1) — plain `fs` reads
 * and writes of the commit-msg hook's own temp file. Not `writeFileAtomic`
 * (`adapters/storage/atomic-write.ts`): that file's whole lifecycle already belongs to `git`
 * (created right before the hook runs, deleted right after it exits, never read by a second
 * process concurrently), so there is no torn-read risk for a rename-based swap to protect against —
 * the same reasoning this port's own docstring already gives.
 */
import { readFile, writeFile } from 'node:fs/promises';
import type { CommitMessageFile } from '../../core/ports.js';

export class FsCommitMessageFile implements CommitMessageFile {
  async read(path: string): Promise<string> {
    return readFile(path, 'utf8');
  }

  async write(path: string, content: string): Promise<void> {
    await writeFile(path, content, 'utf8');
  }
}
