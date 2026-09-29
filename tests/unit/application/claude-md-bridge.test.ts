/**
 * `application/claude-md-bridge.ts` (D-050/V2-T61) — the thin orchestration; the pure content is
 * `tests/unit/core/project-claude-md.test.ts`'s job.
 */
import { describe, expect, it } from 'vitest';
import { ensureGeneratedClaudeMdInstalled } from '@seeya-ai/engine/application/claude-md-bridge.js';
import { buildGeneratedClaudeMd } from '@seeya-ai/engine/core/project-claude-md.js';
import { FakeWorkspaceRepository } from './_fakes.js';

describe('ensureGeneratedClaudeMdInstalled', () => {
  it('writes the generated CLAUDE.md when the project has none versioned', async () => {
    const workspace = new FakeWorkspaceRepository();
    const outcome = await ensureGeneratedClaudeMdInstalled(
      workspace,
      'C:\\workspace',
      'auth-hardening',
    );
    expect(outcome).toEqual({ kind: 'written' });
    expect(workspace.installedGeneratedClaudeMdCalls).toHaveLength(1);
    const call = workspace.installedGeneratedClaudeMdCalls[0];
    expect(call?.root).toBe('C:\\workspace');
    expect(call?.projectId).toBe('auth-hardening');
    expect(call?.content).toBe(buildGeneratedClaudeMd());
  });

  it('never overwrites — and never deletes — an already-versioned CLAUDE.md (item 2, D-025)', async () => {
    const workspace = new FakeWorkspaceRepository();
    workspace.setClaudeMdVersioned('auth-hardening', true);
    const outcome = await ensureGeneratedClaudeMdInstalled(
      workspace,
      'C:\\workspace',
      'auth-hardening',
    );
    expect(outcome).toEqual({ kind: 'skippedVersioned' });
    expect(workspace.installedGeneratedClaudeMdCalls).toHaveLength(0);
  });

  it('checks per project — a versioned CLAUDE.md in one project never skips another', async () => {
    const workspace = new FakeWorkspaceRepository();
    workspace.setClaudeMdVersioned('other-project', true);
    const outcome = await ensureGeneratedClaudeMdInstalled(
      workspace,
      'C:\\workspace',
      'auth-hardening',
    );
    expect(outcome).toEqual({ kind: 'written' });
  });
});
