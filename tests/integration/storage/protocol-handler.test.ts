/**
 * `StorageAdapter#readActiveProtocolScheme`/`saveActiveProtocolScheme` (V2-T5b item 5, upgraded by
 * V2-T10 item 2, `~/.seeya/protocol-handler.json`) against a real `tmpdir` — same pattern
 * `tests/integration/storage/daemon-lock.test.ts` established.
 */
import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { StorageAdapter } from '@seeya-ai/engine/adapters/storage/index.js';

async function makeTmpDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'seeya-storage-protocol-handler-'));
}

describe('StorageAdapter#readActiveProtocolScheme', () => {
  it('returns null when ~/.seeya/ does not exist at all yet (D-025)', async () => {
    const parent = await makeTmpDir();
    try {
      const storage = new StorageAdapter(path.join(parent, 'never-created'));
      expect(await storage.readActiveProtocolScheme()).toBeNull();
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it('returns null when the marker file has never been written', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      const storage = new StorageAdapter(seeyaHome);
      expect(await storage.readActiveProtocolScheme()).toBeNull();
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });

  it('reads a real schemaVersion-2 protocol-handler.json correctly', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      await writeFile(
        path.join(seeyaHome, 'protocol-handler.json'),
        JSON.stringify({ schemaVersion: 2, activeScheme: 'seeya-dev' }),
        'utf8',
      );
      const storage = new StorageAdapter(seeyaHome);
      expect(await storage.readActiveProtocolScheme()).toBe('seeya-dev');
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });

  // V2-T10 item 2's own migration: a pre-V2-T10 marker only ever had `registered: true`.
  it('migrates a schemaVersion-1 "registered: true" document to activeScheme "seeya"', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      await writeFile(
        path.join(seeyaHome, 'protocol-handler.json'),
        JSON.stringify({ schemaVersion: 1, registered: true }),
        'utf8',
      );
      const storage = new StorageAdapter(seeyaHome);
      expect(await storage.readActiveProtocolScheme()).toBe('seeya');
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });

  it('throws a visible error on a read failure other than "file does not exist"', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      await mkdir(path.join(seeyaHome, 'protocol-handler.json'));
      const storage = new StorageAdapter(seeyaHome);
      await expect(storage.readActiveProtocolScheme()).rejects.toThrow(/reading .* failed/);
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });

  it('throws when "activeScheme" is missing or an unrecognized value — never silently accepted', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      await writeFile(
        path.join(seeyaHome, 'protocol-handler.json'),
        JSON.stringify({ schemaVersion: 2, activeScheme: 'not-a-real-scheme' }),
        'utf8',
      );
      const storage = new StorageAdapter(seeyaHome);
      await expect(storage.readActiveProtocolScheme()).rejects.toThrow(/malformed/);
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });
});

describe('StorageAdapter#saveActiveProtocolScheme', () => {
  it('writes a marker that reads back the same scheme (round trip)', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      const storage = new StorageAdapter(seeyaHome);
      expect(await storage.readActiveProtocolScheme()).toBeNull();
      await storage.saveActiveProtocolScheme('seeya');
      expect(await storage.readActiveProtocolScheme()).toBe('seeya');
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });

  it('is idempotent — calling it twice with the same scheme leaves it unchanged', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      const storage = new StorageAdapter(seeyaHome);
      await storage.saveActiveProtocolScheme('seeya-dev');
      await storage.saveActiveProtocolScheme('seeya-dev');
      expect(await storage.readActiveProtocolScheme()).toBe('seeya-dev');
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });

  // V2-T10's own "segue a última janela aberta": the most recently opened window's scheme wins.
  it('a later save with a different scheme overwrites the earlier one', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      const storage = new StorageAdapter(seeyaHome);
      await storage.saveActiveProtocolScheme('seeya');
      await storage.saveActiveProtocolScheme('seeya-dev');
      expect(await storage.readActiveProtocolScheme()).toBe('seeya-dev');
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });
});
