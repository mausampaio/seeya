/**
 * `openProject` with `{ kind: 'resume', session }` (V2-T77, `docs/INTERFACE.md` § 5a) — the same
 * pipeline as `open` (`project-open.test.ts`), launching `claude --resume <id>` instead of a new
 * session, plus the two refusals that must happen before anything is touched.
 */
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { openProject } from '@seeya-ai/engine/application/project-open.js';
import type { ProjectOpenDeps } from '@seeya-ai/engine/application/project-open.js';
import { createProject } from '@seeya-ai/engine/application/workspace.js';
import type { ProjectLockInfo } from '@seeya-ai/engine/core/project-lock.js';
import { createSessionWithPid, createSessionWithoutPid } from '../core/_fixtures.js';
import {
  ControllableProcessControl,
  DEFAULT_TEST_CONFIG,
  FakeClock,
  FakeDirectoryExistence,
  FakeHarnessLauncher,
  FakeProjectAuditMarker,
  FakeProjectLock,
  FakeWorkspaceRepository,
  InMemoryDeviceStorage,
} from './_fakes.js';

const SEEYA_HOME = path.resolve(path.sep, 'seeya-home-fixture');
const WORKSPACE_ROOT = path.join(SEEYA_HOME, 'workspace');
const PROJECT_DIR = path.join(WORKSPACE_ROOT, 'auth-hardening');
const NOW = new Date('2026-09-22T10:00:00.000Z');
const THIS_PID = 4242;
const LAUNCHED_SESSION_ID = '55555555-5555-4555-8555-555555555555';
const RESUMED_ID = '66666666-6666-4666-8666-666666666666';

function buildDeps(
  storage: InMemoryDeviceStorage,
  workspace: FakeWorkspaceRepository,
  overrides: Partial<ProjectOpenDeps> = {},
): ProjectOpenDeps {
  return {
    storage,
    workspace,
    directoryExistence: new FakeDirectoryExistence(),
    harnessLauncher: new FakeHarnessLauncher(),
    projectLock: new FakeProjectLock(),
    processControl: new ControllableProcessControl(),
    clock: new FakeClock(NOW),
    seeyaHome: SEEYA_HOME,
    sessionId: undefined,
    pid: THIS_PID,
    procStart: undefined,
    launchedSessionId: LAUNCHED_SESSION_ID,
    nodePath: 'node',
    cliEntryPath: '/fake/cli-entry.js',
    auditMarker: new FakeProjectAuditMarker(),
    lockFileName: '.seeya-lock',
    platformHint: 'posix',
    ...overrides,
  };
}

/** Ended (dead pid), ran in the project's own directory — the evidence the sidebar grouping accepts. */
const endedInProject = createSessionWithPid({
  sessionId: RESUMED_ID,
  cwd: PROJECT_DIR,
  name: 'auth-hardening',
  processIsAlive: false,
});

