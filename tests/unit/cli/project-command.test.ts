/**
 * `runProjectCreateCommand`/`runProjectListCommand`/`runProjectShowCommand`/
 * `runProjectAddRepoCommand`/`runProjectOpenCommand` (V2-T27/V2-T28) — the thin CLI layer over
 * `application/workspace.ts`/`repository-association.ts`/`project-open.ts`, against the same
 * named doubles those modules' own tests use (`tests/unit/application/_fakes.ts`). The point here
 * is only that this layer calls through and formats correctly — the application-layer test files
 * already cover the orchestration itself, and `format-project.test.ts` already covers every
 * rendering branch.
 */
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import {
  runProjectAddRepoCommand,
  runProjectAdoptCommand,
  runProjectCreateCommand,
  runProjectListCommand,
  runProjectOpenCommand,
  runProjectShowCommand,
} from '../../../packages/cli/src/project-command.js';
import type { ProjectContext } from '../../../packages/cli/src/composition.js';
import type { ProjectOpenDeps } from '@seeya-ai/engine/application/project-open.js';
import type { AdoptSessionDeps } from '@seeya-ai/engine/application/project-adopt.js';
import type { DiscoveredSession } from '@seeya-ai/engine/core/types.js';
import {
  ControllableProcessControl,
  DEFAULT_TEST_CONFIG,
  FakeClock,
  FakeDirectoryExistence,
  FakeForkCleanup,
  FakeGitReaderWithRemote,
  FakeHarnessLauncher,
  FakeProjectLock,
  FakeSessionProvider,
  FakeWorkspaceRepository,
  InMemoryDeviceStorage,
} from '../application/_fakes.js';
import { FakeForkRegistration, FakeSessionAdoptionLauncher } from '../application/_adopt-fakes.js';

// Absolute on every OS on purpose: `path.join('C:', ...)` was absolute only on Windows, so on
// Linux/macOS the code under test (which `path.resolve`s the local path it is given) turned it
// into `<cwd>/C:/...` and every lookup missed -- green locally on Windows, red on CI (V2-T28).
const SEEYA_HOME = path.resolve(path.sep, 'seeya-home-fixture');
const REPO_PATH = path.resolve(path.sep, 'code', 'app-api');

function buildContext(overrides: Partial<ProjectContext> = {}): ProjectContext {
  return {
    storage: new InMemoryDeviceStorage(DEFAULT_TEST_CONFIG),
    workspace: new FakeWorkspaceRepository(),
    gitReader: new FakeGitReaderWithRemote(),
    directoryExistence: new FakeDirectoryExistence(),
    harnessLauncher: new FakeHarnessLauncher(),
    projectLock: new FakeProjectLock(),
    processControl: new ControllableProcessControl(),
    clock: new FakeClock(new Date('2026-09-22T10:00:00.000Z')),
    seeyaHome: SEEYA_HOME,
    sessionId: undefined,
    ...overrides,
  };
}

const LAUNCHED_SESSION_ID = '55555555-5555-4555-8555-555555555555';

/** `runProjectOpenCommand` takes `ProjectOpenDeps`, not `ProjectContext` (its own docstring: the
 * real `pid`/`procStart` capture belongs to `index.ts`'s `.action()` alone, never this test) —
 * adds a fixed, fake pid onto an EXISTING context (same port instances, so whatever `create`/
 * `add-repo` already wrote through it is still visible) rather than building a fresh one. */
function buildOpenDeps(context: ProjectContext): ProjectOpenDeps {
  return { ...context, pid: 4242, procStart: undefined, launchedSessionId: LAUNCHED_SESSION_ID };
}

/** Same `PassThrough` + `'data'` accumulation `start-day-command.test.ts#makeIo` already uses —
 * `runProjectOpenCommand` writes several lines across several `io.stdout.write` calls. */
function collectStdout(): { readonly stdout: PassThrough; readonly output: () => string } {
  const stdout = new PassThrough();
  let collected = '';
  stdout.on('data', (chunk: Buffer) => {
    collected += chunk.toString('utf8');
  });
  return { stdout, output: () => collected };
}

