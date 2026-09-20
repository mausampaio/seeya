/**
 * `StorageAdapter#readDaemonOwnershipTransitionAnswer`/`saveDaemonOwnershipTransitionAnswer`
 * (V2-T13, D-045 item 1, `~/.seeya/daemon-ownership-transition.json`) against a real `tmpdir` —
 * same pattern `tests/integration/storage/protocol-handler.test.ts` established.
 */
import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { StorageAdapter } from '@seeya-ai/engine/adapters/storage/index.js';

async function makeTmpDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'seeya-storage-daemon-ownership-transition-'));
}

describe('StorageAdapter#readDaemonOwnershipTransitionAnswer', () => {
  it('returns null when ~/.seeya/ does not exist at all yet (D-025)', async () => {
    const parent = await makeTmpDir();
    try {
      const storage = new StorageAdapter(path.join(parent, 'never-created'));
      expect(await storage.readDaemonOwnershipTransitionAnswer()).toBeNull();
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it('returns null when the answer file has never been written', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      const storage = new StorageAdapter(seeyaHome);
      expect(await storage.readDaemonOwnershipTransitionAnswer()).toBeNull();
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });

  it('reads a real daemon-ownership-transition.json correctly', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      await writeFile(
        path.join(seeyaHome, 'daemon-ownership-transition.json'),
        JSON.stringify({ schemaVersion: 1, answer: 'declined' }),
        'utf8',
      );
      const storage = new StorageAdapter(seeyaHome);
      expect(await storage.readDaemonOwnershipTransitionAnswer()).toBe('declined');
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });

  it('throws a visible error on a read failure other than "file does not exist"', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      await mkdir(path.join(seeyaHome, 'daemon-ownership-transition.json'));
      const storage = new StorageAdapter(seeyaHome);
      await expect(storage.readDaemonOwnershipTransitionAnswer()).rejects.toThrow(
        /reading .* failed/,
      );
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });

  it('throws when "answer" is missing or an unrecognized value — never silently accepted', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      await writeFile(
        path.join(seeyaHome, 'daemon-ownership-transition.json'),
        JSON.stringify({ schemaVersion: 1, answer: 'maybe' }),
        'utf8',
      );
      const storage = new StorageAdapter(seeyaHome);
      await expect(storage.readDaemonOwnershipTransitionAnswer()).rejects.toThrow(/malformed/);
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });
});

describe('StorageAdapter#saveDaemonOwnershipTransitionAnswer', () => {
  it('writes an answer that reads back the same value (round trip)', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      const storage = new StorageAdapter(seeyaHome);
      expect(await storage.readDaemonOwnershipTransitionAnswer()).toBeNull();
      await storage.saveDaemonOwnershipTransitionAnswer('accepted');
      expect(await storage.readDaemonOwnershipTransitionAnswer()).toBe('accepted');
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });

  it('is idempotent — calling it twice with the same answer leaves it unchanged', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      const storage = new StorageAdapter(seeyaHome);
      await storage.saveDaemonOwnershipTransitionAnswer('declined');
      await storage.saveDaemonOwnershipTransitionAnswer('declined');
      expect(await storage.readDaemonOwnershipTransitionAnswer()).toBe('declined');
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });
});
