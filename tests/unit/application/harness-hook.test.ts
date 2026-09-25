/**
 * `application/harness-hook.ts` (V2-T34 item 2, PO review) — the thin orchestration; the pure
 * settings/command text is `tests/unit/core/harness-hook-config.test.ts`'s job.
 */
import { describe, expect, it } from 'vitest';
import { ensureHarnessHookInstalled } from '@seeya-ai/engine/application/harness-hook.js';
import { FakeWorkspaceRepository } from './_fakes.js';

describe('ensureHarnessHookInstalled', () => {
  it('writes the built settings.json into the project', async () => {
    const workspace = new FakeWorkspaceRepository();
    await ensureHarnessHookInstalled(
      workspace,
      'C:\\workspace',
      'auth-hardening',
      '/usr/bin/node',
      '/opt/seeya/index.js',
    );
    expect(workspace.installedHarnessHookCalls).toHaveLength(1);
    const call = workspace.installedHarnessHookCalls[0];
    expect(call?.root).toBe('C:\\workspace');
    expect(call?.projectId).toBe('auth-hardening');
    expect(call?.settingsJsonContent).toContain('project verify-bash-command');
    expect(call?.settingsJsonContent).toContain('/opt/seeya/index.js');
  });

  it('folds the optional env prefix into the command (Electron)', async () => {
    const workspace = new FakeWorkspaceRepository();
    await ensureHarnessHookInstalled(
      workspace,
      'C:\\workspace',
      'auth-hardening',
      '/electron',
      '/opt/seeya/index.js',
      { ELECTRON_RUN_AS_NODE: '1' },
    );
    expect(workspace.installedHarnessHookCalls[0]?.settingsJsonContent).toContain(
      'ELECTRON_RUN_AS_NODE=1',
    );
  });
});
