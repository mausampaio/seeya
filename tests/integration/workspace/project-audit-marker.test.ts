/**
 * `FsProjectAuditMarker` (V2-T34 item 3, `adapters/workspace/project-audit-marker.ts`) against a
 * real filesystem — `.seeya-audit`, inside a project's own directory, the same location discipline
 * `.seeya-lock`/`FsProjectLock` already has.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { FsProjectAuditMarker } from '@seeya-ai/engine/adapters/workspace/project-audit-marker.js';

async function makeTmpDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'seeya-audit-marker-'));
}

describe('FsProjectAuditMarker', () => {
  let root: string | undefined;

  afterEach(async () => {
    if (root !== undefined) {
      await rm(root, { recursive: true, force: true });
      root = undefined;
    }
  });

  it('read is null when no project directory (or marker) exists yet (D-025)', async () => {
    root = await makeTmpDir();
    const marker = new FsProjectAuditMarker();
    expect(await marker.read(root, 'auth-hardening')).toBeNull();
  });

  it('write then read returns the exact commit hash', async () => {
    root = await makeTmpDir();
    await mkdir(path.join(root, 'auth-hardening'), { recursive: true });
    const marker = new FsProjectAuditMarker();

    await marker.write(root, 'auth-hardening', 'abc123def456');

    expect(await marker.read(root, 'auth-hardening')).toBe('abc123def456');
  });

  it('write overwrites a previous marker — only the latest audit point is kept', async () => {
    root = await makeTmpDir();
    await mkdir(path.join(root, 'auth-hardening'), { recursive: true });
    const marker = new FsProjectAuditMarker();

    await marker.write(root, 'auth-hardening', 'first-hash');
    await marker.write(root, 'auth-hardening', 'second-hash');

    expect(await marker.read(root, 'auth-hardening')).toBe('second-hash');
  });

  it('trims trailing whitespace/newlines on read', async () => {
    root = await makeTmpDir();
    const projectDir = path.join(root, 'auth-hardening');
    await mkdir(projectDir, { recursive: true });
    await writeFile(path.join(projectDir, '.seeya-audit'), 'abc123\n\n', 'utf8');

    const marker = new FsProjectAuditMarker();
    expect(await marker.read(root, 'auth-hardening')).toBe('abc123');
  });

  it('an empty marker file reads as null, never an empty-string hash', async () => {
    root = await makeTmpDir();
    const projectDir = path.join(root, 'auth-hardening');
    await mkdir(projectDir, { recursive: true });
    await writeFile(path.join(projectDir, '.seeya-audit'), '', 'utf8');

    const marker = new FsProjectAuditMarker();
    expect(await marker.read(root, 'auth-hardening')).toBeNull();
  });

  it('the marker for one project never affects another', async () => {
    root = await makeTmpDir();
    await mkdir(path.join(root, 'auth-hardening'), { recursive: true });
    await mkdir(path.join(root, 'billing-v2'), { recursive: true });
    const marker = new FsProjectAuditMarker();

    await marker.write(root, 'auth-hardening', 'auth-hash');

    expect(await marker.read(root, 'auth-hardening')).toBe('auth-hash');
    expect(await marker.read(root, 'billing-v2')).toBeNull();
  });
});
