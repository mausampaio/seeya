/**
 * `StorageAdapter#readFavoriteProjectIds`/`saveFavoriteProjectIds` (V2-T63,
 * `~/.seeya/favorite-projects.json`) against a real `tmpdir` — same pattern
 * `tests/integration/storage/adoptions.test.ts` established.
 */
import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { StorageAdapter } from '@seeya-ai/engine/adapters/storage/index.js';

async function makeTmpDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'seeya-storage-favorite-projects-'));
}

describe('StorageAdapter#readFavoriteProjectIds', () => {
  it('returns an empty list when ~/.seeya/ does not exist at all yet (D-025)', async () => {
    const parent = await makeTmpDir();
    try {
      const storage = new StorageAdapter(path.join(parent, 'never-created'));
      expect(await storage.readFavoriteProjectIds()).toEqual([]);
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it('returns an empty list when favorite-projects.json has never been written', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      const storage = new StorageAdapter(seeyaHome);
      expect(await storage.readFavoriteProjectIds()).toEqual([]);
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });

  it('reads a real favorite-projects.json correctly', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      await writeFile(
        path.join(seeyaHome, 'favorite-projects.json'),
        JSON.stringify({ schemaVersion: 1, projectIds: ['auth-hardening', 'billing'] }),
        'utf8',
      );
      const storage = new StorageAdapter(seeyaHome);
      expect(await storage.readFavoriteProjectIds()).toEqual(['auth-hardening', 'billing']);
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });

  it('throws a visible error on a read failure other than "file does not exist"', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      await mkdir(path.join(seeyaHome, 'favorite-projects.json'));
      const storage = new StorageAdapter(seeyaHome);
      await expect(storage.readFavoriteProjectIds()).rejects.toThrow(/reading .* failed/);
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });

  it('throws when projectIds holds something other than strings — never silently accepted', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      await writeFile(
        path.join(seeyaHome, 'favorite-projects.json'),
        JSON.stringify({ schemaVersion: 1, projectIds: [42] }),
        'utf8',
      );
      const storage = new StorageAdapter(seeyaHome);
      await expect(storage.readFavoriteProjectIds()).rejects.toThrow(/malformed/);
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });
});

describe('StorageAdapter#saveFavoriteProjectIds', () => {
  it('writes ids that read back the same values (round trip)', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      const storage = new StorageAdapter(seeyaHome);
      expect(await storage.readFavoriteProjectIds()).toEqual([]);
      await storage.saveFavoriteProjectIds(['auth-hardening', 'billing']);
      expect(await storage.readFavoriteProjectIds()).toEqual(['auth-hardening', 'billing']);
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });

  it('replaces the whole document — a shorter list saved later is what reads back', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      const storage = new StorageAdapter(seeyaHome);
      await storage.saveFavoriteProjectIds(['auth-hardening', 'billing']);
      await storage.saveFavoriteProjectIds(['billing']);
      expect(await storage.readFavoriteProjectIds()).toEqual(['billing']);
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });
});