/** Every `runProjectOpenCommand` test in this file uses a non-interactive `io` by default (the
 * simplest possible double) — `stdin` is never actually read unless a test's own project ends up
 * `readOnly`, which none of these do (a fresh `FakeProjectLock` is always free). */
function buildOpenIo(stdout: PassThrough): {
  readonly stdin: PassThrough;
  readonly stdout: PassThrough;
  readonly isTTY: boolean;
} {
  return { stdin: new PassThrough(), stdout, isTTY: false };
}

describe('runProjectCreateCommand', () => {
  it('creates a project and reports its path', async () => {
    const context = buildContext();
    const text = await runProjectCreateCommand(context, 'auth-hardening');
    expect(text).toContain('Created project "auth-hardening"');
  });

  it('refuses an invalid id', async () => {
    const context = buildContext();
    const text = await runProjectCreateCommand(context, 'Not Valid');
    expect(text).toContain('is not a valid project id');
  });
});

describe('runProjectListCommand', () => {
  it('reports zero projects on a fresh workspace', async () => {
    const context = buildContext();
    const text = await runProjectListCommand(context);
    expect(text).toContain('0 projects found');
  });

  it('lists a project created moments before', async () => {
    const context = buildContext();
    await runProjectCreateCommand(context, 'auth-hardening');
    const text = await runProjectListCommand(context);
    expect(text).toContain('1 project found');
    expect(text).toContain('auth-hardening');
  });
});

describe('runProjectShowCommand', () => {
  it('reports notFound for an id never created', async () => {
    const context = buildContext();
    const text = await runProjectShowCommand(context, 'ghost');
    expect(text).toContain('"ghost" not found');
  });

  it('shows a project created moments before', async () => {
    const context = buildContext();
    await runProjectCreateCommand(context, 'auth-hardening');
    const text = await runProjectShowCommand(context, 'auth-hardening');
    expect(text).toContain('Project "auth-hardening"');
    expect(text).toContain('default harness: not set');
  });
});

describe('runProjectAddRepoCommand', () => {
  it('links a repository with a remote and reports it', async () => {
    const context = buildContext({
      gitReader: new FakeGitReaderWithRemote(
        new Map([[REPO_PATH, 'git@host:acme-widgets/app-api.git']]),
      ),
      directoryExistence: new FakeDirectoryExistence(new Set([REPO_PATH])),
    });
    await runProjectCreateCommand(context, 'auth-hardening');
    const text = await runProjectAddRepoCommand(context, 'auth-hardening', REPO_PATH);
    expect(text).toContain('Linked repository "app-api" to project "auth-hardening"');
  });

  it('reports a repository already associated instead of duplicating it', async () => {
    const context = buildContext({
      gitReader: new FakeGitReaderWithRemote(
        new Map([[REPO_PATH, 'git@host:acme-widgets/app-api.git']]),
      ),
      directoryExistence: new FakeDirectoryExistence(new Set([REPO_PATH])),
    });
    await runProjectCreateCommand(context, 'auth-hardening');
    await runProjectAddRepoCommand(context, 'auth-hardening', REPO_PATH);
    const text = await runProjectAddRepoCommand(context, 'auth-hardening', REPO_PATH);
    expect(text).toContain('already associated');
  });

  it('reports a project that does not exist', async () => {
    const context = buildContext({
      directoryExistence: new FakeDirectoryExistence(new Set([REPO_PATH])),
    });
    const text = await runProjectAddRepoCommand(context, 'ghost', REPO_PATH);
    expect(text).toContain('"ghost" not found');
  });
});

