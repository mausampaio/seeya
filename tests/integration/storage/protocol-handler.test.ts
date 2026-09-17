/**
 * `StorageAdapter#readProtocolHandlerRegistered`/`saveProtocolHandlerRegistered` (V2-T5b item 5,
 * `~/.seeya/protocol-handler.json`) against a real `tmpdir` — same pattern
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

describe('StorageAdapter#readProtocolHandlerRegistered', () => {
  it('returns false when ~/.seeya/ does not exist at all yet (D-025)', async () => {
    const parent = await makeTmpDir();
    try {
      const storage = new StorageAdapter(path.join(parent, 'never-created'));
      expect(await storage.readProtocolHandlerRegistered()).toBe(false);
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it('returns false when the marker file has never been written', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      const storage = new StorageAdapter(seeyaHome);
      expect(await storage.readProtocolHandlerRegistered()).toBe(false);
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });

  it('reads a real protocol-handler.json correctly', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      await writeFile(
        path.join(seeyaHome, 'protocol-handler.json'),
        JSON.stringify({ schemaVersion: 1, registered: true }),
        'utf8',
      );
      const storage = new StorageAdapter(seeyaHome);
      expect(await storage.readProtocolHandlerRegistered()).toBe(true);
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });

  it('throws a visible error on a read failure other than "file does not exist"', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      await mkdir(path.join(seeyaHome, 'protocol-handler.json'));
      const storage = new StorageAdapter(seeyaHome);
      await expect(storage.readProtocolHandlerRegistered()).rejects.toThrow(/reading .* failed/);
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });

  it('throws when "registered" is missing or the wrong type — never silently accepted', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      await writeFile(
        path.join(seeyaHome, 'protocol-handler.json'),
        JSON.stringify({ schemaVersion: 1, registered: 'yes' }),
        'utf8',
      );
      const storage = new StorageAdapter(seeyaHome);
      await expect(storage.readProtocolHandlerRegistered()).rejects.toThrow(/malformed/);
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });
});

describe('StorageAdapter#saveProtocolHandlerRegistered', () => {
  it('writes a marker that reads back true (round trip)', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      const storage = new StorageAdapter(seeyaHome);
      expect(await storage.readProtocolHandlerRegistered()).toBe(false);
      await storage.saveProtocolHandlerRegistered();
      expect(await storage.readProtocolHandlerRegistered()).toBe(true);
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });

  it('is idempotent — calling it twice leaves the marker registered', async () => {
    const seeyaHome = await makeTmpDir();
    try {
      const storage = new StorageAdapter(seeyaHome);
      await storage.saveProtocolHandlerRegistered();
      await storage.saveProtocolHandlerRegistered();
      expect(await storage.readProtocolHandlerRegistered()).toBe(true);
    } finally {
      await rm(seeyaHome, { recursive: true, force: true });
    }
  });
});
