/**
 * `revertAdoption` (V2-T32, `application/project-revert-adoption.ts`) — against the same named
 * doubles `project-adopt.test.ts` already uses, plus `FakeWorkspaceRepository`'s own V2-T32 hooks
 * (`setSessionCommits`/`setCommitsAfter`/`setRevertOutcome`/`revertCalls`) and `FakeForkCleanup`'s
 * `setForkActivity`.
 */
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { revertAdoption } from '@seeya-ai/engine/application/project-revert-adoption.js';
import type { RevertAdoptionDeps } from '@seeya-ai/engine/application/project-revert-adoption.js';
import { createProject } from '@seeya-ai/engine/application/workspace.js';
import type { AdoptionRecord } from '@seeya-ai/engine/core/types.js';
import type { RevertCommitInfo } from '@seeya-ai/engine/core/ports.js';
import {
  ControllableProcessControl,
  DEFAULT_TEST_CONFIG,
  FakeClock,
  FakeForkCleanup,
  FakeProjectLock,
  FakeWorkspaceRepository,
  InMemoryDeviceStorage,
} from './_fakes.js';

const SEEYA_HOME = path.resolve(path.sep, 'seeya-home-fixture');
const WORKSPACE_ROOT = path.join(SEEYA_HOME, 'workspace');
const NOW = new Date('2026-09-24T12:00:00.000Z');
const THIS_PID = 4242;

const ORIGINAL_SESSION_ID = '11111111-1111-4111-8111-111111111111';
const FORK_SESSION_ID = '22222222-2222-4222-8222-222222222222';
const ADOPTED_AT = new Date('2026-09-23T10:00:00.000Z');

const RECORD: AdoptionRecord = {
  originalSessionId: ORIGINAL_SESSION_ID,
  forkSessionId: FORK_SESSION_ID,
  projectId: 'auth-hardening',
  adoptedAt: ADOPTED_AT,
};

const SESSION_COMMIT: RevertCommitInfo = {
  hash: 'fork-commit-1',
  files: ['auth-hardening/context/know-how.md'],
};

function buildDeps(
  storage: InMemoryDeviceStorage,
  workspace: FakeWorkspaceRepository,
  forkCleanup: FakeForkCleanup,
  overrides: Partial<RevertAdoptionDeps> = {},
): RevertAdoptionDeps {
  return {
    storage,
    workspace,
    projectLock: new FakeProjectLock(),
    processControl: new ControllableProcessControl(),
    forkCleanup,
    clock: new FakeClock(NOW),
    seeyaHome: SEEYA_HOME,
    sessionId: undefined,
    pid: THIS_PID,
    procStart: undefined,
    ...overrides,
  };
}

