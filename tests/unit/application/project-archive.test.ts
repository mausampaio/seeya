/**
 * `archiveProject`/`unarchiveProject` (V2-T84, `application/project-archive.ts`) — against the same
 * named doubles `project-remove-repo.test.ts` uses (`createProject` sets up each scenario).
 */
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  archiveProject,
  normalizeArchiveNote,
  unarchiveProject,
} from '@seeya-ai/engine/application/project-archive.js';
import type { ArchiveProjectDeps } from '@seeya-ai/engine/application/project-archive.js';
import { createProject } from '@seeya-ai/engine/application/workspace.js';
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
const NOW = new Date('2026-10-02T10:00:00.000Z');
const THIS_PID = 4242;

function buildDeps(
  storage: InMemoryDeviceStorage,
  workspace: FakeWorkspaceRepository,
  overrides: Partial<ArchiveProjectDeps> = {},
): ArchiveProjectDeps {
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

async function createAuthHardening(
  storage: InMemoryDeviceStorage,
  workspace: FakeWorkspaceRepository,
): Promise<void> {
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
}

async function holdLockFromAnotherLiveSession(): Promise<{
  readonly projectLock: FakeProjectLock;
  readonly processControl: ControllableProcessControl;
}> {
  const projectLock = new FakeProjectLock();
  await projectLock.write(WORKSPACE_ROOT, 'auth-hardening', {
    sessionId: 'other-session',
    pid: 555,
    procStart: undefined,
    acquiredAt: new Date('2026-10-02T09:00:00.000Z'),
  });
  return { projectLock, processControl: new ControllableProcessControl(new Map([[555, true]])) };
}

describe('normalizeArchiveNote', () => {
  it('trims, and treats empty or whitespace-only as no note', () => {
    expect(normalizeArchiveNote('  Finished  ')).toBe('Finished');
    expect(normalizeArchiveNote('   ')).toBeNull();
    expect(normalizeArchiveNote('')).toBeNull();
    expect(normalizeArchiveNote(undefined)).toBeNull();
  });
});

describe('archiveProject', () => {
  let storage: InMemoryDeviceStorage;
  let workspace: FakeWorkspaceRepository;

  beforeEach(() => {
    storage = new InMemoryDeviceStorage(DEFAULT_TEST_CONFIG);
    workspace = new FakeWorkspaceRepository();
  });

  it('refuses an invalid id and reports a missing project', async () => {
    expect(await archiveProject(buildDeps(storage, workspace), 'Not Valid')).toEqual({
      kind: 'invalidId',
      projectId: 'Not Valid',
    });
    expect(await archiveProject(buildDeps(storage, workspace), 'ghost')).toEqual({
      kind: 'notFound',
      projectId: 'ghost',
    });
  });

  it('archives with the clock date and the note, committing with the manifest-write mark', async () => {
    await createAuthHardening(storage, workspace);
    const commitsBefore = workspace.commitMessages.length;

    const result = await archiveProject(
      buildDeps(storage, workspace),
      'auth-hardening',
      '  Finished — shipped  ',
    );

    expect(result).toEqual({
      kind: 'archived',
      projectId: 'auth-hardening',
      archivedAt: NOW,
      note: 'Finished — shipped',
    });
    const manifest = await workspace.readProjectManifest(WORKSPACE_ROOT, 'auth-hardening');
    expect(manifest?.lifecycle).toEqual({
      kind: 'archived',
      archivedAt: NOW,
      note: 'Finished — shipped',
    });
    expect(workspace.commitMessages).toHaveLength(commitsBefore + 1);
    expect(workspace.commitMessages.at(-1)).toContain('Archive project auth-hardening');
    expect(workspace.commitMessages.at(-1)).toContain('Seeya-Project-Id: auth-hardening');
    expect(workspace.commitAllManifestWriteAuthorized.at(-1)).toBe(true);
    expect(workspace.commitAllLockHolders.at(-1)).toEqual({ pid: THIS_PID, procStart: undefined });
  });

  it('archives without a note as note null', async () => {
    await createAuthHardening(storage, workspace);
    const result = await archiveProject(buildDeps(storage, workspace), 'auth-hardening');
    expect(result).toMatchObject({ kind: 'archived', note: null });
  });

  it('says alreadyArchived, with the original date, and commits nothing', async () => {
    await createAuthHardening(storage, workspace);
    await archiveProject(buildDeps(storage, workspace), 'auth-hardening', 'first');
    const commitsBefore = workspace.commitMessages.length;

    const later = buildDeps(storage, workspace, {
      clock: new FakeClock(new Date('2026-11-01T00:00:00.000Z')),
    });
    const result = await archiveProject(later, 'auth-hardening', 'second');

    expect(result).toEqual({
      kind: 'alreadyArchived',
      projectId: 'auth-hardening',
      archivedAt: NOW,
    });
    expect(workspace.commitMessages).toHaveLength(commitsBefore);
  });

  it('refuses while ANOTHER live session holds the lock, leaving the manifest untouched', async () => {
    await createAuthHardening(storage, workspace);
    const held = await holdLockFromAnotherLiveSession();

    const result = await archiveProject(buildDeps(storage, workspace, held), 'auth-hardening');

    expect(result.kind).toBe('locked');
    const manifest = await workspace.readProjectManifest(WORKSPACE_ROOT, 'auth-hardening');
    expect(manifest?.lifecycle).toEqual({ kind: 'active' });
  });

  it('releases the lock even when the commit throws', async () => {
    await createAuthHardening(storage, workspace);
    workspace.failNextCommitWith('git commit failed: hook refused');
    const projectLock = new FakeProjectLock();

    await expect(
      archiveProject(buildDeps(storage, workspace, { projectLock }), 'auth-hardening'),
    ).rejects.toThrow(/git commit failed/);

    expect(await projectLock.read(WORKSPACE_ROOT, 'auth-hardening')).toBeNull();
  });
});

describe('unarchiveProject', () => {
  let storage: InMemoryDeviceStorage;
  let workspace: FakeWorkspaceRepository;

  beforeEach(() => {
    storage = new InMemoryDeviceStorage(DEFAULT_TEST_CONFIG);
    workspace = new FakeWorkspaceRepository();
  });

  it('refuses an invalid id and reports a missing project', async () => {
    expect(await unarchiveProject(buildDeps(storage, workspace), 'Not Valid')).toEqual({
      kind: 'invalidId',
      projectId: 'Not Valid',
    });
    expect(await unarchiveProject(buildDeps(storage, workspace), 'ghost')).toEqual({
      kind: 'notFound',
      projectId: 'ghost',
    });
  });

  it('says alreadyActive for a project that was never archived, committing nothing', async () => {
    await createAuthHardening(storage, workspace);
    const commitsBefore = workspace.commitMessages.length;

    const result = await unarchiveProject(buildDeps(storage, workspace), 'auth-hardening');

    expect(result).toEqual({ kind: 'alreadyActive', projectId: 'auth-hardening' });
    expect(workspace.commitMessages).toHaveLength(commitsBefore);
  });

  it('round-trips: archive then unarchive leaves an active manifest and two commits', async () => {
    await createAuthHardening(storage, workspace);
    await archiveProject(buildDeps(storage, workspace), 'auth-hardening', 'done');

    const result = await unarchiveProject(buildDeps(storage, workspace), 'auth-hardening');

    expect(result).toEqual({ kind: 'unarchived', projectId: 'auth-hardening' });
    const manifest = await workspace.readProjectManifest(WORKSPACE_ROOT, 'auth-hardening');
    expect(manifest?.lifecycle).toEqual({ kind: 'active' });
    expect(workspace.commitMessages.at(-1)).toContain('Unarchive project auth-hardening');
    expect(workspace.commitAllManifestWriteAuthorized.at(-1)).toBe(true);
  });

  it('refuses while another live session holds the lock', async () => {
    await createAuthHardening(storage, workspace);
    await archiveProject(buildDeps(storage, workspace), 'auth-hardening');
    const held = await holdLockFromAnotherLiveSession();

    const result = await unarchiveProject(buildDeps(storage, workspace, held), 'auth-hardening');

    expect(result.kind).toBe('locked');
    const manifest = await workspace.readProjectManifest(WORKSPACE_ROOT, 'auth-hardening');
    expect(manifest?.lifecycle.kind).toBe('archived');
  });
});
