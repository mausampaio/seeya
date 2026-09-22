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
  runProjectCreateCommand,
  runProjectListCommand,
  runProjectOpenCommand,
  runProjectShowCommand,
} from '../../../packages/cli/src/project-command.js';
import type { ProjectContext } from '../../../packages/cli/src/composition.js';
import {
  DEFAULT_TEST_CONFIG,
  FakeDirectoryExistence,
  FakeGitReaderWithRemote,
  FakeHarnessLauncher,
  FakeWorkspaceRepository,
  InMemoryDeviceStorage,
} from '../application/_fakes.js';

const SEEYA_HOME = path.join('C:', 'seeya-home-fixture');
const REPO_PATH = path.join('C:', 'code', 'app-api');

function buildContext(overrides: Partial<ProjectContext> = {}): ProjectContext {
  return {
    storage: new InMemoryDeviceStorage(DEFAULT_TEST_CONFIG),
    workspace: new FakeWorkspaceRepository(),
    gitReader: new FakeGitReaderWithRemote(),
    directoryExistence: new FakeDirectoryExistence(),
    harnessLauncher: new FakeHarnessLauncher(),
    seeyaHome: SEEYA_HOME,
    ...overrides,
  };
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
    const exitCode = await runProjectOpenCommand(context, 'auth-hardening', undefined, { stdout });
    expect(exitCode).toBe(1);
    expect(output()).toContain('no default harness set');
  });

  it('opens with --with claude, streaming a missing-repository warning before launch', async () => {
    const context = buildContext({
      gitReader: new FakeGitReaderWithRemote(
        new Map([[REPO_PATH, 'git@host:acme-widgets/app-api.git']]),
      ),
      directoryExistence: new FakeDirectoryExistence(new Set([REPO_PATH])),
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
    const exitCode = await runProjectOpenCommand(context, 'auth-hardening', 'claude', { stdout });
    expect(exitCode).toBe(0);
    const text = output();
    expect(text).toContain('Repository "frontend" is not registered on this device');
    expect(text).toContain('closed (claude exited with code 0)');
  });
});