describe('revertAdoption', () => {
  let storage: InMemoryDeviceStorage;
  let workspace: FakeWorkspaceRepository;
  let forkCleanup: FakeForkCleanup;

  beforeEach(async () => {
    storage = new InMemoryDeviceStorage(DEFAULT_TEST_CONFIG);
    workspace = new FakeWorkspaceRepository();
    forkCleanup = new FakeForkCleanup();
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
    await storage.saveAdoptions([RECORD]);
    workspace.setSessionCommits('auth-hardening', FORK_SESSION_ID, [SESSION_COMMIT]);
  });

  it('refuses an invalid project id without touching any port', async () => {
    const result = await revertAdoption(
      buildDeps(storage, workspace, forkCleanup),
      'Not Valid',
      undefined,
    );
    expect(result).toEqual({ kind: 'invalidId', projectId: 'Not Valid' });
  });

  it('reports noAdoption when the project has no adopted session at all', async () => {
    await storage.saveAdoptions([]);
    const result = await revertAdoption(
      buildDeps(storage, workspace, forkCleanup),
      'auth-hardening',
      undefined,
    );
    expect(result).toEqual({ kind: 'noAdoption', projectId: 'auth-hardening' });
  });

  it('reports sessionNotFound when a session argument matches nothing (item 5)', async () => {
    const result = await revertAdoption(
      buildDeps(storage, workspace, forkCleanup),
      'auth-hardening',
      'zzzz',
    );
    expect(result).toEqual({
      kind: 'sessionNotFound',
      projectId: 'auth-hardening',
      sessionRef: 'zzzz',
    });
  });

  it('reports ambiguousAdoption when the project has more than one and no session was given', async () => {
    const second: AdoptionRecord = {
      originalSessionId: '33333333-3333-4333-8333-333333333333',
      forkSessionId: '44444444-4444-4444-8444-444444444444',
      projectId: 'auth-hardening',
      adoptedAt: new Date('2026-09-23T11:00:00.000Z'),
    };
    await storage.saveAdoptions([RECORD, second]);
    const result = await revertAdoption(
      buildDeps(storage, workspace, forkCleanup),
      'auth-hardening',
      undefined,
    );
    expect(result).toEqual({
      kind: 'ambiguousAdoption',
      projectId: 'auth-hardening',
      matches: [RECORD, second],
    });
  });

  it("resolves a lone adoption by the fork's own session id (item 5)", async () => {
    const result = await revertAdoption(
      buildDeps(storage, workspace, forkCleanup),
      'auth-hardening',
      FORK_SESSION_ID,
      { confirmRevert: () => Promise.resolve('proceed') },
    );
    expect(result.kind).toBe('reverted');
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

    const result = await revertAdoption(
      buildDeps(storage, workspace, forkCleanup, { projectLock, processControl }),
      'auth-hardening',
      undefined,
      { confirmRevert: () => Promise.resolve('proceed') },
    );
    expect(result.kind).toBe('projectLocked');
    expect(workspace.revertCalls).toHaveLength(0);
  });

  it('reports nothingToRevert when the fork never committed inside the project (D-025)', async () => {
    workspace.setSessionCommits('auth-hardening', FORK_SESSION_ID, []);
    const result = await revertAdoption(
      buildDeps(storage, workspace, forkCleanup),
      'auth-hardening',
      undefined,
    );
    expect(result).toEqual({
      kind: 'nothingToRevert',
      projectId: 'auth-hardening',
      originalSessionId: ORIGINAL_SESSION_ID,
      forkSessionId: FORK_SESSION_ID,
    });
    // Still registered — nothing was reverted, so the original is NOT adoptable again.
    expect(await storage.readAdoptions()).toEqual([RECORD]);
  });

  it('refuses (blocked) when a later commit from a different session touched the same files', async () => {
    workspace.setCommitsAfter('auth-hardening', 'fork-commit-1', [
      { hash: 'later-commit', files: ['auth-hardening/context/know-how.md'] },
    ]);
    const result = await revertAdoption(
      buildDeps(storage, workspace, forkCleanup),
      'auth-hardening',
      undefined,
      { confirmRevert: () => Promise.resolve('proceed') },
    );
    expect(result).toEqual({
      kind: 'blocked',
      projectId: 'auth-hardening',
      originalSessionId: ORIGINAL_SESSION_ID,
      forkSessionId: FORK_SESSION_ID,
      blockingCommit: 'later-commit',
    });
    expect(workspace.revertCalls).toHaveLength(0);
    expect(await storage.readAdoptions()).toEqual([RECORD]);
  });

  it('does not revert anything when the person declines the revert confirmation', async () => {
    const result = await revertAdoption(
      buildDeps(storage, workspace, forkCleanup),
      'auth-hardening',
      undefined,
      { confirmRevert: () => Promise.resolve('decline') },
    );
    expect(result.kind).toBe('confirmationDeclined');
    expect(workspace.revertCalls).toHaveLength(0);
    expect(await storage.readAdoptions()).toEqual([RECORD]);
  });

  it('refuses without asking when there is no way to confirm the revert (D-025)', async () => {
    const result = await revertAdoption(
      buildDeps(storage, workspace, forkCleanup),
      'auth-hardening',
      undefined,
    );
    expect(result.kind).toBe('confirmationUnavailable');
    expect(workspace.revertCalls).toHaveLength(0);
  });

  it('shows the commits newest-first in the confirmation', async () => {
    const older: RevertCommitInfo = { hash: 'fork-commit-0', files: ['auth-hardening/AGENTS.md'] };
    workspace.setSessionCommits('auth-hardening', FORK_SESSION_ID, [older, SESSION_COMMIT]);
    let shownCommits: readonly string[] | undefined;
    await revertAdoption(buildDeps(storage, workspace, forkCleanup), 'auth-hardening', undefined, {
      confirmRevert: ({ commitsNewestFirst }) => {
        shownCommits = commitsNewestFirst;
        return Promise.resolve('proceed');
      },
    });
    expect(shownCommits).toEqual(['fork-commit-1', 'fork-commit-0']);
  });

  it('reports revertFailed when git itself could not apply the sequence cleanly', async () => {
    workspace.setRevertOutcome({ kind: 'failed', hash: 'fork-commit-1', reason: 'exit 1' });
    const result = await revertAdoption(
      buildDeps(storage, workspace, forkCleanup),
      'auth-hardening',
      undefined,
      { confirmRevert: () => Promise.resolve('proceed') },
    );
    expect(result).toEqual({
      kind: 'revertFailed',
      projectId: 'auth-hardening',
      originalSessionId: ORIGINAL_SESSION_ID,
      forkSessionId: FORK_SESSION_ID,
      failedCommit: 'fork-commit-1',
    });
    // Nothing committed — the original is still on record as adopted.
    expect(await storage.readAdoptions()).toEqual([RECORD]);
  });

  describe('once the revert itself succeeds', () => {
    function revertSuccessfully(overrides: Partial<RevertAdoptionDeps> = {}) {
      return revertAdoption(
        buildDeps(storage, workspace, forkCleanup, overrides),
        'auth-hardening',
        undefined,
        { confirmRevert: () => Promise.resolve('proceed') },
      );
    }

    it('removes the adoption record — the original session becomes adoptable again', async () => {
      forkCleanup.setForkActivity(FORK_SESSION_ID, { kind: 'notFound' });
      await revertSuccessfully();
      expect(await storage.readAdoptions()).toEqual([]);
    });

    it('makes a single commit with a message naming the fork session and project', async () => {
      await revertSuccessfully();
      expect(workspace.revertCalls).toHaveLength(1);
      expect(workspace.revertCalls[0]).toMatchObject({
        projectId: 'auth-hardening',
        commitsNewestFirst: ['fork-commit-1'],
      });
      expect(workspace.revertCalls[0]?.message).toContain(
        `Revert adoption of session ${FORK_SESSION_ID} from project auth-hardening`,
      );
    });

    it('deletes the copy WITHOUT asking when it never wrote after being adopted (unchanged)', async () => {
      forkCleanup.setForkActivity(FORK_SESSION_ID, {
        kind: 'found',
        lastWrite: new Date(ADOPTED_AT.getTime() - 1000),
        sizeBytes: 100,
      });
      const result = await revertSuccessfully();
      expect(result.kind).toBe('reverted');
      expect(result.kind === 'reverted' && result.copyOutcome).toEqual({ kind: 'deleted' });
      expect(forkCleanup.deletedSessionIds).toEqual([FORK_SESSION_ID]);
    });

    it('asks before deleting when the copy grew after adoption, and keeps it on an explicit decline (item 6 default)', async () => {
      const lastWrite = new Date(ADOPTED_AT.getTime() + 1000);
      forkCleanup.setForkActivity(FORK_SESSION_ID, { kind: 'found', lastWrite, sizeBytes: 4096 });
      const result = await revertAdoption(
        buildDeps(storage, workspace, forkCleanup),
        'auth-hardening',
        undefined,
        {
          confirmRevert: () => Promise.resolve('proceed'),
          confirmDeleteCopy: () => Promise.resolve('keep'),
        },
      );
      expect(result.kind === 'reverted' && result.copyOutcome).toEqual({
        kind: 'kept',
        reason: 'grew',
      });
      expect(forkCleanup.deletedSessionIds).toEqual([]);
    });

    it('deletes the copy when it grew after adoption and the answer is explicit delete', async () => {
      const lastWrite = new Date(ADOPTED_AT.getTime() + 1000);
      forkCleanup.setForkActivity(FORK_SESSION_ID, { kind: 'found', lastWrite, sizeBytes: 4096 });
      const result = await revertAdoption(
        buildDeps(storage, workspace, forkCleanup),
        'auth-hardening',
        undefined,
        {
          confirmRevert: () => Promise.resolve('proceed'),
          confirmDeleteCopy: () => Promise.resolve('delete'),
        },
      );
      expect(result.kind === 'reverted' && result.copyOutcome).toEqual({ kind: 'deleted' });
      expect(forkCleanup.deletedSessionIds).toEqual([FORK_SESSION_ID]);
    });

    it('keeps the copy, reason unknownGrowth, when its transcript cannot be found at all', async () => {
      forkCleanup.setForkActivity(FORK_SESSION_ID, { kind: 'notFound' });
      const result = await revertAdoption(
        buildDeps(storage, workspace, forkCleanup),
        'auth-hardening',
        undefined,
        {
          confirmRevert: () => Promise.resolve('proceed'),
          confirmDeleteCopy: () => Promise.resolve('keep'),
        },
      );
      expect(result.kind === 'reverted' && result.copyOutcome).toEqual({
        kind: 'kept',
        reason: 'unknownGrowth',
      });
    });

    it('keeps the copy, reason confirmationUnavailable, when it grew but there is no way to ask (D-025 default: keep)', async () => {
      const lastWrite = new Date(ADOPTED_AT.getTime() + 1000);
      forkCleanup.setForkActivity(FORK_SESSION_ID, { kind: 'found', lastWrite, sizeBytes: 4096 });
      const result = await revertSuccessfully();
      expect(result.kind === 'reverted' && result.copyOutcome).toEqual({
        kind: 'kept',
        reason: 'confirmationUnavailable',
      });
      expect(forkCleanup.deletedSessionIds).toEqual([]);
    });

    it('releases the project lock once everything is done', async () => {
      const projectLock = new FakeProjectLock();
      forkCleanup.setForkActivity(FORK_SESSION_ID, { kind: 'notFound' });
      await revertSuccessfully({ projectLock });
      expect(await projectLock.read(WORKSPACE_ROOT, 'auth-hardening')).toBeNull();
    });
  });
});
