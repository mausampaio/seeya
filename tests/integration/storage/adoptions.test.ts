/**
 * `StorageAdapter#readAdoptions`/`saveAdoptions` (V2-T29, `~/.seeya/adoptions.json`) against a
 * real `tmpdir` — same pattern `tests/integration/storage/repository-map.test.ts` established.
 */
import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { StorageAdapter } from '@seeya-ai/engine/adapters/storage/index.js';
import type { AdoptionRecord } from '@seeya-ai/engine/core/types.js';

async function makeTmpDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'seeya-storage-adoptions-'));
}

const RECORD_A: AdoptionRecord = {
  originalSessionId: '11111111-1111-4111-8111-111111111111',
  forkSessionId: '22222222-2222-4222-8222-222222222222',
  projectId: 'auth-hardening',
  adoptedAt: new Date('2026-09-24T10:00:00.000Z'),
};
const RECORD_B: AdoptionRecord = {
  originalSessionId: '33333333-3333-4333-8333-333333333333',
  forkSessionId: '44444444-4444-4444-8444-444444444444',
  projectId: 'billing',
  adoptedAt: new Date('2026-09-24T11:00:00.000Z'),
};

describe('StorageAdapter#readAdoptions', () => {
  it('returns an empty list when ~/.seeya/ does not exist at all yet (D-025)', async () => {
    const parent = await makeTmpDir();
    try {
      const storage = new StorageAdapter(path.join(parent, 'never-created'));
      expect(await storage.readAdoptions()).toEqual([]);
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it('returns an empty list when adoptions.json has never been written', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      const storage = new StorageAdapter(seeyaHome);
      expect(await storage.readAdoptions()).toEqual([]);
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });

  it('reads a real adoptions.json correctly', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      await writeFile(
        path.join(seeyaHome, 'adoptions.json'),
        JSON.stringify({
          schemaVersion: 1,
          adoptions: [
            {
              originalSessionId: RECORD_A.originalSessionId,
              forkSessionId: RECORD_A.forkSessionId,
              projectId: RECORD_A.projectId,
              adoptedAt: RECORD_A.adoptedAt.toISOString(),
            },
          ],
        }),
        'utf8',
      );
      const storage = new StorageAdapter(seeyaHome);
      expect(await storage.readAdoptions()).toEqual([RECORD_A]);
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });

  it('throws a visible error on a read failure other than "file does not exist"', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      await mkdir(path.join(seeyaHome, 'adoptions.json'));
      const storage = new StorageAdapter(seeyaHome);
      await expect(storage.readAdoptions()).rejects.toThrow(/reading .* failed/);
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });

  it('throws when an entry is missing a required field — never silently accepted', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      await writeFile(
        path.join(seeyaHome, 'adoptions.json'),
        JSON.stringify({ schemaVersion: 1, adoptions: [{ projectId: 'auth-hardening' }] }),
        'utf8',
      );
      const storage = new StorageAdapter(seeyaHome);
      await expect(storage.readAdoptions()).rejects.toThrow(/malformed/);
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });
});

describe('StorageAdapter#saveAdoptions', () => {
  it('writes records that read back the same values (round trip)', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      const storage = new StorageAdapter(seeyaHome);
      expect(await storage.readAdoptions()).toEqual([]);
      await storage.saveAdoptions([RECORD_A, RECORD_B]);
      expect(await storage.readAdoptions()).toEqual([RECORD_A, RECORD_B]);
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });

  it('replaces the whole document — a shorter list saved later is what reads back', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      const storage = new StorageAdapter(seeyaHome);
      await storage.saveAdoptions([RECORD_A, RECORD_B]);
      await storage.saveAdoptions([RECORD_B]);
      expect(await storage.readAdoptions()).toEqual([RECORD_B]);
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });
});
