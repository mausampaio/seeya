/**
 * `runProjectCreateCommand`/`runProjectListCommand`/`runProjectShowCommand` (V2-T27) — the thin
 * CLI layer over `application/workspace.ts`, against the same named doubles that module's own
 * tests use (`FakeWorkspaceRepository`/`InMemoryWorkspaceStorage`,
 * `tests/unit/application/_fakes.ts`). The point here is only that this layer calls through and
 * formats correctly — `application/workspace.test.ts` already covers the orchestration itself,
 * and `format-project.test.ts` already covers every rendering branch.
 */
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  runProjectCreateCommand,
  runProjectListCommand,
  runProjectShowCommand,
} from '../../../packages/cli/src/project-command.js';
import type { ProjectContext } from '../../../packages/cli/src/composition.js';
import {
  DEFAULT_TEST_CONFIG,
  FakeWorkspaceRepository,
  InMemoryWorkspaceStorage,
} from '../application/_fakes.js';

const SEEYA_HOME = path.join('C:', 'seeya-home-fixture');

function buildContext(): ProjectContext {
  return {
    storage: new InMemoryWorkspaceStorage(DEFAULT_TEST_CONFIG),
    workspace: new FakeWorkspaceRepository(),
    seeyaHome: SEEYA_HOME,
  };
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
