/**
 * `runProjectRemoveCommand`/`runProjectRemoveRepoCommand`/`runProjectRevertAdoptionCommand`
 * (V2-T32) — the thin CLI layer over `application/project-remove.ts`/`project-remove-repo.ts`/
 * `project-revert-adoption.ts`, same "this layer only calls through and formats" scope
 * `project-command.test.ts` already establishes for the sibling commands.
 */
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import {
  runProjectRemoveCommand,
  runProjectRemoveRepoCommand,
  runProjectRevertAdoptionCommand,
} from '../../../packages/cli/src/project-undo-command.js';
import type { RemoveProjectDeps } from '@seeya-ai/engine/application/project-remove.js';
import type { RemoveRepositoryDeps } from '@seeya-ai/engine/application/project-remove-repo.js';
import type { RevertAdoptionDeps } from '@seeya-ai/engine/application/project-revert-adoption.js';
import { createProject } from '@seeya-ai/engine/application/workspace.js';
import type { AdoptionRecord } from '@seeya-ai/engine/core/types.js';
import {
  ControllableProcessControl,
  DEFAULT_TEST_CONFIG,
  FakeClock,
  FakeForkCleanup,
  FakeProjectLock,
  FakeWorkspaceRepository,
  InMemoryDeviceStorage,
} from '../application/_fakes.js';

const SEEYA_HOME = path.resolve(path.sep, 'seeya-home-fixture');
const NOW = new Date('2026-09-24T12:00:00.000Z');

function collectStdout(): { readonly stdout: PassThrough; readonly output: () => string } {
  const stdout = new PassThrough();
  let collected = '';
  stdout.on('data', (chunk: Buffer) => {
    collected += chunk.toString('utf8');
  });
  return { stdout, output: () => collected };
}

function answerPromptWhenSeen(
  stdout: PassThrough,
  stdin: PassThrough,
  marker: string,
  answer: string,
): void {
  const handler = (chunk: Buffer): void => {
    if (chunk.toString('utf8').includes(marker)) {
      stdout.removeListener('data', handler);
      stdin.write(answer);
    }
  };
  stdout.on('data', handler);
}

async function setUpProject(
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
    },
    'auth-hardening',
  );
}

describe('runProjectRemoveCommand', () => {
  function buildDeps(
    storage: InMemoryDeviceStorage,
    workspace: FakeWorkspaceRepository,
  ): RemoveProjectDeps {
    return {
      storage,
      workspace,
      projectLock: new FakeProjectLock(),
      processControl: new ControllableProcessControl(),
      clock: new FakeClock(NOW),
      seeyaHome: SEEYA_HOME,
      sessionId: undefined,
      pid: 4242,
      procStart: undefined,
    };
  }

  it('removes on an explicit yes and reports exit code 0', async () => {
    const storage = new InMemoryDeviceStorage(DEFAULT_TEST_CONFIG);
    const workspace = new FakeWorkspaceRepository();
    await setUpProject(storage, workspace);
    const { stdout, output } = collectStdout();
    const stdin = new PassThrough();
    stdin.write('y\n');

    const exitCode = await runProjectRemoveCommand(
      buildDeps(storage, workspace),
      'auth-hardening',
      {
        stdin,
        stdout,
        isTTY: true,
      },
    );

    expect(exitCode).toBe(0);
    expect(output()).toContain('removed');
    expect(workspace.wasProjectDirRemoved('auth-hardening')).toBe(true);
  });

  it('a decline is a clean outcome (exit 0), never a removal', async () => {
    const storage = new InMemoryDeviceStorage(DEFAULT_TEST_CONFIG);
    const workspace = new FakeWorkspaceRepository();
    await setUpProject(storage, workspace);
    const { stdout, output } = collectStdout();
    const stdin = new PassThrough();
    stdin.write('n\n');

    const exitCode = await runProjectRemoveCommand(
      buildDeps(storage, workspace),
      'auth-hardening',
      {
        stdin,
        stdout,
        isTTY: true,
      },
    );

    expect(exitCode).toBe(0);
    expect(output()).toContain('cancelled');
    expect(workspace.wasProjectDirRemoved('auth-hardening')).toBe(false);
  });

  it('a non-interactive run refuses (exit 1), never removing without a way to ask', async () => {
    const storage = new InMemoryDeviceStorage(DEFAULT_TEST_CONFIG);
    const workspace = new FakeWorkspaceRepository();
    await setUpProject(storage, workspace);
    const { stdout, output } = collectStdout();

    const exitCode = await runProjectRemoveCommand(
      buildDeps(storage, workspace),
      'auth-hardening',
      {
        stdin: new PassThrough(),
        stdout,
        isTTY: false,
      },
    );

    expect(exitCode).toBe(1);
    expect(output()).toContain('no interactive terminal');
    expect(workspace.wasProjectDirRemoved('auth-hardening')).toBe(false);
  });
});

describe('runProjectRemoveRepoCommand', () => {
  it('formats a projectNotFound report with no confirmation at all', async () => {
    const storage = new InMemoryDeviceStorage(DEFAULT_TEST_CONFIG);
    const deps: RemoveRepositoryDeps = {
      storage,
      workspace: new FakeWorkspaceRepository(),
      projectLock: new FakeProjectLock(),
      processControl: new ControllableProcessControl(),
      clock: new FakeClock(NOW),
      seeyaHome: SEEYA_HOME,
      sessionId: undefined,
      pid: 4242,
      procStart: undefined,
    };
    const text = await runProjectRemoveRepoCommand(deps, 'ghost', 'app-api');
    expect(text).toContain('not found');
  });
});