describe('runProjectOpenCommand', () => {
  it('refuses when the project has no default harness and none was given', async () => {
    const context = buildContext();
    await runProjectCreateCommand(context, 'auth-hardening');
    const { stdout, output } = collectStdout();
    const exitCode = await runProjectOpenCommand(
      buildOpenDeps(context),
      'auth-hardening',
      undefined,
      buildOpenIo(stdout),
    );
    expect(exitCode).toBe(1);
    expect(output()).toContain('no default harness set');
  });

  it('opens with --with claude, streaming a missing-repository warning before launch, and reports the id it generated (item 4) plus the final lock state (item 3)', async () => {
    const harnessLauncher = new FakeHarnessLauncher();
    const context = buildContext({
      gitReader: new FakeGitReaderWithRemote(
        new Map([[REPO_PATH, 'git@host:acme-widgets/app-api.git']]),
      ),
      directoryExistence: new FakeDirectoryExistence(new Set([REPO_PATH])),
      harnessLauncher,
    });
    await runProjectCreateCommand(context, 'auth-hardening');
    await runProjectAddRepoCommand(context, 'auth-hardening', REPO_PATH);
    // A second associated repository that was never registered on this device (add-repo never
    // ran for it) — item 4: open warns about it and continues with the one it does have.
    await context.workspace.writeProjectManifest(
      path.join(SEEYA_HOME, 'workspace'),
      'auth-hardening',
      {
        ...(await context.workspace.readProjectManifest(
          path.join(SEEYA_HOME, 'workspace'),
          'auth-hardening',
        ))!,
        repositories: [
          ...(await context.workspace.readProjectManifest(
            path.join(SEEYA_HOME, 'workspace'),
            'auth-hardening',
          ))!.repositories,
          { hasRemote: false, name: 'frontend' },
        ],
      },
    );
    const { stdout, output } = collectStdout();
    const exitCode = await runProjectOpenCommand(
      buildOpenDeps(context),
      'auth-hardening',
      'claude',
      buildOpenIo(stdout),
    );
    expect(exitCode).toBe(0);
    const text = output();
    expect(text).toContain('Repository "frontend" is not registered on this device');
    expect(text).toContain('lock: none');
    expect(text).toContain('closed (claude exited with code 0)');
    expect(harnessLauncher.calls).toEqual([
      {
        cwd: path.join(SEEYA_HOME, 'workspace', 'auth-hardening'),
        addDirs: [REPO_PATH],
        sessionId: LAUNCHED_SESSION_ID,
        systemPromptAppend: null,
      },
    ]);
  });

  describe('a project locked by another (live) session — V2-T35 item 1', () => {
    // pid 777 is "alive" for `ControllableProcessControl` — the one thing that turns this lock
    // into `readOnly` instead of a reclaimable stale one (`core/project-lock.ts
    // #decideProjectLockAcquisition`).
    function buildLockedContext(harnessLauncher: FakeHarnessLauncher): ProjectContext {
      return buildContext({
        processControl: new ControllableProcessControl(new Map([[777, true]])),
        harnessLauncher,
      });
    }

    async function lockAuthHardening(context: ProjectContext): Promise<void> {
      await runProjectCreateCommand(context, 'auth-hardening');
      // `ProjectLock.write`'s `root` is the WORKSPACE root, not the project's own directory
      // (`core/ports.ts#ProjectLock`'s own docstring — same key shape `application/project-open
      // .test.ts` already uses).
      await context.projectLock.write(path.join(SEEYA_HOME, 'workspace'), 'auth-hardening', {
        sessionId: 'other-session',
        pid: 777,
        procStart: undefined,
        acquiredAt: new Date('2026-09-22T09:00:00.000Z'),
      });
    }

    it('without a TTY, refuses without ever asking or launching the harness', async () => {
      const harnessLauncher = new FakeHarnessLauncher();
      const context = buildLockedContext(harnessLauncher);
      await lockAuthHardening(context);
      const { stdout, output } = collectStdout();
      const exitCode = await runProjectOpenCommand(
        buildOpenDeps(context),
        'auth-hardening',
        'claude',
        buildOpenIo(stdout),
      );
      expect(exitCode).toBe(1);
      const text = output();
      expect(text).toContain('locked by session other-session');
      expect(text).toContain('refusing to open without a way to ask for confirmation');
      expect(harnessLauncher.calls).toHaveLength(0);
    });

    it('with a TTY and an explicit "y", opens read-only and the session gets the same warning', async () => {
      const harnessLauncher = new FakeHarnessLauncher();
      const context = buildLockedContext(harnessLauncher);
      await lockAuthHardening(context);
      const { stdout, output } = collectStdout();
      // Written BEFORE the call, same as `start-day-command.test.ts#makeIo` — `node:stream`
      // buffers it, so `readline`'s own `question()` sees it whenever it starts reading, no race.
      const stdin = new PassThrough();
      stdin.write('y\n');
      const exitCode = await runProjectOpenCommand(
        buildOpenDeps(context),
        'auth-hardening',
        'claude',
        { stdin, stdout, isTTY: true },
      );
      expect(exitCode).toBe(0);
      const text = output();
      expect(text).toContain('locked by session other-session');
      expect(text).toContain('Continue and open this project for reading only');
      expect(harnessLauncher.calls).toHaveLength(1);
      expect(harnessLauncher.calls[0]?.systemPromptAppend).toContain(
        'locked by session other-session',
      );
    });

    it('with a TTY and a blank answer, declines — never launches the harness', async () => {
      const harnessLauncher = new FakeHarnessLauncher();
      const context = buildLockedContext(harnessLauncher);
      await lockAuthHardening(context);
      const { stdout, output } = collectStdout();
      const stdin = new PassThrough();
      stdin.write('\n');
      const exitCode = await runProjectOpenCommand(
        buildOpenDeps(context),
        'auth-hardening',
        'claude',
        { stdin, stdout, isTTY: true },
      );
      expect(exitCode).toBe(0);
      expect(output()).toContain('you chose not to continue');
      expect(harnessLauncher.calls).toHaveLength(0);
    });
  });
});

