/**
 * `adoptSession` (V2-T29, `application/project-adopt.ts`) — against the same named doubles
 * `project-open.test.ts` already uses for the ports they share, plus `_adopt-fakes.ts`'s own
 * `FakeForkRegistration`/`FakeSessionAdoptionLauncher`.
 */
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { adoptSession } from '@seeya-ai/engine/application/project-adopt.js';
import type {
  AdoptSessionCallbacks,
  AdoptSessionDeps,
} from '@seeya-ai/engine/application/project-adopt.js';
import { createSessionWithPid } from '../core/_fixtures.js';
import {
  ControllableProcessControl,
  DEFAULT_TEST_CONFIG,
  FakeClock,
  FakeForkCleanup,
  FakeProjectLock,
  FakeWorkspaceRepository,
  InMemoryDeviceStorage,
} from './_fakes.js';
import { FakeForkRegistration, FakeSessionAdoptionLauncher } from './_adopt-fakes.js';

const SEEYA_HOME = path.resolve(path.sep, 'seeya-home-fixture');
const WORKSPACE_ROOT = path.join(SEEYA_HOME, 'workspace');
const PROJECT_DIR = path.join(WORKSPACE_ROOT, 'auth-hardening');
const NOW = new Date('2026-09-24T10:00:00.000Z');
const THIS_PID = 4242;
const FORK_SESSION_ID = '55555555-5555-4555-8555-555555555555';
const ORIGINAL_SESSION_ID = '11111111-1111-4111-8111-111111111111';

function buildAdoptDeps(
  storage: InMemoryDeviceStorage,
  workspace: FakeWorkspaceRepository,
  overrides: Partial<AdoptSessionDeps> = {},
): AdoptSessionDeps {
  return {
    storage,
    workspace,
    projectLock: new FakeProjectLock(),
    processControl: new ControllableProcessControl(),
    clock: new FakeClock(NOW),
    forkRegistration: new FakeForkRegistration(),
    forkCleanup: new FakeForkCleanup(),
    adoptionLauncher: new FakeSessionAdoptionLauncher(),
    seeyaHome: SEEYA_HOME,
    idleMinutes: 45,
    sessionId: undefined,
    pid: THIS_PID,
    procStart: undefined,
    forkSessionId: FORK_SESSION_ID,
    nodePath: 'node',
    cliEntryPath: '/fake/cli-entry.js',
    ...overrides,
  };
}

/** Item 8's own gate defaults to `'proceed'` for every test that isn't specifically about that
 * gate — same idea `project-open.test.ts` uses passing `confirmReadOnlyOpen` explicitly whenever a
 * test needs to get past a `readOnly` lock. */
function buildCallbacks(overrides: Partial<AdoptSessionCallbacks> = {}): AdoptSessionCallbacks {
  return {
    confirmLaunch: () => Promise.resolve('proceed'),
    ...overrides,
  };
}

const ORIGINAL_ENDED = createSessionWithPid({
  sessionId: ORIGINAL_SESSION_ID,
  cwd: 'c:\\code\\projeto',
  name: 'projeto-01',
  processIsAlive: false,
});

