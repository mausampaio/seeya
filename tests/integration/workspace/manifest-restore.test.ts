/**
 * `FsWorkspaceRepository.restoreProjectManifestIfChanged` (V2-T73 item 2, mechanics in
 * `adapters/workspace/manifest-restore.ts`) against a real filesystem and a real `git` binary —
 * same "this is the one adapter whose entire job is to shell out to it" reasoning
 * `fs-workspace-repository.test.ts` already documents. Every case item 2's own spec names: a
 * modified file, an invalid one, a deleted one, an equal one (nothing to do), and a workspace with
 * no committed version at all to restore to (D-025).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { FsWorkspaceRepository } from '@seeya-ai/engine/adapters/workspace/index.js';
import { runGit } from '@seeya-ai/engine/adapters/git/run-git.js';
import { buildProjectSkeleton } from '@seeya-ai/engine/core/project-skeleton.js';
import { buildProjectCommitMessage } from '@seeya-ai/engine/core/project-commit.js';

async function makeTmpDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'seeya-manifest-restore-'));
}

async function setUpCommittedProject(): Promise<{
  readonly root: string;
  readonly workspace: FsWorkspaceRepository;
  readonly manifestPath: string;
  readonly committedContent: string;
}> {
  const root = await makeTmpDir();
  const workspace = new FsWorkspaceRepository();
  await workspace.initialize(root);
  await workspace.writeProjectSkeleton(
    root,
    'auth-hardening',
    buildProjectSkeleton('auth-hardening'),
  );
  // No commit-msg hook installed here — this suite is about the adapter's own git mechanics, not
  // the hook (`tests/integration/workspace/commit-msg-hook.test.ts`'s own job), so `manifestWriteAuthorized`
  // has nothing to authorize against and is safely omitted.
  await workspace.commitAll(
    root,
    'auth-hardening',
    buildProjectCommitMessage('Create project auth-hardening', 'auth-hardening', undefined),
  );
  const manifestPath = path.join(root, 'auth-hardening', 'seeya.json');
  const committedContent = await readFile(manifestPath, 'utf8');
  return { root, workspace, manifestPath, committedContent };
}

/** Compares by PARSED content, never raw bytes — a real `git checkout` on a machine with
 * `core.autocrlf` enabled (common on Windows) normalizes line endings on the way out, which is a
 * property of that machine's own git config, not of whether this feature restored the right
 * content. Measured directly writing this suite: the byte-identity assertion failed on a real
 * Windows checkout with `\r\n` where the pre-checkout capture had `\n`, same bytes otherwise. */
async function readParsedManifest(manifestPath: string): Promise<unknown> {
  return JSON.parse(await readFile(manifestPath, 'utf8'));
}