describe('runProjectRevertAdoptionCommand', () => {
  const ORIGINAL_SESSION_ID = '11111111-1111-4111-8111-111111111111';
  const FORK_SESSION_ID = '22222222-2222-4222-8222-222222222222';

  function buildDeps(
    storage: InMemoryDeviceStorage,
    workspace: FakeWorkspaceRepository,
    forkCleanup: FakeForkCleanup,
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
      pid: 4242,
      procStart: undefined,
    };
  }

  async function setUpAdoption(
    storage: InMemoryDeviceStorage,
    workspace: FakeWorkspaceRepository,
  ): Promise<void> {
    await setUpProject(storage, workspace);
    const record: AdoptionRecord = {
      originalSessionId: ORIGINAL_SESSION_ID,
      forkSessionId: FORK_SESSION_ID,
      projectId: 'auth-hardening',
      adoptedAt: new Date('2026-09-23T10:00:00.000Z'),
    };
    await storage.saveAdoptions([record]);
    workspace.setSessionCommits('auth-hardening', FORK_SESSION_ID, [
      { hash: 'fork-commit-1', files: ['auth-hardening/context/know-how.md'] },
    ]);
  }

  it('reverts on an explicit yes, then deletes the copy without a second question (unchanged)', async () => {
    const storage = new InMemoryDeviceStorage(DEFAULT_TEST_CONFIG);
    const workspace = new FakeWorkspaceRepository();
    const forkCleanup = new FakeForkCleanup();
    await setUpAdoption(storage, workspace);
    forkCleanup.setForkActivity(FORK_SESSION_ID, {
      kind: 'found',
      lastWrite: new Date('2026-09-20T00:00:00.000Z'), // before adoptedAt — unchanged
      sizeBytes: 10,
    });
    const { stdout, output } = collectStdout();
    const stdin = new PassThrough();
    stdin.write('y\n');

    const exitCode = await runProjectRevertAdoptionCommand(
      buildDeps(storage, workspace, forkCleanup),
      'auth-hardening',
      undefined,
      { stdin, stdout, isTTY: true },
    );

    expect(exitCode).toBe(0);
    expect(output()).toContain('reverted');
    expect(output()).toContain('was deleted');
    expect(await storage.readAdoptions()).toEqual([]);
  });

  it('asks a second question about the copy when it grew, over the SAME reader', async () => {
    const storage = new InMemoryDeviceStorage(DEFAULT_TEST_CONFIG);
    const workspace = new FakeWorkspaceRepository();
    const forkCleanup = new FakeForkCleanup();
    await setUpAdoption(storage, workspace);
    forkCleanup.setForkActivity(FORK_SESSION_ID, {
      kind: 'found',
      lastWrite: new Date('2026-09-24T00:00:00.000Z'), // after adoptedAt — grew
      sizeBytes: 4096,
    });
    const { stdout, output } = collectStdout();
    const stdin = new PassThrough();
    answerPromptWhenSeen(stdout, stdin, 'Continue? [y/N]', 'y\n');
    answerPromptWhenSeen(stdout, stdin, 'Delete it anyway?', 'n\n');

    const exitCode = await runProjectRevertAdoptionCommand(
      buildDeps(storage, workspace, forkCleanup),
      'auth-hardening',
      undefined,
      { stdin, stdout, isTTY: true },
    );

    expect(exitCode).toBe(0);
    expect(output()).toContain('reverted');
    expect(output()).toContain('was kept');
    expect(forkCleanup.deletedSessionIds).toEqual([]);
  });

  it('a non-interactive run refuses the revert confirmation (exit 1)', async () => {
    const storage = new InMemoryDeviceStorage(DEFAULT_TEST_CONFIG);
    const workspace = new FakeWorkspaceRepository();
    const forkCleanup = new FakeForkCleanup();
    await setUpAdoption(storage, workspace);
    const { stdout, output } = collectStdout();

    const exitCode = await runProjectRevertAdoptionCommand(
      buildDeps(storage, workspace, forkCleanup),
      'auth-hardening',
      undefined,
      { stdin: new PassThrough(), stdout, isTTY: false },
    );

    expect(exitCode).toBe(1);
    expect(output()).toContain('no interactive terminal');
    expect(await storage.readAdoptions()).toHaveLength(1);
  });

  it('noAdoption is a refusal (exit 1), never treated as a clean no-op', async () => {
    const storage = new InMemoryDeviceStorage(DEFAULT_TEST_CONFIG);
    const workspace = new FakeWorkspaceRepository();
    const forkCleanup = new FakeForkCleanup();
    await setUpProject(storage, workspace);
    const { stdout, output } = collectStdout();

    const exitCode = await runProjectRevertAdoptionCommand(
      buildDeps(storage, workspace, forkCleanup),
      'auth-hardening',
      undefined,
      { stdin: new PassThrough(), stdout, isTTY: false },
    );

    expect(exitCode).toBe(1);
    expect(output()).toContain('no adopted session');
  });
});
