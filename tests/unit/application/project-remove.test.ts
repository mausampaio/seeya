/**
 * `removeProject` (V2-T32, `application/project-remove.ts`) — against the same named doubles
 * `project-open.test.ts`/`project-adopt.test.ts` already use, plus `FakeWorkspaceRepository`'s own
 * V2-T32 hooks (`setCurrentCommit`/`setFileCount`/`wasProjectDirRemoved`).
 */
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { removeProject } from '@seeya-ai/engine/application/project-remove.js';
import type { RemoveProjectDeps } from '@seeya-ai/engine/application/project-remove.js';
import { createProject } from '@seeya-ai/engine/application/workspace.js';
import type { AdoptionRecord } from '@seeya-ai/engine/core/types.js';
import {
  ControllableProcessControl,
  DEFAULT_TEST_CONFIG,
  FakeClock,
  FakeProjectLock,
  FakeWorkspaceRepository,
  InMemoryDeviceStorage,
} from './_fakes.js';

const SEEYA_HOME = path.resolve(path.sep, 'seeya-home-fixture');
const WORKSPACE_ROOT = path.join(SEEYA_HOME, 'workspace');
const NOW = new Date('2026-09-24T10:00:00.000Z');
const THIS_PID = 4242;

const ADOPTION_FOR_PROJECT: AdoptionRecord = {
  originalSessionId: '11111111-1111-4111-8111-111111111111',
  forkSessionId: '22222222-2222-4222-8222-222222222222',
  projectId: 'auth-hardening',
  adoptedAt: new Date('2026-09-23T10:00:00.000Z'),
};

const ADOPTION_FOR_OTHER_PROJECT: AdoptionRecord = {
  originalSessionId: '33333333-3333-4333-8333-333333333333',
  forkSessionId: '44444444-4444-4444-8444-444444444444',
  projectId: 'billing-v2',
  adoptedAt: new Date('2026-09-23T11:00:00.000Z'),
};

function buildDeps(
  storage: InMemoryDeviceStorage,
  workspace: FakeWorkspaceRepository,
  overrides: Partial<RemoveProjectDeps> = {},
): RemoveProjectDeps {
  return {
    storage,
    workspace,
    projectLock: new FakeProjectLock(),
    processControl: new ControllableProcessControl(),
    clock: new FakeClock(NOW),
    seeyaHome: SEEYA_HOME,
    sessionId: undefined,
    pid: THIS_PID,
    procStart: undefined,
    ...overrides,
  };
}

