/**
 * `packages/app/src/composition/project-details-reader.ts` (V2-T83) — what the "Project details"
 * dialog reads, exercised for real: a real `FsWorkspaceRepository` (a real `git init`), a real
 * `StorageAdapter`/`FsProjectLock`/`FsDirectoryExistence` over a tmpdir `~/.seeya`, and a real
 * lock held by this very process (a live pid, so `heldByLiveSession` is the genuine liveness
 * answer, not a fake). No commit is made, so no commit-msg hook (and no built CLI) is involved.
 */
import path from 'node:path';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { runGit } from '@seeya-ai/engine/adapters/git/run-git.js';
import { buildProjectSkeleton } from '@seeya-ai/engine/core/project-skeleton.js';
import { buildAppContext } from '../../../packages/app/src/composition/index.js';
import { readProjectDetails } from '../../../packages/app/src/composition/project-details-reader.js';
import { FakeAppInstallation } from './_fake-app-installation.js';
import {
  createDiscoveryFixture,
  removeDiscoveryFixture,
  type DiscoveryFixture,
} from '../discovery/_fixtures.js';
import { removeTempDir } from '../../_remove-temp-dir.js';

// Each case builds a real workspace repository and `buildAppContext`; the lock case also
// captures this process's own `procStart` — a real `powershell.exe` on Windows, ~3s the first
// time (the same cost `tests/integration/app/composition.test.ts` documents for
// `resolveProcessIdentity`). The deadline for that is the integration project's own
// (vitest.config.ts#INTEGRATION_TEST_TIMEOUT_MS, V2-T85), not a per-file override.

const IDENTITY = { host: 'example.com', owner: 'acme', repository: 'api' };

let fixture: DiscoveryFixture | undefined;
let extraDir: string | undefined;

afterEach(async () => {
  if (fixture !== undefined) {
    await removeDiscoveryFixture(fixture);
    fixture = undefined;
  }
  if (extraDir !== undefined) {
    await removeTempDir(extraDir);
    extraDir = undefined;
  }
});

async function prepareWorkspace(): Promise<{
  readonly context: Awaited<ReturnType<typeof buildAppContext>>;
  readonly root: string;
}> {
  fixture = await createDiscoveryFixture();
  const context = await buildAppContext(fixture.root, {
    appInstallation: new FakeAppInstallation(),
  });
  const root = path.join(fixture.seeyaHome, 'workspace');
  await context.workspace.initialize(root);
  const skeleton = buildProjectSkeleton('auth-hardening');
  await context.workspace.writeProjectSkeleton(root, 'auth-hardening', skeleton);
  const withRepositories = {
    ...skeleton.manifest,
    repositories: [
      {
        hasRemote: true as const,
        name: 'api',
        remote: 'git@example.com:acme/api.git',
        identity: IDENTITY,
      },
      { hasRemote: false as const, name: 'notes' },
      {
        hasRemote: true as const,
        name: 'web',
        remote: 'git@example.com:acme/web.git',
        identity: { host: 'example.com', owner: 'acme', repository: 'web' },
      },
    ],
  };
  await context.workspace.writeProjectManifest(root, 'auth-hardening', withRepositories);
  await runGit(root, ['add', '--', 'auth-hardening']);
  return { context, root };
}