describe('adoptSession', () => {
  it('refuses an invalid project id without touching any port', async () => {
    const storage = new InMemoryDeviceStorage(DEFAULT_TEST_CONFIG);
    const workspace = new FakeWorkspaceRepository();
    const adoptionLauncher = new FakeSessionAdoptionLauncher();

    const result = await adoptSession(
      buildAdoptDeps(storage, workspace, { adoptionLauncher }),
      ORIGINAL_ENDED,
      'Not Valid',
    );

    expect(result).toEqual({ kind: 'invalidId', projectId: 'Not Valid' });
    expect(adoptionLauncher.calls).toHaveLength(0);
  });

  it.each(['alive', 'idle'] as const)(
    'refuses a session that is running right now (%s) — resuming would open a second copy',
    async (state) => {
      const storage = new InMemoryDeviceStorage(DEFAULT_TEST_CONFIG);
      const workspace = new FakeWorkspaceRepository();
      const running = createSessionWithPid({
        sessionId: ORIGINAL_SESSION_ID,
        processIsAlive: true,
        lastTranscriptWrite: state === 'idle' ? new Date('2026-01-01T00:00:00.000Z') : NOW,
      });
      const adoptionLauncher = new FakeSessionAdoptionLauncher();

      const result = await adoptSession(
        buildAdoptDeps(storage, workspace, { adoptionLauncher }),
        running,
        'auth-hardening',
      );

      expect(result).toEqual({
        kind: 'sessionRunning',
        sessionId: ORIGINAL_SESSION_ID,
        name: running.name,
        state,
      });
      expect(adoptionLauncher.calls).toHaveLength(0);
    },
  );

  it('refuses an original session already adopted, naming the existing project and date', async () => {
    const storage = new InMemoryDeviceStorage(DEFAULT_TEST_CONFIG);
    const workspace = new FakeWorkspaceRepository();
    await storage.saveAdoptions([
      {
        originalSessionId: ORIGINAL_SESSION_ID,
        forkSessionId: '66666666-6666-4666-8666-666666666666',
        projectId: 'billing',
        adoptedAt: new Date('2026-09-01T00:00:00.000Z'),
      },
    ]);
    const adoptionLauncher = new FakeSessionAdoptionLauncher();

    const result = await adoptSession(
      buildAdoptDeps(storage, workspace, { adoptionLauncher }),
      ORIGINAL_ENDED,
      'auth-hardening',
    );

    expect(result).toEqual({
      kind: 'alreadyAdopted',
      sessionId: ORIGINAL_SESSION_ID,
      projectId: 'billing',
      adoptedAt: new Date('2026-09-01T00:00:00.000Z'),
    });
    expect(adoptionLauncher.calls).toHaveLength(0);
  });

  describe('item 8: confirmed BEFORE anything is created', () => {
    it('asks confirmLaunch with originalCwd/projectDir/projectId, before the project exists', async () => {
      const storage = new InMemoryDeviceStorage(DEFAULT_TEST_CONFIG);
      const workspace = new FakeWorkspaceRepository();
      let observed: { originalCwd: string; projectDir: string; projectId: string } | undefined;

      await adoptSession(
        buildAdoptDeps(storage, workspace),
        ORIGINAL_ENDED,
        'auth-hardening',
        buildCallbacks({
          confirmLaunch: (info) => {
            observed = { ...info };
            // Observed synchronously, from INSIDE the callback — proves the project did not exist
            // yet at the moment this question was asked.
            return Promise.resolve('proceed');
          },
        }),
      );

      expect(observed).toEqual({
        originalCwd: ORIGINAL_ENDED.cwd,
        projectDir: PROJECT_DIR,
        projectId: 'auth-hardening',
      });
    });

    it('declined: nothing created — no project, no lock, no fork registered', async () => {
      const storage = new InMemoryDeviceStorage(DEFAULT_TEST_CONFIG);
      const workspace = new FakeWorkspaceRepository();
      const forkRegistration = new FakeForkRegistration();
      const adoptionLauncher = new FakeSessionAdoptionLauncher();

      const result = await adoptSession(
        buildAdoptDeps(storage, workspace, { forkRegistration, adoptionLauncher }),
        ORIGINAL_ENDED,
        'auth-hardening',
        buildCallbacks({ confirmLaunch: () => Promise.resolve('decline') }),
      );

      expect(result).toEqual({ kind: 'launchConfirmationDeclined', projectId: 'auth-hardening' });
      expect(await workspace.projectExists(WORKSPACE_ROOT, 'auth-hardening')).toBe(false);
      expect(forkRegistration.registerCalls).toEqual([]);
      expect(adoptionLauncher.calls).toHaveLength(0);
    });

    it('no confirmLaunch callback at all: refuses unavailable, nothing created (D-025 — never a silent proceed)', async () => {
      const storage = new InMemoryDeviceStorage(DEFAULT_TEST_CONFIG);
      const workspace = new FakeWorkspaceRepository();
      const adoptionLauncher = new FakeSessionAdoptionLauncher();

      const result = await adoptSession(
        buildAdoptDeps(storage, workspace, { adoptionLauncher }),
        ORIGINAL_ENDED,
        'auth-hardening',
      );

      expect(result).toEqual({
        kind: 'launchConfirmationUnavailable',
        projectId: 'auth-hardening',
      });
      expect(await workspace.projectExists(WORKSPACE_ROOT, 'auth-hardening')).toBe(false);
      expect(adoptionLauncher.calls).toHaveLength(0);
    });
  });

  it('creates the project first when it does not exist yet (item 1)', async () => {
    const storage = new InMemoryDeviceStorage(DEFAULT_TEST_CONFIG);
    const workspace = new FakeWorkspaceRepository();

    await adoptSession(
      buildAdoptDeps(storage, workspace),
      ORIGINAL_ENDED,
      'auth-hardening',
      buildCallbacks(),
    );

    expect(await workspace.projectExists(WORKSPACE_ROOT, 'auth-hardening')).toBe(true);
  });

  it('writes into an existing project without recreating it — no second "Create project" commit', async () => {
    const storage = new InMemoryDeviceStorage(DEFAULT_TEST_CONFIG);
    const workspace = new FakeWorkspaceRepository();
    await adoptSession(
      buildAdoptDeps(storage, workspace),
      ORIGINAL_ENDED,
      'auth-hardening',
      buildCallbacks(),
    );
    const commitCountBefore = workspace.commitMessages.length;

    await adoptSession(
      buildAdoptDeps(storage, workspace),
      createSessionWithPid({
        sessionId: '77777777-7777-4777-8777-777777777777',
        processIsAlive: false,
      }),
      'auth-hardening',
      buildCallbacks(),
    );

    const createCommits = workspace.commitMessages.filter((message) =>
      message.startsWith('Create project'),
    );
    expect(createCommits).toHaveLength(1);
    // The second call also found nothing changed (no confirmation reached) — same commit count.
    expect(workspace.commitMessages.length).toBe(commitCountBefore);
  });

  it('refuses when the project is locked by another live session', async () => {
    const storage = new InMemoryDeviceStorage(DEFAULT_TEST_CONFIG);
    const workspace = new FakeWorkspaceRepository();
    const projectLock = new FakeProjectLock();
    await adoptSession(
      buildAdoptDeps(storage, workspace),
      ORIGINAL_ENDED,
      'auth-hardening',
      buildCallbacks(),
    );
    await projectLock.write(WORKSPACE_ROOT, 'auth-hardening', {
      sessionId: 'other-session',
      pid: 555,
      procStart: undefined,
      acquiredAt: new Date('2026-09-20T09:00:00.000Z'),
    });
    const processControl = new ControllableProcessControl(new Map([[555, true]]));
    const adoptionLauncher = new FakeSessionAdoptionLauncher();

    const result = await adoptSession(
      buildAdoptDeps(storage, workspace, { projectLock, processControl, adoptionLauncher }),
      ORIGINAL_ENDED,
      'auth-hardening',
      buildCallbacks(),
    );

    expect(result).toEqual({
      kind: 'projectLocked',
      projectId: 'auth-hardening',
      heldBy: {
        sessionId: 'other-session',
        pid: 555,
        procStart: undefined,
        acquiredAt: new Date('2026-09-20T09:00:00.000Z'),
      },
    });
    expect(adoptionLauncher.calls).toHaveLength(0);
  });

  it('takes the project lock under the FORK id, never the caller session id', async () => {
    const storage = new InMemoryDeviceStorage(DEFAULT_TEST_CONFIG);
    const workspace = new FakeWorkspaceRepository();
    const projectLock = new FakeProjectLock();
    let observedLockSessionId: string | undefined | null = null;
    const inspectingLauncher: FakeSessionAdoptionLauncher = new FakeSessionAdoptionLauncher();
    const originalAdopt = inspectingLauncher.adopt.bind(inspectingLauncher);
    inspectingLauncher.adopt = async (...args) => {
      const lock = await projectLock.read(WORKSPACE_ROOT, 'auth-hardening');
      observedLockSessionId = lock?.sessionId ?? undefined;
      return originalAdopt(...args);
    };

    await adoptSession(
      buildAdoptDeps(storage, workspace, {
        projectLock,
        sessionId: 'caller-session',
        adoptionLauncher: inspectingLauncher,
      }),
      ORIGINAL_ENDED,
      'auth-hardening',
      buildCallbacks(),
    );

    expect(observedLockSessionId).toBe(FORK_SESSION_ID);
  });

  it('registers the fork BEFORE launching it, and calls the launcher with the original cwd/id and the project dir', async () => {
    const storage = new InMemoryDeviceStorage(DEFAULT_TEST_CONFIG);
    const workspace = new FakeWorkspaceRepository();
    const forkRegistration = new FakeForkRegistration();
    const adoptionLauncher = new FakeSessionAdoptionLauncher();

    await adoptSession(
      buildAdoptDeps(storage, workspace, { forkRegistration, adoptionLauncher }),
      ORIGINAL_ENDED,
      'auth-hardening',
      buildCallbacks(),
    );

    expect(forkRegistration.registerCalls).toEqual([FORK_SESSION_ID]);
    expect(adoptionLauncher.calls).toEqual([
      {
        originalCwd: ORIGINAL_ENDED.cwd,
        projectDir: PROJECT_DIR,
        originalSessionId: ORIGINAL_SESSION_ID,
        forkSessionId: FORK_SESSION_ID,
      },
    ]);
  });

  it('failedToStart: unregisters the fork and releases the lock', async () => {
    const storage = new InMemoryDeviceStorage(DEFAULT_TEST_CONFIG);
    const workspace = new FakeWorkspaceRepository();
    const forkRegistration = new FakeForkRegistration();
    const projectLock = new FakeProjectLock();
    const adoptionLauncher = new FakeSessionAdoptionLauncher({ kind: 'failedToStart' });

    const result = await adoptSession(
      buildAdoptDeps(storage, workspace, { forkRegistration, projectLock, adoptionLauncher }),
      ORIGINAL_ENDED,
      'auth-hardening',
      buildCallbacks(),
    );

    expect(result).toEqual({ kind: 'failedToStart', projectId: 'auth-hardening' });
    expect(forkRegistration.isRegistered(FORK_SESSION_ID)).toBe(false);
    expect(await projectLock.read(WORKSPACE_ROOT, 'auth-hardening')).toBeNull();
  });

  it('noChanges: nothing written — discards the fork (deletes the transcript AND unregisters it), releases the lock', async () => {
    const storage = new InMemoryDeviceStorage(DEFAULT_TEST_CONFIG);
    const workspace = new FakeWorkspaceRepository();
    const forkRegistration = new FakeForkRegistration();
    const forkCleanup = new FakeForkCleanup();
    const projectLock = new FakeProjectLock();

    const result = await adoptSession(
      buildAdoptDeps(storage, workspace, { forkRegistration, forkCleanup, projectLock }),
      ORIGINAL_ENDED,
      'auth-hardening',
      buildCallbacks(),
    );

    expect(result).toEqual({
      kind: 'noChanges',
      projectId: 'auth-hardening',
      forkSessionId: FORK_SESSION_ID,
    });
    expect(forkCleanup.deletedSessionIds).toEqual([FORK_SESSION_ID]);
    expect(forkRegistration.isRegistered(FORK_SESSION_ID)).toBe(false);
    expect(await projectLock.read(WORKSPACE_ROOT, 'auth-hardening')).toBeNull();
  });

  it('declined: the person said no — discards the fork, nothing committed, reports the changed files', async () => {
    const storage = new InMemoryDeviceStorage(DEFAULT_TEST_CONFIG);
    const workspace = new FakeWorkspaceRepository();
    const forkRegistration = new FakeForkRegistration();
    const forkCleanup = new FakeForkCleanup();

    await adoptSession(
      buildAdoptDeps(storage, workspace),
      ORIGINAL_ENDED,
      'auth-hardening',
      buildCallbacks(),
    );
    workspace.setChangedFiles('auth-hardening', ['auth-hardening/context/know-how.md']);
    const commitsBefore = workspace.commitMessages.length;

    const result = await adoptSession(
      buildAdoptDeps(storage, workspace, { forkRegistration, forkCleanup }),
      createSessionWithPid({
        sessionId: '88888888-8888-4888-8888-888888888888',
        processIsAlive: false,
      }),
      'auth-hardening',
      buildCallbacks({ confirmCommit: () => Promise.resolve('decline') }),
    );

    expect(result).toEqual({
      kind: 'declined',
      projectId: 'auth-hardening',
      forkSessionId: FORK_SESSION_ID,
      changedFiles: ['auth-hardening/context/know-how.md'],
    });
    expect(forkCleanup.deletedSessionIds).toEqual([FORK_SESSION_ID]);
    expect(forkRegistration.isRegistered(FORK_SESSION_ID)).toBe(false);
    expect(workspace.commitMessages.length).toBe(commitsBefore);
    expect(await storage.readAdoptions()).toEqual([]);
  });

  it('confirmationUnavailable: no way to ask — nothing committed, nothing deleted, fork stays registered', async () => {
    const storage = new InMemoryDeviceStorage(DEFAULT_TEST_CONFIG);
    const workspace = new FakeWorkspaceRepository();
    await adoptSession(
      buildAdoptDeps(storage, workspace),
      ORIGINAL_ENDED,
      'auth-hardening',
      buildCallbacks(),
    );
    workspace.setChangedFiles('auth-hardening', ['auth-hardening/status/README.md']);
    const commitsBefore = workspace.commitMessages.length;
    const forkRegistration = new FakeForkRegistration();
    const forkCleanup = new FakeForkCleanup();

    // `confirmLaunch` still proceeds (item 8's own gate), but `confirmCommit` is never given —
    // same "never a silent default" D-025 rule `application/project-open.ts#confirmReadOnlyOpen`
    // already applies, now for the LATER commit confirmation.
    const result = await adoptSession(
      buildAdoptDeps(storage, workspace, { forkRegistration, forkCleanup }),
      createSessionWithPid({
        sessionId: '99999999-9999-4999-8999-999999999999',
        processIsAlive: false,
      }),
      'auth-hardening',
      buildCallbacks(),
    );

    expect(result).toEqual({
      kind: 'confirmationUnavailable',
      projectId: 'auth-hardening',
      forkSessionId: FORK_SESSION_ID,
      changedFiles: ['auth-hardening/status/README.md'],
    });
    expect(forkCleanup.deletedSessionIds).toEqual([]);
    expect(forkRegistration.isRegistered(FORK_SESSION_ID)).toBe(true);
    expect(workspace.commitMessages.length).toBe(commitsBefore);
  });

  it('adopted: commits with the FORK id as the Seeya-Session-Id trailer, promotes the fork, records the adoption', async () => {
    const storage = new InMemoryDeviceStorage(DEFAULT_TEST_CONFIG);
    const workspace = new FakeWorkspaceRepository();
    await adoptSession(
      buildAdoptDeps(storage, workspace, { sessionId: 'caller-session' }),
      ORIGINAL_ENDED,
      'auth-hardening',
      buildCallbacks(),
    );
    workspace.setChangedFiles('auth-hardening', [
      'auth-hardening/AGENTS.md',
      'auth-hardening/context/know-how.md',
    ]);
    const forkRegistration = new FakeForkRegistration();
    const forkCleanup = new FakeForkCleanup();

    const result = await adoptSession(
      buildAdoptDeps(storage, workspace, {
        forkRegistration,
        forkCleanup,
        sessionId: 'caller-session',
      }),
      createSessionWithPid({
        sessionId: '10101010-1010-4101-8101-101010101010',
        processIsAlive: false,
      }),
      'auth-hardening',
      buildCallbacks({ confirmCommit: () => Promise.resolve('commit') }),
    );

    expect(result).toEqual({
      kind: 'adopted',
      projectId: 'auth-hardening',
      forkSessionId: FORK_SESSION_ID,
      changedFiles: ['auth-hardening/AGENTS.md', 'auth-hardening/context/know-how.md'],
    });
    const lastCommit = workspace.commitMessages.at(-1);
    expect(lastCommit).toContain(`Seeya-Session-Id: ${FORK_SESSION_ID}`);
    expect(lastCommit).not.toContain('Seeya-Session-Id: caller-session');
    // V2-T34 hotfix (PO review, 2026-09-25): this commit is made while THIS adoption holds the
    // project's own lock under `FORK_SESSION_ID`, never `caller-session` — the workspace's own
    // commit-msg hook authorizes it via this process's own pid/procStart instead.
    expect(workspace.commitAllLockHolders.at(-1)).toEqual({ pid: THIS_PID, procStart: undefined });
    // Promoted: dropped from forks.json (never deleted — deleteFork is never called for accept).
    expect(forkRegistration.isRegistered(FORK_SESSION_ID)).toBe(false);
    expect(forkCleanup.deletedSessionIds).toEqual([]);
    expect(await storage.readAdoptions()).toEqual([
      {
        originalSessionId: '10101010-1010-4101-8101-101010101010',
        forkSessionId: FORK_SESSION_ID,
        projectId: 'auth-hardening',
        adoptedAt: NOW,
      },
    ]);
  });

  describe('commitFailed (V2-T34 production defect, PO review 2026-09-25)', () => {
    it('reports commitFailed with the reason, releases the lock, keeps the fork pending, never records the adoption', async () => {
      const storage = new InMemoryDeviceStorage(DEFAULT_TEST_CONFIG);
      const workspace = new FakeWorkspaceRepository();
      // A first, ordinary adoption creates the project (same "two calls, first just to create the
      // project" idiom this file's own "writes into an existing project" test already uses).
      await adoptSession(
        buildAdoptDeps(storage, workspace),
        ORIGINAL_ENDED,
        'auth-hardening',
        buildCallbacks(),
      );

      workspace.setChangedFiles('auth-hardening', ['auth-hardening/AGENTS.md']);
      workspace.failNextCommitWith(
        'git commit failed in workspace at "/x": exit 1: seeya: the workspace\'s own git hooks ' +
          '(D-047) refused this commit — Seeya-Project-Id conflicts with a project already ' +
          'touched by this commit.',
      );
      const forkRegistration = new FakeForkRegistration();
      const forkCleanup = new FakeForkCleanup();
      const projectLock = new FakeProjectLock();

      const result = await adoptSession(
        buildAdoptDeps(storage, workspace, { forkRegistration, forkCleanup, projectLock }),
        createSessionWithPid({
          sessionId: '20202020-2020-4202-8202-202020202020',
          processIsAlive: false,
        }),
        'auth-hardening',
        buildCallbacks({ confirmCommit: () => Promise.resolve('commit') }),
      );

      expect(result.kind).toBe('commitFailed');
      expect(result).toMatchObject({
        kind: 'commitFailed',
        projectId: 'auth-hardening',
        forkSessionId: FORK_SESSION_ID,
        changedFiles: ['auth-hardening/AGENTS.md'],
      });
      expect(result.kind === 'commitFailed' && result.reason).toContain('refused this commit');
      // Fork stays registered as pending — never unregistered, never deleted, never adopted.
      expect(forkRegistration.isRegistered(FORK_SESSION_ID)).toBe(true);
      expect(forkCleanup.deletedSessionIds).toEqual([]);
      expect(await storage.readAdoptions()).toEqual([]);
      // The lock this attempt took is released even though commitAll threw.
      expect(await projectLock.read(WORKSPACE_ROOT, 'auth-hardening')).toBeNull();
    });
  });
});