describe('removeProject', () => {
  let storage: InMemoryDeviceStorage;
  let workspace: FakeWorkspaceRepository;

  beforeEach(async () => {
    storage = new InMemoryDeviceStorage(DEFAULT_TEST_CONFIG);
    workspace = new FakeWorkspaceRepository();
    await createProject(
      {
        storage,
        workspace,
        projectLock: new FakeProjectLock(),
        processControl: new ControllableProcessControl(),
        seeyaHome: SEEYA_HOME,
        sessionId: undefined,
        nodePath: 'node',
        cliEntryPath: '/fake/cli-entry.js',
      },
      'auth-hardening',
    );
  });

  it('refuses an invalid project id without touching any port', async () => {
    const result = await removeProject(buildDeps(storage, workspace), 'Not Valid');
    expect(result).toEqual({ kind: 'invalidId', projectId: 'Not Valid' });
    expect(workspace.wasProjectDirRemoved('Not Valid')).toBe(false);
  });

  it('reports notFound for an id never created', async () => {
    const result = await removeProject(buildDeps(storage, workspace), 'ghost');
    expect(result).toEqual({ kind: 'notFound', projectId: 'ghost' });
  });

  it('refuses when the project is locked by another LIVE session (D-047 item 8)', async () => {
    const projectLock = new FakeProjectLock();
    await projectLock.write(WORKSPACE_ROOT, 'auth-hardening', {
      sessionId: 'other-session',
      pid: 555,
      procStart: undefined,
      acquiredAt: new Date('2026-09-24T09:00:00.000Z'),
    });
    const processControl = new ControllableProcessControl(new Map([[555, true]]));

    const result = await removeProject(
      buildDeps(storage, workspace, { projectLock, processControl }),
      'auth-hardening',
      { confirmRemove: () => Promise.resolve('proceed') },
    );

    expect(result.kind).toBe('projectLocked');
    expect(workspace.wasProjectDirRemoved('auth-hardening')).toBe(false);
  });

  it('a stale (dead-process) lock is reclaimed, not refused', async () => {
    const projectLock = new FakeProjectLock();
    await projectLock.write(WORKSPACE_ROOT, 'auth-hardening', {
      sessionId: 'stale-session',
      pid: 9999,
      procStart: undefined,
      acquiredAt: new Date('2026-09-01T00:00:00.000Z'),
    });
    const result = await removeProject(
      buildDeps(storage, workspace, { projectLock }),
      'auth-hardening',
      { confirmRemove: () => Promise.resolve('proceed') },
    );
    expect(result.kind).toBe('removed');
  });

  it('refuses without asking when there is no way to confirm (D-025)', async () => {
    const projectLock = new FakeProjectLock();
    const result = await removeProject(
      buildDeps(storage, workspace, { projectLock }),
      'auth-hardening',
    );
    expect(result).toEqual({ kind: 'confirmationUnavailable', projectId: 'auth-hardening' });
    expect(workspace.wasProjectDirRemoved('auth-hardening')).toBe(false);
    // The lock this attempt took is released, not left over for the next command.
    expect(await projectLock.read(WORKSPACE_ROOT, 'auth-hardening')).toBeNull();
  });

  it('does not remove anything when the person declines', async () => {
    const result = await removeProject(buildDeps(storage, workspace), 'auth-hardening', {
      confirmRemove: () => Promise.resolve('decline'),
    });
    expect(result).toEqual({ kind: 'confirmationDeclined', projectId: 'auth-hardening' });
    expect(workspace.wasProjectDirRemoved('auth-hardening')).toBe(false);
  });

  it('passes the project name and file count to the confirmation, and removes on proceed', async () => {
    workspace.setFileCount('auth-hardening', 7);
    workspace.setCurrentCommit('abc123');
    let confirmed: { projectId: string; name: string; fileCount: number } | undefined;

    const result = await removeProject(buildDeps(storage, workspace), 'auth-hardening', {
      confirmRemove: (info) => {
        confirmed = info;
        return Promise.resolve('proceed');
      },
    });

    expect(confirmed).toEqual({
      projectId: 'auth-hardening',
      name: 'auth-hardening',
      fileCount: 7,
    });
    expect(result).toEqual({
      kind: 'removed',
      projectId: 'auth-hardening',
      fileCount: 7,
      previousCommit: 'abc123',
      removedAdoptions: [],
    });
    expect(workspace.wasProjectDirRemoved('auth-hardening')).toBe(true);
    expect(workspace.commitMessages.at(-1)).toContain('Remove project auth-hardening');
  });

  it("drops this project's own adoptions from adoptions.json, leaving other projects' untouched (item 7)", async () => {
    await storage.saveAdoptions([ADOPTION_FOR_PROJECT, ADOPTION_FOR_OTHER_PROJECT]);

    const result = await removeProject(buildDeps(storage, workspace), 'auth-hardening', {
      confirmRemove: () => Promise.resolve('proceed'),
    });

    expect(result.kind).toBe('removed');
    expect(result.kind === 'removed' && result.removedAdoptions).toEqual([
      {
        originalSessionId: ADOPTION_FOR_PROJECT.originalSessionId,
        forkSessionId: ADOPTION_FOR_PROJECT.forkSessionId,
      },
    ]);
    expect(await storage.readAdoptions()).toEqual([ADOPTION_FOR_OTHER_PROJECT]);
  });

  it('releases the lock after removing, even though it never launches anything', async () => {
    const projectLock = new FakeProjectLock();
    await removeProject(buildDeps(storage, workspace, { projectLock }), 'auth-hardening', {
      confirmRemove: () => Promise.resolve('proceed'),
    });
    expect(await projectLock.read(WORKSPACE_ROOT, 'auth-hardening')).toBeNull();
  });
});