describe('runProjectAdoptCommand', () => {
  const ORIGINAL: DiscoveredSession = {
    sessionId: '11111111-1111-4111-8111-111111111111',
    cwd: 'c:\\code\\projeto',
    name: 'projeto-01',
    hasTranscript: true,
    lastTranscriptWrite: new Date('2026-09-24T09:00:00.000Z'),
    lastActivity: new Date('2026-09-24T09:00:00.000Z'),
    hasPid: true,
    pid: 4242,
    procStart: '123456789',
    processIsAlive: false,
  };
  const FORK_SESSION_ID = '22222222-2222-4222-8222-222222222222';

  function buildAdoptDeps(
    context: ProjectContext,
    overrides: Partial<AdoptSessionDeps> = {},
  ): AdoptSessionDeps {
    return {
      ...context,
      forkRegistration: new FakeForkRegistration(),
      forkCleanup: new FakeForkCleanup(),
      adoptionLauncher: new FakeSessionAdoptionLauncher(),
      idleMinutes: 45,
      pid: 9999,
      procStart: undefined,
      forkSessionId: FORK_SESSION_ID,
      ...overrides,
    };
  }

  it('no match for the session argument: refuses, never touches adoptSession at all', async () => {
    const context = buildContext();
    const sessionProvider = new FakeSessionProvider({ sessions: [], rejected: [] });
    const { stdout, output } = collectStdout();
    const exitCode = await runProjectAdoptCommand(
      sessionProvider,
      buildAdoptDeps(context),
      'ghost-session',
      'auth-hardening',
      buildOpenIo(stdout),
    );
    expect(exitCode).toBe(1);
    expect(output()).toContain('No discovered session matches "ghost-session"');
  });

  it('ambiguous match: refuses, names every candidate sessionId', async () => {
    const context = buildContext();
    const second: DiscoveredSession = {
      ...ORIGINAL,
      sessionId: '33333333-3333-4333-8333-333333333333',
    };
    const sessionProvider = new FakeSessionProvider({
      sessions: [
        { ...ORIGINAL, name: 'same-name' },
        { ...second, name: 'same-name' },
      ],
      rejected: [],
    });
    const { stdout, output } = collectStdout();
    const exitCode = await runProjectAdoptCommand(
      sessionProvider,
      buildAdoptDeps(context),
      'same-name',
      'auth-hardening',
      buildOpenIo(stdout),
    );
    expect(exitCode).toBe(1);
    const text = output();
    expect(text).toContain('refusing to guess');
    expect(text).toContain(ORIGINAL.sessionId);
    expect(text).toContain(second.sessionId);
  });

  it('resolves by display name, creates the project, and reports noChanges when the fork wrote nothing', async () => {
    const context = buildContext();
    const sessionProvider = new FakeSessionProvider({ sessions: [ORIGINAL], rejected: [] });
    const { stdout, output } = collectStdout();
    const exitCode = await runProjectAdoptCommand(
      sessionProvider,
      buildAdoptDeps(context),
      ORIGINAL.name,
      'auth-hardening',
      buildOpenIo(stdout),
    );
    expect(exitCode).toBe(0);
    const text = output();
    expect(text).toContain(`Adopting "${ORIGINAL.name}" into project "auth-hardening"`);
    expect(text).toContain('nothing to commit');
    expect(
      await context.workspace.projectExists(path.join(SEEYA_HOME, 'workspace'), 'auth-hardening'),
    ).toBe(true);
  });

  it('a running session refuses without launching the fork at all', async () => {
    const context = buildContext();
    const running: DiscoveredSession = { ...ORIGINAL, processIsAlive: true };
    const sessionProvider = new FakeSessionProvider({ sessions: [running], rejected: [] });
    const adoptionLauncher = new FakeSessionAdoptionLauncher();
    const { stdout, output } = collectStdout();
    const exitCode = await runProjectAdoptCommand(
      sessionProvider,
      buildAdoptDeps(context, { adoptionLauncher }),
      running.name,
      'auth-hardening',
      buildOpenIo(stdout),
    );
    expect(exitCode).toBe(1);
    expect(output()).toContain('running right now');
    expect(adoptionLauncher.calls).toHaveLength(0);
  });

  it('with a TTY and an explicit "y", commits — the fork id lands in the trailer', async () => {
    const workspace = new FakeWorkspaceRepository();
    const context = buildContext({ workspace });
    workspace.setChangedFiles('auth-hardening', ['auth-hardening/AGENTS.md']);
    const sessionProvider = new FakeSessionProvider({ sessions: [ORIGINAL], rejected: [] });
    const stdin = new PassThrough();
    stdin.write('y\n');
    const stdout = new PassThrough();
    let collected = '';
    stdout.on('data', (chunk: Buffer) => (collected += chunk.toString('utf8')));

    const exitCode = await runProjectAdoptCommand(
      sessionProvider,
      buildAdoptDeps(context),
      ORIGINAL.name,
      'auth-hardening',
      { stdin, stdout, isTTY: true },
    );

    expect(exitCode).toBe(0);
    expect(collected).toContain('adopted');
    expect(collected).toContain('Commit these changes?');
    expect(workspace.commitMessages.at(-1)).toContain(`Seeya-Session-Id: ${FORK_SESSION_ID}`);
  });

  it('with a TTY and a blank answer, declines — nothing committed', async () => {
    const workspace = new FakeWorkspaceRepository();
    const context = buildContext({ workspace });
    workspace.setChangedFiles('auth-hardening', ['auth-hardening/AGENTS.md']);
    const sessionProvider = new FakeSessionProvider({ sessions: [ORIGINAL], rejected: [] });
    const stdin = new PassThrough();
    stdin.write('\n');
    const stdout = new PassThrough();
    let collected = '';
    stdout.on('data', (chunk: Buffer) => (collected += chunk.toString('utf8')));

    const exitCode = await runProjectAdoptCommand(
      sessionProvider,
      buildAdoptDeps(context),
      ORIGINAL.name,
      'auth-hardening',
      { stdin, stdout, isTTY: true },
    );

    expect(exitCode).toBe(0);
    expect(collected).toContain('declined');
  });
});
