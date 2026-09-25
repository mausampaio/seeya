/**
 * `application/workspace-hooks.ts` (V2-T34 item 1) — the thin orchestration; the pure script text
 * is `tests/unit/core/workspace-hooks.test.ts`'s job, real execution is
 * `tests/integration/workspace/commit-msg-hook.test.ts`'s.
 */
import { describe, expect, it } from 'vitest';
import { ensureWorkspaceHooksInstalled } from '@seeya-ai/engine/application/workspace-hooks.js';
import { FakeWorkspaceRepository } from './_fakes.js';

describe('ensureWorkspaceHooksInstalled', () => {
  it('writes the built commit-msg script into the workspace', async () => {
    const workspace = new FakeWorkspaceRepository();
    await ensureWorkspaceHooksInstalled(
      workspace,
      'C:\\workspace',
      '/usr/bin/node',
      '/opt/seeya/index.js',
    );
    expect(workspace.installedCommitMsgHookCalls).toHaveLength(1);
    const call = workspace.installedCommitMsgHookCalls[0];
    expect(call?.root).toBe('C:\\workspace');
    expect(call?.scriptContent).toContain('project verify-commit');
    expect(call?.scriptContent).toContain('/opt/seeya/index.js');
  });

  it('folds the optional env prefix into the script (the app composition)', async () => {
    const workspace = new FakeWorkspaceRepository();
    await ensureWorkspaceHooksInstalled(
      workspace,
      'C:\\workspace',
      '/electron',
      '/opt/seeya/index.js',
      {
        ELECTRON_RUN_AS_NODE: '1',
      },
    );
    expect(workspace.installedCommitMsgHookCalls[0]?.scriptContent).toContain(
      'ELECTRON_RUN_AS_NODE=1',
    );
  });
});