describe('readProjectDetails (V2-T83, docs/INTERFACE.md § 4a)', () => {
  it('reads a repository on this device, one with no remote, and one the map has no entry for', async () => {
    const { context } = await prepareWorkspace();
    extraDir = await mkdtemp(path.join(tmpdir(), 'seeya-details-'));
    const apiDir = path.join(extraDir, 'api');
    const notesDir = path.join(extraDir, 'notes');
    await mkdir(apiDir);
    await mkdir(notesDir);
    await context.storage.saveRepositoryMap([
      { hasIdentity: true, identity: IDENTITY, path: apiDir },
      { hasIdentity: false, projectId: 'auth-hardening', name: 'notes', path: notesDir },
    ]);

    const details = await readProjectDetails(context, 'auth-hardening');

    if (details.kind !== 'found') {
      throw new Error(`expected a found project, got ${JSON.stringify(details)}`);
    }
    expect(details.name).toBe('auth-hardening');
    expect(details.dir).toBe(path.join(fixture!.seeyaHome, 'workspace', 'auth-hardening'));
    expect(details.repositories).toEqual([
      {
        name: 'api',
        remote: 'git@example.com:acme/api.git',
        localPath: { kind: 'onThisDevice', path: apiDir },
      },
      { name: 'notes', remote: null, localPath: { kind: 'onThisDevice', path: notesDir } },
      {
        name: 'web',
        remote: 'git@example.com:acme/web.git',
        localPath: { kind: 'notOnThisDevice' },
      },
    ]);
    expect(details.fileCount).toBeGreaterThan(0);
    expect(details.writeAccess).toEqual({ kind: 'open' });
  });

  it('a mapped path whose directory no longer exists reads as not on this device', async () => {
    const { context } = await prepareWorkspace();
    await context.storage.saveRepositoryMap([
      { hasIdentity: true, identity: IDENTITY, path: path.join(fixture!.root, 'gone') },
    ]);

    const details = await readProjectDetails(context, 'auth-hardening');

    if (details.kind !== 'found') throw new Error(JSON.stringify(details));
    expect(details.repositories[0]?.localPath).toEqual({ kind: 'notOnThisDevice' });
  });

  it("lists only this project's adoptions", async () => {
    const { context } = await prepareWorkspace();
    const adoptedAt = new Date('2026-09-24T10:00:00.000Z');
    await context.storage.saveAdoptions([
      {
        originalSessionId: '11111111-1111-4111-8111-111111111111',
        forkSessionId: '22222222-2222-4222-8222-222222222222',
        projectId: 'auth-hardening',
        adoptedAt,
      },
      {
        originalSessionId: '33333333-3333-4333-8333-333333333333',
        forkSessionId: '44444444-4444-4444-8444-444444444444',
        projectId: 'another-project',
        adoptedAt,
      },
    ]);

    const details = await readProjectDetails(context, 'auth-hardening');

    if (details.kind !== 'found') throw new Error(JSON.stringify(details));
    expect(details.adoptions.map((adoption) => adoption.forkSessionId)).toEqual([
      '22222222-2222-4222-8222-222222222222',
    ]);
    expect(details.adoptions[0]?.adoptedAt).toEqual(adoptedAt);
  });

  it('a lock held by a live process blocks writes and names the holder', async () => {
    const { context, root } = await prepareWorkspace();
    const identity = await context.resolveProcessIdentity();
    await context.projectLock.write(root, 'auth-hardening', {
      sessionId: 'abc123',
      pid: identity.pid,
      procStart: identity.procStart,
      acquiredAt: new Date('2026-09-24T10:00:00.000Z'),
    });

    const details = await readProjectDetails(context, 'auth-hardening');

    if (details.kind !== 'found') throw new Error(JSON.stringify(details));
    expect(details.writeAccess.kind).toBe('blocked');
    if (details.writeAccess.kind === 'blocked') {
      expect(details.writeAccess.heldByText).toContain('session abc123');
    }
  });

  it('a stale lock (a pid that no longer exists) does not block writes', async () => {
    const { context, root } = await prepareWorkspace();
    await context.projectLock.write(root, 'auth-hardening', {
      sessionId: 'abc123',
      pid: 2_147_483_000,
      procStart: undefined,
      acquiredAt: new Date('2026-09-24T10:00:00.000Z'),
    });

    const details = await readProjectDetails(context, 'auth-hardening');

    if (details.kind !== 'found') throw new Error(JSON.stringify(details));
    expect(details.writeAccess).toEqual({ kind: 'open' });
  });

  it('a project that does not exist is "notFound", never a throw', async () => {
    const { context } = await prepareWorkspace();

    expect(await readProjectDetails(context, 'no-such-project')).toEqual({
      kind: 'notFound',
      projectId: 'no-such-project',
    });
  });
});
