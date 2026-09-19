/**
 * `FsDirectoryExistence` (V2-T9 item 1) — a real `fs.promises.stat` against a disposable tmpdir,
 * never `~/.seeya`/`~/.claude` (AGENTS.md § "Testes").
 */
import { describe, expect, it, afterEach } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { FsDirectoryExistence } from '@seeya-ai/engine/adapters/filesystem/index.js';

const dirsToClean: string[] = [];

afterEach(async () => {
  await Promise.all(dirsToClean.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeTmpDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'seeya-directory-existence-'));
  dirsToClean.push(dir);
  return dir;
}

describe('FsDirectoryExistence', () => {
  it('true for a directory that is really there', async () => {
    const dir = await makeTmpDir();
    const existence = new FsDirectoryExistence();

    expect(await existence.exists(dir)).toBe(true);
  });

  it('false for a path that does not exist at all', async () => {
    const dir = await makeTmpDir();
    const existence = new FsDirectoryExistence();

    expect(await existence.exists(path.join(dir, 'never-created'))).toBe(false);
  });

  it('false for a path that exists but is a FILE, not a directory', async () => {
    const dir = await makeTmpDir();
    const filePath = path.join(dir, 'plain-file.txt');
    await writeFile(filePath, 'hello');
    const existence = new FsDirectoryExistence();

    expect(await existence.exists(filePath)).toBe(false);
  });

  it('true for a nested directory, not just a tmpdir root', async () => {
    const dir = await makeTmpDir();
    const nested = path.join(dir, 'nested', 'deeper');
    await mkdir(nested, { recursive: true });
    const existence = new FsDirectoryExistence();

    expect(await existence.exists(nested)).toBe(true);
  });
});
