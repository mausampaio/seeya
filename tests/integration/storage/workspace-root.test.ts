/**
 * `StorageAdapter#readWorkspaceRoot`/`saveWorkspaceRoot` (V2-T27, `~/.seeya/workspace.json`)
 * against a real `tmpdir` — same pattern `tests/integration/storage/
 * daemon-ownership-transition.test.ts` established.
 */
import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { StorageAdapter } from '@seeya-ai/engine/adapters/storage/index.js';

async function makeTmpDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'seeya-storage-workspace-root-'));
}

describe('StorageAdapter#readWorkspaceRoot', () => {
  it('returns null when ~/.seeya/ does not exist at all yet (D-025)', async () => {
    const parent = await makeTmpDir();
    try {
      const storage = new StorageAdapter(path.join(parent, 'never-created'));
      expect(await storage.readWorkspaceRoot()).toBeNull();
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it('returns null when workspace.json has never been written', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      const storage = new StorageAdapter(seeyaHome);
      expect(await storage.readWorkspaceRoot()).toBeNull();
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });

  it('reads a real workspace.json correctly', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      await writeFile(
        path.join(seeyaHome, 'workspace.json'),
        JSON.stringify({ schemaVersion: 1, root: path.join(seeyaHome, 'workspace') }),
        'utf8',
      );
      const storage = new StorageAdapter(seeyaHome);
      expect(await storage.readWorkspaceRoot()).toBe(path.join(seeyaHome, 'workspace'));
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });

  it('throws a visible error on a read failure other than "file does not exist"', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      await mkdir(path.join(seeyaHome, 'workspace.json'));
      const storage = new StorageAdapter(seeyaHome);
      await expect(storage.readWorkspaceRoot()).rejects.toThrow(/reading .* failed/);
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });

  it('throws when "root" is missing or empty — never silently accepted', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      await writeFile(
        path.join(seeyaHome, 'workspace.json'),
        JSON.stringify({ schemaVersion: 1, root: '' }),
        'utf8',
      );
      const storage = new StorageAdapter(seeyaHome);
      await expect(storage.readWorkspaceRoot()).rejects.toThrow(/malformed/);
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });
});

describe('StorageAdapter#saveWorkspaceRoot', () => {
  it('writes a root that reads back the same value (round trip)', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      const storage = new StorageAdapter(seeyaHome);
      expect(await storage.readWorkspaceRoot()).toBeNull();
      const chosenRoot = path.join(seeyaHome, 'workspace');
      await storage.saveWorkspaceRoot(chosenRoot);
      expect(await storage.readWorkspaceRoot()).toBe(chosenRoot);
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });

  it('is idempotent — calling it twice with the same root leaves it unchanged', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      const storage = new StorageAdapter(seeyaHome);
      const chosenRoot = path.join(seeyaHome, 'workspace');
      await storage.saveWorkspaceRoot(chosenRoot);
      await storage.saveWorkspaceRoot(chosenRoot);
      expect(await storage.readWorkspaceRoot()).toBe(chosenRoot);
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });
});