describe('restoreProjectManifestIfChanged', () => {
  let root: string | undefined;

  afterEach(async () => {
    if (root !== undefined) {
      await rm(root, { recursive: true, force: true });
      root = undefined;
    }
  });

  it('reports "unchanged" and touches nothing when the working tree already matches HEAD', async () => {
    const setup = await setUpCommittedProject();
    root = setup.root;

    const outcome = await setup.workspace.restoreProjectManifestIfChanged(root, 'auth-hardening');

    expect(outcome).toEqual({ kind: 'unchanged' });
    expect(await readFile(setup.manifestPath, 'utf8')).toBe(setup.committedContent);
  });

  it('restores a MODIFIED (but still valid) manifest, and reports a non-empty diff summary', async () => {
    const setup = await setUpCommittedProject();
    root = setup.root;
    await writeFile(
      setup.manifestPath,
      JSON.stringify({
        schemaVersion: 1,
        id: 'auth-hardening',
        name: 'edited by hand',
        defaultHarness: null,
        repositories: [],
        trackers: [],
      }) + '\n',
    );

    const outcome = await setup.workspace.restoreProjectManifestIfChanged(root, 'auth-hardening');

    expect(outcome.kind).toBe('restored');
    expect(outcome.kind === 'restored' && outcome.diffSummary.length > 0).toBe(true);
    expect(outcome.kind === 'restored' && outcome.diffSummary).toContain('seeya.json');
    expect(await readParsedManifest(setup.manifestPath)).toEqual(
      JSON.parse(setup.committedContent),
    );
  });

  it('restores an INVALID (not even valid JSON) manifest — git diffs text, never parses it', async () => {
    const setup = await setUpCommittedProject();
    root = setup.root;
    await writeFile(setup.manifestPath, '{ this is not valid json at all');

    const outcome = await setup.workspace.restoreProjectManifestIfChanged(root, 'auth-hardening');

    expect(outcome.kind).toBe('restored');
    // Provable, not just asserted: the restored content parses at all, and matches HEAD's own.
    expect(await readParsedManifest(setup.manifestPath)).toEqual(
      JSON.parse(setup.committedContent),
    );
  });

  it('restores a DELETED manifest — recreates the file from HEAD', async () => {
    const setup = await setUpCommittedProject();
    root = setup.root;
    await rm(setup.manifestPath);

    const outcome = await setup.workspace.restoreProjectManifestIfChanged(root, 'auth-hardening');

    expect(outcome.kind).toBe('restored');
    expect(await readParsedManifest(setup.manifestPath)).toEqual(
      JSON.parse(setup.committedContent),
    );
  });

  it('restores a STAGED (git add, never committed) change too — the index, not just the working tree', async () => {
    const setup = await setUpCommittedProject();
    root = setup.root;
    await writeFile(setup.manifestPath, '{"schemaVersion": 999}\n');
    await runGit(root, ['add', path.join('auth-hardening', 'seeya.json')]);

    const outcome = await setup.workspace.restoreProjectManifestIfChanged(root, 'auth-hardening');

    expect(outcome.kind).toBe('restored');
    expect(await readParsedManifest(setup.manifestPath)).toEqual(
      JSON.parse(setup.committedContent),
    );
    const status = await runGit(root, ['status', '--porcelain', '--', 'auth-hardening']);
    expect(status.ran && status.stdout.trim()).toBe('');
  });

  it('reports "noCommittedVersion" for a workspace with no commits at all (D-025)', async () => {
    root = await makeTmpDir();
    const workspace = new FsWorkspaceRepository();
    await workspace.initialize(root);
    await workspace.writeProjectSkeleton(
      root,
      'auth-hardening',
      buildProjectSkeleton('auth-hardening'),
    );
    // Deliberately never committed — HEAD does not resolve yet.

    const outcome = await workspace.restoreProjectManifestIfChanged(root, 'auth-hardening');

    expect(outcome).toEqual({ kind: 'noCommittedVersion' });
  });

  it('is a harmless no-op for a project id that was never created at all', async () => {
    const setup = await setUpCommittedProject();
    root = setup.root;

    const outcome = await setup.workspace.restoreProjectManifestIfChanged(root, 'never-existed');

    expect(outcome).toEqual({ kind: 'unchanged' });
  });

  it('throws a real error when root is not a git repository at all (never mistaken for "noCommittedVersion")', async () => {
    root = await makeTmpDir();
    const workspace = new FsWorkspaceRepository();
    // Deliberately never `initialize`d — real `git rev-parse` here fails with "not a git
    // repository" (a genuine non-0/1 exit code), a different failure from "this repo just has no
    // commits yet" (exit 1) — the two must never collapse into the same `noCommittedVersion`.
    await expect(workspace.restoreProjectManifestIfChanged(root, 'auth-hardening')).rejects.toThrow(
      /git rev-parse failed/,
    );
  });

  it('throws a real error when git diff itself fails unexpectedly (a corrupted .git/index — real git reports exit 128, never 0 or 1)', async () => {
    const setup = await setUpCommittedProject();
    root = setup.root;
    // `git rev-parse HEAD` never reads the index (it only resolves refs), so this corruption is
    // reached specifically by the `git diff` call below, not by `headResolves` — a real,
    // reproducible failure (measured: "fatal: .git/index: index file smaller than expected"),
    // never a contrived one.
    await writeFile(path.join(root, '.git', 'index'), 'not a real git index');

    await expect(
      setup.workspace.restoreProjectManifestIfChanged(root, 'auth-hardening'),
    ).rejects.toThrow(/git diff failed/);
  });
});
