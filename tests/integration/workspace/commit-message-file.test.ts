/**
 * `FsCommitMessageFile` (V2-T34 item 1, `adapters/workspace/commit-message-file.ts`) against a
 * real filesystem — plain reads/writes of the commit-msg hook's own temp file. The real end-to-end
 * proof (git actually handing this a real temp path) is
 * `tests/integration/workspace/commit-msg-hook.test.ts`; this is the adapter's own contract in
 * isolation.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { FsCommitMessageFile } from '@seeya-ai/engine/adapters/workspace/commit-message-file.js';

describe('FsCommitMessageFile', () => {
  let dir: string | undefined;

  afterEach(async () => {
    if (dir !== undefined) {
      await rm(dir, { recursive: true, force: true });
      dir = undefined;
    }
  });

  it('read returns exactly what is on disk', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'seeya-commit-msg-file-'));
    const filePath = path.join(dir, 'COMMIT_EDITMSG');
    await writeFile(filePath, 'Fix bug\n\nSeeya-Project-Id: auth-hardening\n', 'utf8');

    const file = new FsCommitMessageFile();
    expect(await file.read(filePath)).toBe('Fix bug\n\nSeeya-Project-Id: auth-hardening\n');
  });

  it('read rejects when the file does not exist — never silently returns empty (D-025)', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'seeya-commit-msg-file-'));
    const file = new FsCommitMessageFile();
    await expect(file.read(path.join(dir, 'missing'))).rejects.toThrow();
  });

  it('write overwrites the file with exactly the given content', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'seeya-commit-msg-file-'));
    const filePath = path.join(dir, 'COMMIT_EDITMSG');
    await writeFile(filePath, 'original\n', 'utf8');

    const file = new FsCommitMessageFile();
    await file.write(filePath, 'replaced\n\nSeeya-Project-Id: auth-hardening\n');

    expect(await readFile(filePath, 'utf8')).toBe('replaced\n\nSeeya-Project-Id: auth-hardening\n');
  });

  it('a write followed by a read returns exactly what was written — round trip', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'seeya-commit-msg-file-'));
    const filePath = path.join(dir, 'COMMIT_EDITMSG');
    const file = new FsCommitMessageFile();

    await file.write(filePath, 'new content\n');
    expect(await file.read(filePath)).toBe('new content\n');
  });
});
