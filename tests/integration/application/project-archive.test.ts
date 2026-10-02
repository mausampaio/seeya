/**
 * V2-T84: `archiveProject`/`unarchiveProject` against a REAL workspace repository — the commit goes
 * through the workspace's own real `commit-msg` hook (the compiled CLI's `verify-commit`), which
 * refuses a `seeya.json` change that isn't marked as one of seeya's own manifest writes (V2-T73
 * item 1). Proves the mark is exactly what authorizes the archive commit: the same change, staged
 * and committed WITHOUT the mark, is refused.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Clock } from '@seeya-ai/engine/core/ports.js';
import { StorageAdapter } from '@seeya-ai/engine/adapters/storage/index.js';
import { FsWorkspaceRepository, FsProjectLock } from '@seeya-ai/engine/adapters/workspace/index.js';
import { processControl } from '@seeya-ai/engine/adapters/process/index.js';
import { runGit } from '@seeya-ai/engine/adapters/git/run-git.js';
import { createProject } from '@seeya-ai/engine/application/workspace.js';
import { archiveProject, unarchiveProject } from '@seeya-ai/engine/application/project-archive.js';
import type { ArchiveProjectDeps } from '@seeya-ai/engine/application/project-archive.js';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CLI_ENTRY_PATH = path.join(REPO_ROOT, 'packages', 'cli', 'dist', 'index.js');
// Same budget and same reasoning as `workspace-boundary.test.ts#WORKSPACE_CASE_TIMEOUT_MS`: each
// commit here shells out to a real hook, which shells out to the real compiled CLI.
const CASE_TIMEOUT_MS = 60_000;
const NOW = new Date('2026-10-02T10:00:00.000Z');

class FixedClock implements Clock {
  now(): Date {
    return NOW;
  }
  sleep(): Promise<void> {
    return Promise.resolve();
  }
}

function sessionId(): string | undefined {
  // The SAME source `packages/cli/src/composition.ts` reads in production, so the trailer and the
  // real hook agree even when this suite runs inside a live session.
  return process.env['CLAUDE_CODE_SESSION_ID'];
}

function buildDeps(
  storage: StorageAdapter,
  workspace: FsWorkspaceRepository,
  seeyaHome: string,
): ArchiveProjectDeps {
  return {
    storage,
    workspace,
    projectLock: new FsProjectLock(),
    processControl,
    clock: new FixedClock(),
    seeyaHome,
    sessionId: sessionId(),
    pid: process.pid,
    procStart: undefined,
  };
}

async function headMessage(root: string): Promise<string> {
  const result = await runGit(root, ['log', '-1', '--format=%B']);
  return result.ran ? result.stdout : '';
}

/** A plain `git commit` with NO `SEEYA_MANIFEST_WRITE_AUTHORIZED` — what a session would do. */
function unmarkedCommit(
  root: string,
  message: string,
): Promise<{ exitCode: number; stderr: string }> {
  return new Promise((resolve) => {
    const env = { ...process.env };
    delete env['SEEYA_MANIFEST_WRITE_AUTHORIZED'];
    const child = spawn('git', ['commit', '-m', message], {
      cwd: root,
      env: {
        ...env,
        GIT_AUTHOR_NAME: 'seeya-test',
        GIT_AUTHOR_EMAIL: 'seeya-test@localhost',
        GIT_COMMITTER_NAME: 'seeya-test',
        GIT_COMMITTER_EMAIL: 'seeya-test@localhost',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('close', (code) => resolve({ exitCode: code ?? -1, stderr }));
  });
}

describe('archiveProject / unarchiveProject against a real workspace (V2-T84)', () => {
  let seeyaHome: string | undefined;

  afterEach(async () => {
    if (seeyaHome !== undefined) {
      await rm(seeyaHome, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      seeyaHome = undefined;
    }
  });

  async function setUp(): Promise<{
    readonly home: string;
    readonly storage: StorageAdapter;
    readonly workspace: FsWorkspaceRepository;
    readonly root: string;
  }> {
    const home = await mkdtemp(path.join(tmpdir(), 'seeya-archive-'));
    seeyaHome = home;
    const storage = new StorageAdapter(home);
    const workspace = new FsWorkspaceRepository();
    await createProject(
      {
        storage,
        workspace,
        projectLock: new FsProjectLock(),
        processControl,
        seeyaHome: home,
        sessionId: sessionId(),
        nodePath: process.execPath,
        cliEntryPath: CLI_ENTRY_PATH,
      },
      'auth-hardening',
    );
    return { home, storage, workspace, root: path.join(home, 'workspace') };
  }

  it(
    'archives through the real hook, writing the keys and a trailered commit; unarchive reverses it',
    async () => {
      const { home, storage, workspace, root } = await setUp();
      const deps = buildDeps(storage, workspace, home);

      const archived = await archiveProject(deps, 'auth-hardening', 'Finished — shipped');

      expect(archived).toMatchObject({ kind: 'archived', note: 'Finished — shipped' });
      const onDisk = JSON.parse(
        await readFile(path.join(root, 'auth-hardening', 'seeya.json'), 'utf8'),
      ) as Record<string, unknown>;
      expect(onDisk['schemaVersion']).toBe(2);
      expect(onDisk['archivedAt']).toBe(NOW.toISOString());
      expect(onDisk['archiveNote']).toBe('Finished — shipped');
      const message = await headMessage(root);
      expect(message).toContain('Archive project auth-hardening');
      expect(message).toContain('Seeya-Project-Id: auth-hardening');
      expect(message).toContain('Seeya-Session-Id:');
      expect(await workspace.readProjectManifest(root, 'auth-hardening')).toMatchObject({
        lifecycle: { kind: 'archived', note: 'Finished — shipped' },
      });

      expect(await archiveProject(deps, 'auth-hardening')).toMatchObject({
        kind: 'alreadyArchived',
      });

      expect(await unarchiveProject(deps, 'auth-hardening')).toEqual({
        kind: 'unarchived',
        projectId: 'auth-hardening',
      });
      const afterUnarchive = JSON.parse(
        await readFile(path.join(root, 'auth-hardening', 'seeya.json'), 'utf8'),
      ) as Record<string, unknown>;
      expect(afterUnarchive).not.toHaveProperty('archivedAt');
      expect(afterUnarchive).not.toHaveProperty('archiveNote');
      expect(await headMessage(root)).toContain('Unarchive project auth-hardening');
    },
    CASE_TIMEOUT_MS,
  );

  it(
    'the same manifest change committed WITHOUT the write mark is refused — the mark is what authorizes it',
    async () => {
      const { home, storage, workspace, root } = await setUp();
      const manifest = await workspace.readProjectManifest(root, 'auth-hardening');
      if (manifest === null) {
        throw new Error('fixture project missing');
      }
      await workspace.writeProjectManifest(root, 'auth-hardening', {
        ...manifest,
        lifecycle: { kind: 'archived', archivedAt: NOW, note: null },
      });
      await runGit(root, ['add', 'auth-hardening']);

      const attempt = await unmarkedCommit(root, 'Archive it by hand');

      expect(attempt.exitCode).not.toBe(0);
      expect(attempt.stderr).toContain('auth-hardening/seeya.json');
      expect(buildDeps(storage, workspace, home).pid).toBe(process.pid);
    },
    CASE_TIMEOUT_MS,
  );
});
