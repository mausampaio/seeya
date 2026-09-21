/**
 * V2-T27 item 4: "o git do espaço de trabalho é do seeya, e ele commita o que cria — mas nunca
 * entra aí nada de `~/.seeya/` (estado operacional, locks, config do dispositivo). A separação é
 * explícita e testada." This is that test — a real `StorageAdapter` (`~/.seeya/`) and a real
 * `FsWorkspaceRepository` (the workspace's own git repository), both against the same real
 * `tmpdir`, with genuine sibling `~/.seeya/` operational files already present before
 * `createProject` ever runs. Proven by execution, not by argument: the workspace's own `git
 * ls-files` is inspected directly, not just "the default path is a subdirectory so it should be
 * fine".
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { StorageAdapter } from '@seeya-ai/engine/adapters/storage/index.js';
import { FsWorkspaceRepository } from '@seeya-ai/engine/adapters/workspace/index.js';
import { runGit } from '@seeya-ai/engine/adapters/git/run-git.js';
import { createProject } from '@seeya-ai/engine/application/workspace.js';

async function makeTmpDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'seeya-workspace-boundary-'));
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

describe('the workspace repository never tracks ~/.seeya/ operational state', () => {
  let seeyaHome: string | undefined;

  afterEach(async () => {
    if (seeyaHome !== undefined) {
      await rm(seeyaHome, { recursive: true, force: true });
      seeyaHome = undefined;
    }
  });

  it('git ls-files inside the workspace never names an operational file from ~/.seeya/', async () => {
    seeyaHome = await makeTmpDir();
    // Genuine ~/.seeya/ operational content, present BEFORE the workspace is ever created —
    // exactly the layout a real machine has (config.json/estado.json/daemon.lock siblings of the
    // workspace/ subdirectory). Anonymized fixture content only (AGENTS.md § "Este projeto é de
    // código aberto") — no real path, token or session data.
    await writeFile(
      path.join(seeyaHome, 'config.json'),
      JSON.stringify({ schemaVersion: 1 }),
      'utf8',
    );
    await writeFile(
      path.join(seeyaHome, 'estado.json'),
      JSON.stringify({ schemaVersion: 1 }),
      'utf8',
    );
    await writeFile(path.join(seeyaHome, 'daemon.lock'), JSON.stringify({ pid: 1234 }), 'utf8');

    const storage = new StorageAdapter(seeyaHome);
    const workspace = new FsWorkspaceRepository();
    const result = await createProject({ storage, workspace, seeyaHome }, 'auth-hardening');
    expect(result.kind).toBe('created');

    const workspaceRoot = path.join(seeyaHome, 'workspace');
    const lsFiles = await runGit(workspaceRoot, ['ls-files']);
    if (!lsFiles.ran) {
      throw new Error(`git ls-files never ran: ${lsFiles.reason}`);
    }
    expect(lsFiles.exitCode).toBe(0);
    const trackedFiles = lsFiles.stdout
      .trim()
      .split(/\r?\n/)
      .filter((line: string) => line.length > 0);

    // Every tracked path belongs to the project just created, nothing else.
    expect(trackedFiles.length).toBeGreaterThan(0);
    for (const file of trackedFiles) {
      expect(file.startsWith('auth-hardening/')).toBe(true);
    }
    // The operational files by name, explicitly — the strongest form of this assertion.
    expect(trackedFiles).not.toContain('config.json');
    expect(trackedFiles).not.toContain('estado.json');
    expect(trackedFiles).not.toContain('daemon.lock');
    expect(trackedFiles).not.toContain('workspace.json');
  });

  it('the workspace git repository root is the workspace/ subdirectory, not ~/.seeya/ itself', async () => {
    seeyaHome = await makeTmpDir();
    const storage = new StorageAdapter(seeyaHome);
    const workspace = new FsWorkspaceRepository();
    await createProject({ storage, workspace, seeyaHome }, 'auth-hardening');

    // `.git` lives one level down — ~/.seeya/ itself is never a git working tree, so nothing
    // outside workspace/ could ever be tracked no matter what a future writeProjectSkeleton call
    // does.
    expect(await pathExists(path.join(seeyaHome, '.git'))).toBe(false);
    expect(await pathExists(path.join(seeyaHome, 'workspace', '.git'))).toBe(true);
  });

  it('workspace.json (the pointer to where the workspace lives) is written outside the workspace itself', async () => {
    seeyaHome = await makeTmpDir();
    const storage = new StorageAdapter(seeyaHome);
    const workspace = new FsWorkspaceRepository();
    await createProject({ storage, workspace, seeyaHome }, 'auth-hardening');

    expect(await pathExists(path.join(seeyaHome, 'workspace.json'))).toBe(true);
    expect(await pathExists(path.join(seeyaHome, 'workspace', 'workspace.json'))).toBe(false);
  });
});
