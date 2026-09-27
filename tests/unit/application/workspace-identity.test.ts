/**
 * `application/workspace-identity.ts` (V2-T58, D-047 emendment) — the thin orchestration; real
 * execution (a plain `git commit` succeeding without any identity in its own environment) is
 * `tests/integration/workspace/local-identity.test.ts`'s job.
 */
import { describe, expect, it } from 'vitest';
import { ensureWorkspaceIdentityConfigured } from '@seeya-ai/engine/application/workspace-identity.js';
import { FakeWorkspaceRepository } from './_fakes.js';

describe('ensureWorkspaceIdentityConfigured', () => {
  it('configures the workspace-own local git identity at the given root', async () => {
    const workspace = new FakeWorkspaceRepository();
    await ensureWorkspaceIdentityConfigured(workspace, 'C:\\workspace');
    expect(workspace.configureIdentityCalls).toEqual(['C:\\workspace']);
  });
});
