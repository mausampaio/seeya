/**
 * `StorageAdapter#readRepositoryMap`/`saveRepositoryMap` (V2-T28, `~/.seeya/repository-map.json`)
 * against a real `tmpdir` — same pattern `tests/integration/storage/workspace-root.test.ts`
 * established.
 */
import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { StorageAdapter } from '@seeya-ai/engine/adapters/storage/index.js';
import type { RepositoryMapEntry } from '@seeya-ai/engine/core/types.js';

async function makeTmpDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'seeya-storage-repository-map-'));
}

const WITH_IDENTITY: RepositoryMapEntry = {
  hasIdentity: true,
  identity: { host: 'host', owner: 'acme-widgets', repository: 'app-api' },
  path: 'C:\\code\\app-api',
};
const WITHOUT_IDENTITY: RepositoryMapEntry = {
  hasIdentity: false,
  projectId: 'auth-hardening',
  name: 'legacy-scripts',
  path: 'C:\\code\\legacy-scripts',
};

describe('StorageAdapter#readRepositoryMap', () => {
  it('returns an empty list when ~/.seeya/ does not exist at all yet (D-025)', async () => {
    const parent = await makeTmpDir();
    try {
      const storage = new StorageAdapter(path.join(parent, 'never-created'));
      expect(await storage.readRepositoryMap()).toEqual([]);
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it('returns an empty list when repository-map.json has never been written', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      const storage = new StorageAdapter(seeyaHome);
      expect(await storage.readRepositoryMap()).toEqual([]);
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });

  it('reads a real repository-map.json correctly, both entry shapes', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      await writeFile(
        path.join(seeyaHome, 'repository-map.json'),
        JSON.stringify({
          schemaVersion: 1,
          entries: [
            { identity: WITH_IDENTITY.identity, path: WITH_IDENTITY.path },
            {
              projectId: WITHOUT_IDENTITY.projectId,
              name: WITHOUT_IDENTITY.name,
              path: WITHOUT_IDENTITY.path,
            },
          ],
        }),
        'utf8',
      );
      const storage = new StorageAdapter(seeyaHome);
      expect(await storage.readRepositoryMap()).toEqual([WITH_IDENTITY, WITHOUT_IDENTITY]);
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });

  it('throws a visible error on a read failure other than "file does not exist"', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      await mkdir(path.join(seeyaHome, 'repository-map.json'));
      const storage = new StorageAdapter(seeyaHome);
      await expect(storage.readRepositoryMap()).rejects.toThrow(/reading .* failed/);
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });

  it('throws when an entry has neither identity nor projectId+name — never silently accepted', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      await writeFile(
        path.join(seeyaHome, 'repository-map.json'),
        JSON.stringify({ schemaVersion: 1, entries: [{ path: 'C:\\code\\orphan' }] }),
        'utf8',
      );
      const storage = new StorageAdapter(seeyaHome);
      await expect(storage.readRepositoryMap()).rejects.toThrow(/malformed/);
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });
});

describe('StorageAdapter#saveRepositoryMap', () => {
  it('writes entries that read back the same values (round trip), both shapes', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      const storage = new StorageAdapter(seeyaHome);
      expect(await storage.readRepositoryMap()).toEqual([]);
      await storage.saveRepositoryMap([WITH_IDENTITY, WITHOUT_IDENTITY]);
      expect(await storage.readRepositoryMap()).toEqual([WITH_IDENTITY, WITHOUT_IDENTITY]);
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });

  it('replaces the whole document — a shorter list saved later is what reads back', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      const storage = new StorageAdapter(seeyaHome);
      await storage.saveRepositoryMap([WITH_IDENTITY, WITHOUT_IDENTITY]);
      await storage.saveRepositoryMap([WITHOUT_IDENTITY]);
      expect(await storage.readRepositoryMap()).toEqual([WITHOUT_IDENTITY]);
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });
});
