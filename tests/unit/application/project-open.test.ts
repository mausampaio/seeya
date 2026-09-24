/**
 * `openProject` (V2-T28, `application/project-open.ts`; lock take/release V2-T33, D-047 items
 * 1/4) — against the same named doubles `repository-association.test.ts` uses, plus
 * `FakeHarnessLauncher`, `FakeProjectLock` and `ControllableProcessControl`.
 */
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { openProject } from '@seeya-ai/engine/application/project-open.js';
import type { ProjectOpenDeps } from '@seeya-ai/engine/application/project-open.js';
import { addRepository } from '@seeya-ai/engine/application/repository-association.js';
import { createProject } from '@seeya-ai/engine/application/workspace.js';
import type {
  MissingRepositoryRecord,
  ProjectOpenLockOutcome,
} from '@seeya-ai/engine/application/project-open.js';
import type { ProjectLockInfo } from '@seeya-ai/engine/core/project-lock.js';
import {
  ControllableProcessControl,
  DEFAULT_TEST_CONFIG,
  FakeClock,
  FakeDirectoryExistence,
  FakeGitReaderWithRemote,
  FakeHarnessLauncher,
  FakeProjectLock,
  FakeWorkspaceRepository,
  InMemoryDeviceStorage,
} from './_fakes.js';

// Absolute on every OS on purpose: `path.join('C:', ...)` was absolute only on Windows, so on
// Linux/macOS the code under test (which `path.resolve`s the local path it is given) turned it
// into `<cwd>/C:/...` and every lookup missed -- green locally on Windows, red on CI (V2-T28).
const SEEYA_HOME = path.resolve(path.sep, 'seeya-home-fixture');
const WORKSPACE_ROOT = path.join(SEEYA_HOME, 'workspace');
const PROJECT_DIR = path.join(WORKSPACE_ROOT, 'auth-hardening');
const REPO_PATH = path.resolve(path.sep, 'code', 'app-api');
const NOW = new Date('2026-09-22T10:00:00.000Z');
const THIS_PID = 4242;

/** Every `openProject` call in this file takes the SAME shape — one place threading V2-T33's own
 * `projectLock`/`processControl`/`clock`/`sessionId`/`pid`/`procStart` through, same idea
 * `application/workspace.test.ts#buildDeps` already established. `processLiveness` defaults to
 * "nothing is alive" (no prior lock holder to collide with); a test proving the `readOnly`/stale
 * paths passes its own. */
const LAUNCHED_SESSION_ID = '55555555-5555-4555-8555-555555555555';

function buildOpenDeps(
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
    ...overrides,
  };
}

const ACQUIRED_FREE: ProjectOpenLockOutcome = { kind: 'acquired', reclaimedStale: null };