describe('openProject resuming a project session', () => {
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

  it('launches --resume of that session, with no system prompt (Q-069)', async () => {
    const harnessLauncher = new FakeHarnessLauncher();
    const result = await openProject(
      buildDeps(storage, workspace, { harnessLauncher }),
      'auth-hardening',
      'claude',
      undefined,
      { kind: 'resume', session: endedInProject },
    );
    expect(result).toMatchObject({ kind: 'opened', sessionLaunch: 'resume' });
    expect(harnessLauncher.calls).toEqual([
      {
        cwd: PROJECT_DIR,
        addDirs: [],
        launch: { kind: 'resume', sessionId: RESUMED_ID },
        // Q-069: nothing in `--append-system-prompt` reaches a resumed session — never sent.
        systemPromptAppend: null,
      },
    ]);
  });

  it('a plain open stays a fresh session with the working rules (regression)', async () => {
    const harnessLauncher = new FakeHarnessLauncher();
    await openProject(
      buildDeps(storage, workspace, { harnessLauncher }),
      'auth-hardening',
      'claude',
    );
    expect(harnessLauncher.calls[0]?.launch).toEqual({
      kind: 'fresh',
      sessionId: LAUNCHED_SESSION_ID,
    });
    expect(harnessLauncher.calls[0]?.systemPromptAppend).not.toBeNull();
  });

  it('registers the RESUMED session as the lock holder, then releases it', async () => {
    const projectLock = new FakeProjectLock();
    let heldDuringLaunch: ProjectLockInfo | null = null;
    class LockSnoopingLauncher extends FakeHarnessLauncher {
      override async open(...args: Parameters<FakeHarnessLauncher['open']>) {
        heldDuringLaunch = await projectLock.read(WORKSPACE_ROOT, 'auth-hardening');
        return super.open(...args);
      }
    }
    await openProject(
      buildDeps(storage, workspace, { harnessLauncher: new LockSnoopingLauncher(), projectLock }),
      'auth-hardening',
      'claude',
      undefined,
      { kind: 'resume', session: endedInProject },
    );
    expect(heldDuringLaunch).toMatchObject({ sessionId: RESUMED_ID, pid: THIS_PID });
    expect(await projectLock.read(WORKSPACE_ROOT, 'auth-hardening')).toBeNull();
  });

  it('still asks about leftover changes, exactly like open', async () => {
    workspace.setChangedFiles('auth-hardening', ['auth-hardening/status/current.md']);
    let leftoverAsked = false;
    const result = await openProject(
      buildDeps(storage, workspace),
      'auth-hardening',
      'claude',
      {
        confirmLeftoverChanges: () => {
          leftoverAsked = true;
          return Promise.resolve('proceedWithoutCommitting');
        },
      },
      { kind: 'resume', session: endedInProject },
    );
    expect(leftoverAsked).toBe(true);
    expect(result.kind).toBe('opened');
  });

  it('refuses a session running right now, before launching or taking the lock', async () => {
    const harnessLauncher = new FakeHarnessLauncher();
    const projectLock = new FakeProjectLock();
    const running = createSessionWithPid({
      sessionId: RESUMED_ID,
      cwd: PROJECT_DIR,
      name: 'auth-hardening',
      processIsAlive: true,
      lastTranscriptWrite: NOW,
    });
    const result = await openProject(
      buildDeps(storage, workspace, { harnessLauncher, projectLock }),
      'auth-hardening',
      'claude',
      undefined,
      { kind: 'resume', session: running },
    );
    expect(result).toEqual({
      kind: 'sessionRunning',
      projectId: 'auth-hardening',
      sessionId: RESUMED_ID,
      name: 'auth-hardening',
      state: 'alive',
    });
    expect(harnessLauncher.calls).toHaveLength(0);
    expect(await projectLock.read(WORKSPACE_ROOT, 'auth-hardening')).toBeNull();
  });

  it('refuses a session with no evidence of belonging to the project (D-025, never guessed)', async () => {
    const harnessLauncher = new FakeHarnessLauncher();
    const stranger = createSessionWithoutPid({
      sessionId: RESUMED_ID,
      cwd: path.resolve(path.sep, 'code', 'elsewhere'),
      name: 'elsewhere',
    });
    const result = await openProject(
      buildDeps(storage, workspace, { harnessLauncher }),
      'auth-hardening',
      'claude',
      undefined,
      { kind: 'resume', session: stranger },
    );
    expect(result).toEqual({
      kind: 'sessionNotInProject',
      projectId: 'auth-hardening',
      sessionId: RESUMED_ID,
      name: 'elsewhere',
      cwd: stranger.cwd,
    });
    expect(harnessLauncher.calls).toHaveLength(0);
  });

  it('accepts the registered adoption fork of the project, wherever it ran', async () => {
    await storage.saveAdoptions([
      {
        originalSessionId: '77777777-7777-4777-8777-777777777777',
        forkSessionId: RESUMED_ID,
        projectId: 'auth-hardening',
        adoptedAt: NOW,
      },
    ]);
    const fork = createSessionWithoutPid({
      sessionId: RESUMED_ID,
      cwd: path.resolve(path.sep, 'code', 'original-dir'),
    });
    const result = await openProject(
      buildDeps(storage, workspace),
      'auth-hardening',
      'claude',
      undefined,
      { kind: 'resume', session: fork },
    );
    expect(result.kind).toBe('opened');
  });

  it('accepts the session the project lock currently names (when it is not running)', async () => {
    const projectLock = new FakeProjectLock();
    await projectLock.write(WORKSPACE_ROOT, 'auth-hardening', {
      sessionId: RESUMED_ID,
      pid: 999,
      procStart: undefined,
      acquiredAt: new Date('2026-09-20T09:00:00.000Z'),
    });
    const holder = createSessionWithoutPid({
      sessionId: RESUMED_ID,
      cwd: path.resolve(path.sep, 'code', 'somewhere'),
    });
    const result = await openProject(
      buildDeps(storage, workspace, { projectLock }),
      'auth-hardening',
      'claude',
      undefined,
      { kind: 'resume', session: holder },
    );
    expect(result.kind).toBe('opened');
  });
});
