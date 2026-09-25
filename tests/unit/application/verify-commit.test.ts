/**
 * `application/verify-commit.ts` (V2-T34 item 1) — against fakes; the real end-to-end proof (a real
 * `git commit` triggering the real generated hook script) is
 * `tests/integration/workspace/commit-msg-hook.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { verifyCommit, type VerifyCommitDeps } from '@seeya-ai/engine/application/verify-commit.js';
import {
  ControllableProcessControl,
  FakeCommitMessageFile,
  FakeProjectLock,
  FakeWorkspaceRepository,
} from './_fakes.js';

const ROOT = 'C:\\workspace';
const MESSAGE_FILE = 'C:\\workspace\\.git\\COMMIT_EDITMSG';

function buildDeps(overrides: Partial<VerifyCommitDeps> = {}): VerifyCommitDeps {
  return {
    workspace: new FakeWorkspaceRepository(),
    projectLock: new FakeProjectLock(),
    processControl: new ControllableProcessControl(),
    commitMessageFile: new FakeCommitMessageFile(),
    lockFileName: '.seeya-lock',
    currentSessionId: undefined,
    currentProcess: undefined,
    ...overrides,
  };
}

describe('verifyCommit', () => {
  it('allows a plain commit and writes the completed message back', async () => {
    const workspace = new FakeWorkspaceRepository();
    workspace.setStagedFiles(['auth-hardening/status/current.md']);
    const commitMessageFile = new FakeCommitMessageFile();
    commitMessageFile.setContent(MESSAGE_FILE, 'Write status\n');
    const deps = buildDeps({ workspace, commitMessageFile, currentSessionId: 'session-a' });

    const result = await verifyCommit(deps, ROOT, MESSAGE_FILE);

    expect(result).toEqual({ kind: 'allowed' });
    const written = await commitMessageFile.read(MESSAGE_FILE);
    expect(written).toContain('Seeya-Project-Id: auth-hardening');
    expect(written).toContain('Seeya-Session-Id: session-a');
  });

  it('never rewrites the file when both trailers already match', async () => {
    const workspace = new FakeWorkspaceRepository();
    workspace.setStagedFiles(['auth-hardening/status/current.md']);
    const original =
      'Write status\n\nSeeya-Project-Id: auth-hardening\nSeeya-Session-Id: session-a\n';
    const commitMessageFile = new FakeCommitMessageFile();
    commitMessageFile.setContent(MESSAGE_FILE, original);
    const deps = buildDeps({ workspace, commitMessageFile, currentSessionId: 'session-a' });

    await verifyCommit(deps, ROOT, MESSAGE_FILE);

    expect(await commitMessageFile.read(MESSAGE_FILE)).toBe(original);
  });

  it('refuses a commit touching two projects, without touching the message file', async () => {
    const workspace = new FakeWorkspaceRepository();
    workspace.setStagedFiles(['auth-hardening/AGENTS.md', 'billing-v2/AGENTS.md']);
    const commitMessageFile = new FakeCommitMessageFile();
    commitMessageFile.setContent(MESSAGE_FILE, 'Touch two');
    const deps = buildDeps({ workspace, commitMessageFile });

    const result = await verifyCommit(deps, ROOT, MESSAGE_FILE);

    expect(result.kind).toBe('refused');
    expect(result.kind === 'refused' && result.reason).toContain('one project per commit');
  });

  it("reads the touched project's own lock and refuses when held by a different live session", async () => {
    const workspace = new FakeWorkspaceRepository();
    workspace.setStagedFiles(['auth-hardening/AGENTS.md']);
    const projectLock = new FakeProjectLock();
    await projectLock.write(ROOT, 'auth-hardening', {
      sessionId: 'holder',
      pid: 4242,
      procStart: 'p-1',
      acquiredAt: new Date('2026-09-25T10:00:00.000Z'),
    });
    const processControl = new ControllableProcessControl(new Map([[4242, true]]));
    const commitMessageFile = new FakeCommitMessageFile();
    commitMessageFile.setContent(MESSAGE_FILE, 'Sneaky');
    const deps = buildDeps({
      workspace,
      projectLock,
      processControl,
      commitMessageFile,
      currentSessionId: 'outsider',
    });

    const result = await verifyCommit(deps, ROOT, MESSAGE_FILE);

    expect(result.kind).toBe('refused');
    expect(result.kind === 'refused' && result.reason).toContain('holder');
  });

  it('authorizes the commit via currentProcess when it matches the lock, even with no session id anywhere (V2-T34 hotfix)', async () => {
    const workspace = new FakeWorkspaceRepository();
    workspace.setStagedFiles(['auth-hardening/AGENTS.md']);
    const projectLock = new FakeProjectLock();
    await projectLock.write(ROOT, 'auth-hardening', {
      sessionId: undefined,
      pid: 4242,
      procStart: 'p-1',
      acquiredAt: new Date('2026-09-25T10:00:00.000Z'),
    });
    const processControl = new ControllableProcessControl(new Map([[4242, true]]));
    const commitMessageFile = new FakeCommitMessageFile();
    commitMessageFile.setContent(
      MESSAGE_FILE,
      'Remove repository app-api from project auth-hardening',
    );
    const deps = buildDeps({
      workspace,
      projectLock,
      processControl,
      commitMessageFile,
      currentSessionId: undefined,
      currentProcess: { pid: 4242, procStart: 'p-1' },
    });

    const result = await verifyCommit(deps, ROOT, MESSAGE_FILE);

    expect(result).toEqual({ kind: 'allowed' });
    const written = await commitMessageFile.read(MESSAGE_FILE);
    expect(written).toContain('Seeya-Session-Id: unknown');
  });

  it('never reads a lock when the commit touches no single project', async () => {
    const workspace = new FakeWorkspaceRepository();
    workspace.setStagedFiles(['.gitignore']);
    const projectLock = new FakeProjectLock();
    const commitMessageFile = new FakeCommitMessageFile();
    commitMessageFile.setContent(MESSAGE_FILE, 'Update gitignore');
    const deps = buildDeps({ workspace, projectLock, commitMessageFile });

    const result = await verifyCommit(deps, ROOT, MESSAGE_FILE);

    expect(result).toEqual({ kind: 'allowed' });
  });
});
