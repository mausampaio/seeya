/**
 * `application/project-audit.ts` (V2-T34 item 3) — against fakes.
 */
import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { auditProject, type ProjectAuditDeps } from '@seeya-ai/engine/application/project-audit.js';
import { createProject } from '@seeya-ai/engine/application/workspace.js';
import {
  ControllableProcessControl,
  FakeProjectAuditMarker,
  FakeProjectLock,
  FakeWorkspaceRepository,
  InMemoryDeviceStorage,
  DEFAULT_TEST_CONFIG,
} from './_fakes.js';

// Absolute on every OS on purpose — same reasoning `project-open.test.ts`'s own module comment
// gives (`path.resolve`d, never a hand-typed drive letter that would only be absolute on Windows).
const SEEYA_HOME = path.resolve(path.sep, 'seeya-home-fixture');
const WORKSPACE_ROOT = path.join(SEEYA_HOME, 'workspace');

async function setUp(): Promise<{
  storage: InMemoryDeviceStorage;
  workspace: FakeWorkspaceRepository;
}> {
  const storage = new InMemoryDeviceStorage(DEFAULT_TEST_CONFIG);
  const workspace = new FakeWorkspaceRepository();
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
  return { storage, workspace };
}

function buildDeps(
  storage: InMemoryDeviceStorage,
  workspace: FakeWorkspaceRepository,
  auditMarker: FakeProjectAuditMarker,
): ProjectAuditDeps {
  return { storage, workspace, auditMarker, seeyaHome: SEEYA_HOME, lockFileName: '.seeya-lock' };
}

describe('auditProject', () => {
  it('refuses an invalid project id without touching any port', async () => {
    const { storage, workspace } = await setUp();
    const outcome = await auditProject(
      buildDeps(storage, workspace, new FakeProjectAuditMarker()),
      'Not Valid',
    );
    expect(outcome).toEqual({ kind: 'invalidId', projectId: 'Not Valid' });
  });

  it('reports notFound for a project that does not exist', async () => {
    const { storage, workspace } = await setUp();
    const outcome = await auditProject(
      buildDeps(storage, workspace, new FakeProjectAuditMarker()),
      'ghost',
    );
    expect(outcome).toEqual({ kind: 'notFound', projectId: 'ghost' });
  });

  it('reports zero escaped commits and zero checked when nothing was configured (D-025: least-specific)', async () => {
    const { storage, workspace } = await setUp();
    const outcome = await auditProject(
      buildDeps(storage, workspace, new FakeProjectAuditMarker()),
      'auth-hardening',
    );
    expect(outcome).toEqual({
      kind: 'audited',
      report: { projectId: 'auth-hardening', commitsChecked: 0, escaped: [] },
    });
  });

  it('reports what the workspace port flags as escaped', async () => {
    const { storage, workspace } = await setUp();
    workspace.setCommitsForAudit([
      { hash: 'abc', message: 'no trailers', files: ['auth-hardening/x'] },
    ]);
    const outcome = await auditProject(
      buildDeps(storage, workspace, new FakeProjectAuditMarker()),
      'auth-hardening',
    );
    expect(outcome.kind).toBe('audited');
    expect(outcome.kind === 'audited' && outcome.report.escaped).toHaveLength(1);
    expect(outcome.kind === 'audited' && outcome.report.commitsChecked).toBe(1);
  });

  it('writes the last commit as the new marker after auditing', async () => {
    const { storage, workspace } = await setUp();
    workspace.setCommitsForAudit([
      { hash: 'first', message: 'ok', files: ['auth-hardening/x'] },
      { hash: 'last', message: 'ok2', files: ['auth-hardening/y'] },
    ]);
    const auditMarker = new FakeProjectAuditMarker();
    await auditProject(buildDeps(storage, workspace, auditMarker), 'auth-hardening');
    // FakeWorkspaceRepository's own root for createProject is resolved by resolveWorkspaceRoot —
    // read it back through the marker with that same root to prove it was actually written.
    expect(await auditMarker.read(WORKSPACE_ROOT, 'auth-hardening')).toBe('last');
  });

  it('never writes a marker when there is nothing to check', async () => {
    const { storage, workspace } = await setUp();
    const auditMarker = new FakeProjectAuditMarker();
    await auditProject(buildDeps(storage, workspace, auditMarker), 'auth-hardening');
    expect(await auditMarker.read(WORKSPACE_ROOT, 'auth-hardening')).toBeNull();
  });
});
