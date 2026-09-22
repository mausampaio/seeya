/**
 * `readRemoteUrl` (V2-T28, `packages/engine/src/adapters/git/remote.ts`) against a real `git`
 * binary — same `createGitFixture` this directory's other integration suites already use.
 */
import { afterEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { readRemoteUrl } from '@seeya-ai/engine/adapters/git/remote.js';
import { runGit } from '@seeya-ai/engine/adapters/git/run-git.js';
import { createGitFixture, removeGitFixture, type GitFixture } from './_fixtures.js';

describe('readRemoteUrl', () => {
  let fixture: GitFixture | undefined;

  afterEach(async () => {
    if (fixture !== undefined) {
      await removeGitFixture(fixture);
      fixture = undefined;
    }
  });

  it('null when the directory is not a git repository at all', async () => {
    const missing = path.join(tmpdir(), 'seeya-git-does-not-exist-at-all');
    await expect(readRemoteUrl(missing)).resolves.toBeNull();
  });

  it('null when it IS a repository but has no "origin" remote configured', async () => {
    fixture = await createGitFixture();
    await expect(readRemoteUrl(fixture.mainDir)).resolves.toBeNull();
  });

  it('the exact URL "git remote get-url origin" reports, once one is configured', async () => {
    fixture = await createGitFixture();
    const remoteUrl = 'git@host:acme-widgets/app-api.git';
    const added = await runGit(fixture.mainDir, ['remote', 'add', 'origin', remoteUrl]);
    expect(added.ran && added.exitCode === 0).toBe(true);

    await expect(readRemoteUrl(fixture.mainDir)).resolves.toBe(remoteUrl);
  });
});
