/**
 * `FsProjectLock` (V2-T33, `adapters/workspace/project-lock.ts`, D-047 item 1) against a real
 * filesystem in `tmpdir` — same "this adapter's whole job is real I/O, so a fake would test
 * nothing real" reasoning `tests/integration/workspace/fs-workspace-repository.test.ts` already
 * documents for `FsWorkspaceRepository`.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  FsProjectLock,
  PROJECT_LOCK_FILE_NAME,
} from '@seeya-ai/engine/adapters/workspace/project-lock.js';

async function makeTmpDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'seeya-project-lock-'));
}

describe('FsProjectLock', () => {
  let root: string | undefined;

  afterEach(async () => {
    if (root !== undefined) {
      await rm(root, { recursive: true, force: true });
      root = undefined;
    }
  });

  it('read is null when no lock was ever taken (D-025, not an error)', async () => {
    root = await makeTmpDir();
    await mkdir(path.join(root, 'auth-hardening'), { recursive: true });
    const lock = new FsProjectLock();
    expect(await lock.read(root, 'auth-hardening')).toBeNull();
  });

  it('write then read round-trips every field, including an absent sessionId/procStart', async () => {
    root = await makeTmpDir();
    await mkdir(path.join(root, 'auth-hardening'), { recursive: true });
    const lock = new FsProjectLock();
    const info = {
      sessionId: undefined,
      pid: 4242,
      procStart: undefined,
      acquiredAt: new Date('2026-09-22T10:00:00.000Z'),
    };
    await lock.write(root, 'auth-hardening', info);
    expect(await lock.read(root, 'auth-hardening')).toEqual(info);
  });

  it('write then read round-trips a present sessionId/procStart', async () => {
    root = await makeTmpDir();
    await mkdir(path.join(root, 'auth-hardening'), { recursive: true });
    const lock = new FsProjectLock();
    const info = {
      sessionId: 'session-abc',
      pid: 4242,
      procStart: 'p-1',
      acquiredAt: new Date('2026-09-22T10:00:00.000Z'),
    };
    await lock.write(root, 'auth-hardening', info);
    expect(await lock.read(root, 'auth-hardening')).toEqual(info);
  });

  it('the file lives INSIDE the project directory, at the fixed name (AGENTS.md glossary)', async () => {
    root = await makeTmpDir();
    await mkdir(path.join(root, 'auth-hardening'), { recursive: true });
    const lock = new FsProjectLock();
    await lock.write(root, 'auth-hardening', {
      sessionId: undefined,
      pid: 1,
      procStart: undefined,
      acquiredAt: new Date('2026-09-22T10:00:00.000Z'),
    });
    const raw = await readFile(path.join(root, 'auth-hardening', PROJECT_LOCK_FILE_NAME), 'utf8');
    expect(JSON.parse(raw)).toMatchObject({ pid: 1 });
  });

  it('clear removes the file; clearing an already-absent lock is not an error (D-025)', async () => {
    root = await makeTmpDir();
    await mkdir(path.join(root, 'auth-hardening'), { recursive: true });
    const lock = new FsProjectLock();
    await lock.write(root, 'auth-hardening', {
      sessionId: undefined,
      pid: 1,
      procStart: undefined,
      acquiredAt: new Date('2026-09-22T10:00:00.000Z'),
    });
    await lock.clear(root, 'auth-hardening');
    expect(await lock.read(root, 'auth-hardening')).toBeNull();
    await expect(lock.clear(root, 'auth-hardening')).resolves.toBeUndefined();
  });

  it('read throws on a malformed lock file — corruption is never silently read as "free" (AGENTS.md § O erro clássico)', async () => {
    root = await makeTmpDir();
    await mkdir(path.join(root, 'auth-hardening'), { recursive: true });
    await writeFile(
      path.join(root, 'auth-hardening', PROJECT_LOCK_FILE_NAME),
      '{ not valid json',
      'utf8',
    );
    const lock = new FsProjectLock();
    await expect(lock.read(root, 'auth-hardening')).rejects.toThrow(/not valid JSON/);
  });

  it('locks for two different projects never collide', async () => {
    root = await makeTmpDir();
    await mkdir(path.join(root, 'auth-hardening'), { recursive: true });
    await mkdir(path.join(root, 'billing-v2'), { recursive: true });
    const lock = new FsProjectLock();
    await lock.write(root, 'auth-hardening', {
      sessionId: 'session-a',
      pid: 1,
      procStart: undefined,
      acquiredAt: new Date('2026-09-22T10:00:00.000Z'),
    });
    expect(await lock.read(root, 'billing-v2')).toBeNull();
    await lock.clear(root, 'auth-hardening');
    expect(await lock.read(root, 'auth-hardening')).toBeNull();
  });
});