describe('openProject', () => {
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
      },
      'auth-hardening',
    );
  });

  it('refuses an invalid project id without touching any port', async () => {
    const harnessLauncher = new FakeHarnessLauncher();
    const result = await openProject(
      buildOpenDeps(storage, workspace, { harnessLauncher }),
      'Not Valid',
    );
    expect(result).toEqual({ kind: 'invalidId', projectId: 'Not Valid' });
    expect(harnessLauncher.calls).toHaveLength(0);
  });

  it('reports notFound for an id never created', async () => {
    const result = await openProject(buildOpenDeps(storage, workspace), 'ghost');
    expect(result).toEqual({ kind: 'notFound', projectId: 'ghost' });
  });

  it('reports noHarnessChosen when the project has no defaultHarness and none is given', async () => {
    const result = await openProject(buildOpenDeps(storage, workspace), 'auth-hardening');
    expect(result).toEqual({ kind: 'noHarnessChosen', projectId: 'auth-hardening' });
  });

  it('reports unsupportedHarness for anything other than claude (item 5)', async () => {
    const result = await openProject(buildOpenDeps(storage, workspace), 'auth-hardening', 'codex');
    expect(result).toEqual({ kind: 'unsupportedHarness', harness: 'codex' });
  });

  it('opens claude with the project directory as cwd and no --add-dir when there are no repositories', async () => {
    const harnessLauncher = new FakeHarnessLauncher();
    const result = await openProject(
      buildOpenDeps(storage, workspace, { harnessLauncher }),
      'auth-hardening',
      'claude',
    );
    expect(result).toEqual({
      kind: 'opened',
      projectId: 'auth-hardening',
      harness: 'claude',
      exitCode: 0,
      addedDirs: [],
      missing: [],
      lock: ACQUIRED_FREE,
      finalLockStatus: { kind: 'unlocked' },
    });
    // item 4: `open`'s own generated id, never the caller's `deps.sessionId` (`undefined` here) —
    // and item 2: no system prompt append for a genuinely free lock (nothing to warn about).
    expect(harnessLauncher.calls).toEqual([
      {
        cwd: PROJECT_DIR,
        addDirs: [],
        sessionId: LAUNCHED_SESSION_ID,
        systemPromptAppend: null,
      },
    ]);
  });

  it('adds --add-dir for a repository whose local path is registered and still exists', async () => {
    const gitReader = new FakeGitReaderWithRemote(
      new Map([[REPO_PATH, 'git@host:acme-widgets/app-api.git']]),
    );
    const directoryExistence = new FakeDirectoryExistence(new Set([REPO_PATH]));
    await addRepository(
      {
        storage,
        workspace,
        gitReader,
        directoryExistence,
        seeyaHome: SEEYA_HOME,
        sessionId: undefined,
      },
      'auth-hardening',
      REPO_PATH,
    );

    const harnessLauncher = new FakeHarnessLauncher();
    const result = await openProject(
      buildOpenDeps(storage, workspace, { directoryExistence, harnessLauncher }),
      'auth-hardening',
      'claude',
    );
    expect(result.kind).toBe('opened');
    if (result.kind === 'opened') {
      expect(result.addedDirs).toEqual([REPO_PATH]);
      expect(result.missing).toEqual([]);
    }
    expect(harnessLauncher.calls).toEqual([
      {
        cwd: PROJECT_DIR,
        addDirs: [REPO_PATH],
        sessionId: LAUNCHED_SESSION_ID,
        systemPromptAppend: null,
      },
    ]);
  });

  it('item 4: a repository never registered on this device is reported missing, notInDeviceMap — open continues anyway', async () => {
    const manifest = await workspace.readProjectManifest(WORKSPACE_ROOT, 'auth-hardening');
    await workspace.writeProjectManifest(WORKSPACE_ROOT, 'auth-hardening', {
      ...manifest!,
      repositories: [{ hasRemote: false, name: 'frontend' }],
    });

    const harnessLauncher = new FakeHarnessLauncher();
    let observedBeforeLaunch: readonly MissingRepositoryRecord[] | undefined;
    const result = await openProject(
      buildOpenDeps(storage, workspace, { harnessLauncher }),
      'auth-hardening',
      'claude',
      {
        onBeforeLaunch: ({ missing }) => {
          observedBeforeLaunch = missing;
        },
      },
    );
    expect(result.kind).toBe('opened');
    if (result.kind === 'opened') {
      expect(result.addedDirs).toEqual([]);
      expect(result.missing).toEqual([{ name: 'frontend', reason: 'notInDeviceMap' }]);
    }
    // The callback fires with the SAME list, BEFORE the launcher is called (its own docstring's
    // promise) — proven here by asserting it happened at all, not just that the final result
    // carries it too.
    expect(observedBeforeLaunch).toEqual([{ name: 'frontend', reason: 'notInDeviceMap' }]);
    expect(harnessLauncher.calls).toEqual([
      {
        cwd: PROJECT_DIR,
        addDirs: [],
        sessionId: LAUNCHED_SESSION_ID,
        systemPromptAppend: null,
      },
    ]);
  });

  it('item 4: a registered repository whose local path no longer exists is reported missing, pathMissing', async () => {
    const gitReader = new FakeGitReaderWithRemote(
      new Map([[REPO_PATH, 'git@host:acme-widgets/app-api.git']]),
    );
    await addRepository(
      {
        storage,
        workspace,
        gitReader,
        directoryExistence: new FakeDirectoryExistence(new Set([REPO_PATH])),
        seeyaHome: SEEYA_HOME,
        sessionId: undefined,
      },
      'auth-hardening',
      REPO_PATH,
    );

    // The directory existed at add-repo time but has since vanished — a fresh, empty
    // `FakeDirectoryExistence` for `open` reproduces exactly that.
    const harnessLauncher = new FakeHarnessLauncher();
    const result = await openProject(
      buildOpenDeps(storage, workspace, { harnessLauncher }),
      'auth-hardening',
      'claude',
    );
    expect(result.kind).toBe('opened');
    if (result.kind === 'opened') {
      expect(result.missing).toEqual([{ name: 'app-api', reason: 'pathMissing', path: REPO_PATH }]);
    }
  });

  it('reports failedToStart when the harness never actually spawned', async () => {
    const harnessLauncher = new FakeHarnessLauncher({ kind: 'failedToStart' });
    const result = await openProject(
      buildOpenDeps(storage, workspace, { harnessLauncher }),
      'auth-hardening',
      'claude',
    );
    expect(result).toEqual({
      kind: 'failedToStart',
      projectId: 'auth-hardening',
      harness: 'claude',
    });
  });

  it('--with overrides defaultHarness for this call only — never persisted', async () => {
    const harnessLauncher = new FakeHarnessLauncher();
    await openProject(
      buildOpenDeps(storage, workspace, { harnessLauncher }),
      'auth-hardening',
      'claude',
    );
    const manifest = await workspace.readProjectManifest(WORKSPACE_ROOT, 'auth-hardening');
    expect(manifest?.defaultHarness).toBeNull();
  });

  describe('the project lock (V2-T33, D-047 items 1/4)', () => {
    it('acquires a genuinely free lock, and releases it once the harness closes', async () => {
      const projectLock = new FakeProjectLock();
      const result = await openProject(
        buildOpenDeps(storage, workspace, { projectLock }),
        'auth-hardening',
        'claude',
      );
      expect(result.kind).toBe('opened');
      if (result.kind === 'opened') {
        expect(result.lock).toEqual(ACQUIRED_FREE);
        // V2-T35 item 3: read fresh, after the release just below — "how it ended up," never the
        // pre-launch snapshot.
        expect(result.finalLockStatus).toEqual({ kind: 'unlocked' });
      }
      // Released by the time `open` returns — nothing left over for the next `show`/`open` to
      // trip on (D-047 item 4: "libera... ao sair").
      expect(await projectLock.read(WORKSPACE_ROOT, 'auth-hardening')).toBeNull();
    });

    it('reclaims a stale (dead-process) lock, with a warning naming who held it', async () => {
      const projectLock = new FakeProjectLock();
      await projectLock.write(WORKSPACE_ROOT, 'auth-hardening', {
        sessionId: 'stale-session',
        pid: 9999,
        procStart: undefined,
        acquiredAt: new Date('2026-09-01T00:00:00.000Z'),
      });
      // 9999 is absent from `aliveByPid` — `ControllableProcessControl` answers `false` (dead).
      const processControl = new ControllableProcessControl();
      let observedLock: ProjectOpenLockOutcome | undefined;
      const result = await openProject(
        buildOpenDeps(storage, workspace, { projectLock, processControl }),
        'auth-hardening',
        'claude',
        {
          onBeforeLaunch: ({ lock }) => {
            observedLock = lock;
          },
        },
      );
      const expectedLock: ProjectOpenLockOutcome = {
        kind: 'acquired',
        reclaimedStale: {
          sessionId: 'stale-session',
          pid: 9999,
          procStart: undefined,
          acquiredAt: new Date('2026-09-01T00:00:00.000Z'),
        },
      };
      expect(observedLock).toEqual(expectedLock);
      if (result.kind === 'opened') {
        expect(result.lock).toEqual(expectedLock);
      }
      // Reclaimed AND released — this session's own acquisition still gets cleared on exit.
      expect(await projectLock.read(WORKSPACE_ROOT, 'auth-hardening')).toBeNull();
    });

    it('a lock held by a LIVE session opens read-only: the harness still runs, the lock file is untouched', async () => {
      const projectLock = new FakeProjectLock();
      await projectLock.write(WORKSPACE_ROOT, 'auth-hardening', {
        sessionId: 'other-session',
        pid: 555,
        procStart: undefined,
        acquiredAt: new Date('2026-09-20T09:00:00.000Z'),
      });
      const processControl = new ControllableProcessControl(new Map([[555, true]]));
      const harnessLauncher = new FakeHarnessLauncher();
      let observedLock: ProjectOpenLockOutcome | undefined;
      let confirmedHeldBy: ProjectLockInfo | undefined;
      const result = await openProject(
        buildOpenDeps(storage, workspace, { projectLock, processControl, harnessLauncher }),
        'auth-hardening',
        'claude',
        {
          onBeforeLaunch: ({ lock }) => {
            observedLock = lock;
          },
          // V2-T35 item 1: a live lock now PAUSES for this confirmation — without one, `open`
          // would refuse (`'unavailable'`, the next test proves that path). Answering `'proceed'`
          // here is what still lets this test observe the pre-V2-T35 "opens read-only anyway"
          // behavior.
          confirmReadOnlyOpen: (heldBy) => {
            confirmedHeldBy = heldBy;
            return Promise.resolve('proceed');
          },
        },
      );
      const expectedLock: ProjectOpenLockOutcome = {
        kind: 'readOnly',
        heldBy: {
          sessionId: 'other-session',
          pid: 555,
          procStart: undefined,
          acquiredAt: new Date('2026-09-20T09:00:00.000Z'),
        },
      };
      expect(observedLock).toEqual(expectedLock);
      expect(confirmedHeldBy).toEqual(expectedLock.heldBy);
      expect(result.kind).toBe('opened');
      if (result.kind === 'opened') {
        expect(result.lock).toEqual(expectedLock);
      }
      // `open` still ran the harness — item 4: "abre para leitura", never refuses to open at all.
      // item 2: the lock's own warning text travels to the launched session too, as
      // `--append-system-prompt` (`systemPromptAppend`), never `null` for a `readOnly` lock.
      expect(harnessLauncher.calls).toHaveLength(1);
      expect(harnessLauncher.calls[0]).toMatchObject({
        cwd: PROJECT_DIR,
        addDirs: [],
        sessionId: LAUNCHED_SESSION_ID,
      });
      expect(harnessLauncher.calls[0]?.systemPromptAppend).toContain(
        'locked by session other-session',
      );
      // The OTHER session's lock is exactly as this process found it — never touched, never
      // released by a session that never held it.
      expect(await projectLock.read(WORKSPACE_ROOT, 'auth-hardening')).toEqual({
        sessionId: 'other-session',
        pid: 555,
        procStart: undefined,
        acquiredAt: new Date('2026-09-20T09:00:00.000Z'),
      });
    });

    it('item 1: a live lock with an explicit decline never launches the harness at all', async () => {
      const projectLock = new FakeProjectLock();
      await projectLock.write(WORKSPACE_ROOT, 'auth-hardening', {
        sessionId: 'other-session',
        pid: 555,
        procStart: undefined,
        acquiredAt: new Date('2026-09-20T09:00:00.000Z'),
      });
      const processControl = new ControllableProcessControl(new Map([[555, true]]));
      const harnessLauncher = new FakeHarnessLauncher();
      const result = await openProject(
        buildOpenDeps(storage, workspace, { projectLock, processControl, harnessLauncher }),
        'auth-hardening',
        'claude',
        { confirmReadOnlyOpen: () => Promise.resolve('decline') },
      );
      expect(result).toEqual({
        kind: 'lockConfirmationDeclined',
        projectId: 'auth-hardening',
        heldBy: {
          sessionId: 'other-session',
          pid: 555,
          procStart: undefined,
          acquiredAt: new Date('2026-09-20T09:00:00.000Z'),
        },
      });
      expect(harnessLauncher.calls).toHaveLength(0);
      // Never held anything to release — the other session's lock is still exactly as it was.
      expect(await projectLock.read(WORKSPACE_ROOT, 'auth-hardening')).toEqual({
        sessionId: 'other-session',
        pid: 555,
        procStart: undefined,
        acquiredAt: new Date('2026-09-20T09:00:00.000Z'),
      });
    });

    it('item 1: a live lock with no confirmer at all refuses, unavailable — never a silent default', async () => {
      const projectLock = new FakeProjectLock();
      await projectLock.write(WORKSPACE_ROOT, 'auth-hardening', {
        sessionId: 'other-session',
        pid: 555,
        procStart: undefined,
        acquiredAt: new Date('2026-09-20T09:00:00.000Z'),
      });
      const processControl = new ControllableProcessControl(new Map([[555, true]]));
      const harnessLauncher = new FakeHarnessLauncher();
      const result = await openProject(
        buildOpenDeps(storage, workspace, { projectLock, processControl, harnessLauncher }),
        'auth-hardening',
        'claude',
      );
      expect(result.kind).toBe('lockConfirmationUnavailable');
      expect(harnessLauncher.calls).toHaveLength(0);
    });

    it('a failed-to-start harness still releases the lock this session acquired', async () => {
      const projectLock = new FakeProjectLock();
      const harnessLauncher = new FakeHarnessLauncher({ kind: 'failedToStart' });
      await openProject(
        buildOpenDeps(storage, workspace, { projectLock, harnessLauncher }),
        'auth-hardening',
        'claude',
      );
      expect(await projectLock.read(WORKSPACE_ROOT, 'auth-hardening')).toBeNull();
    });
  });
});
