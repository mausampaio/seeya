/**
 * `core/workspace-commit-guard.ts` (V2-T34 item 1). Pure — no I/O. Every case the real hook can
 * reach: the permitted path (a plain commit) as well as every refusal, per AGENTS.md § "Teste o
 * caso permitido, não só o proibido."
 */
import { describe, expect, it } from 'vitest';
import { decideCommitGuard } from '@seeya-ai/engine/core/workspace-commit-guard.js';
import type { CommitGuardLockFact } from '@seeya-ai/engine/core/workspace-commit-guard.js';

const LOCK_FILE_NAME = '.seeya-lock';
const ACQUIRED_AT = new Date('2026-09-25T10:00:00.000Z');

function liveLock(overrides: Partial<CommitGuardLockFact> = {}): CommitGuardLockFact {
  return {
    sessionId: 'session-a',
    pid: 1234,
    procStart: '11111',
    isAlive: true,
    acquiredAt: ACQUIRED_AT,
    ...overrides,
  };
}

describe('decideCommitGuard — the permitted case', () => {
  it('allows a plain commit and appends both missing trailers', () => {
    const decision = decideCommitGuard({
      stagedFiles: ['auth-hardening/status/current.md'],
      rawMessage: 'Write the current status\n',
      currentSessionId: 'session-a',
      currentProcess: undefined,
      lock: null,
      lockFileName: LOCK_FILE_NAME,
    });
    expect(decision).toEqual({
      kind: 'allow',
      message:
        'Write the current status\n\nSeeya-Project-Id: auth-hardening\nSeeya-Session-Id: session-a\n',
    });
  });

  it('allows a hand-made commit with no session and a free lock, attributed to "unknown" (D-025)', () => {
    const decision = decideCommitGuard({
      stagedFiles: ['auth-hardening/AGENTS.md'],
      rawMessage: 'Edit AGENTS.md by hand',
      currentSessionId: undefined,
      currentProcess: undefined,
      lock: null,
      lockFileName: LOCK_FILE_NAME,
    });
    expect(decision.kind).toBe('allow');
    expect(decision.kind === 'allow' && decision.message).toContain('Seeya-Session-Id: unknown');
  });

  it('passes a hand-made commit even with a STALE lock present, as unknown', () => {
    const decision = decideCommitGuard({
      stagedFiles: ['auth-hardening/AGENTS.md'],
      rawMessage: 'Edit AGENTS.md',
      currentSessionId: undefined,
      currentProcess: undefined,
      lock: liveLock({ isAlive: false }),
      lockFileName: LOCK_FILE_NAME,
    });
    expect(decision.kind).toBe('allow');
  });

  it('passes the lock holder committing into their own locked project', () => {
    const decision = decideCommitGuard({
      stagedFiles: ['auth-hardening/status/current.md'],
      rawMessage: 'Update status',
      currentSessionId: 'session-a',
      currentProcess: undefined,
      lock: liveLock({ sessionId: 'session-a' }),
      lockFileName: LOCK_FILE_NAME,
    });
    expect(decision.kind).toBe('allow');
  });

  it('leaves a message with both correct trailers already present untouched', () => {
    const message =
      'Write status\n\nSeeya-Project-Id: auth-hardening\nSeeya-Session-Id: session-a\n';
    const decision = decideCommitGuard({
      stagedFiles: ['auth-hardening/status/current.md'],
      rawMessage: message,
      currentSessionId: 'session-a',
      currentProcess: undefined,
      lock: null,
      lockFileName: LOCK_FILE_NAME,
    });
    expect(decision).toEqual({ kind: 'allow', message });
  });

  it('appends only the trailer that is actually missing', () => {
    const decision = decideCommitGuard({
      stagedFiles: ['auth-hardening/status/current.md'],
      rawMessage: 'Write status\n\nSeeya-Project-Id: auth-hardening\n',
      currentSessionId: 'session-a',
      currentProcess: undefined,
      lock: null,
      lockFileName: LOCK_FILE_NAME,
    });
    expect(decision.kind).toBe('allow');
    const message = decision.kind === 'allow' ? decision.message : '';
    expect(message.match(/Seeya-Project-Id/g)).toHaveLength(1);
    expect(message).toContain('Seeya-Session-Id: session-a');
  });

  it('passes a commit that touches no project directory at all (only workspace-root files)', () => {
    const decision = decideCommitGuard({
      stagedFiles: ['.gitignore'],
      rawMessage: 'Update gitignore',
      currentSessionId: undefined,
      currentProcess: undefined,
      lock: null,
      lockFileName: LOCK_FILE_NAME,
    });
    expect(decision).toEqual({ kind: 'allow', message: 'Update gitignore' });
  });
});

describe('decideCommitGuard — refusals', () => {
  it('refuses a commit touching more than one project', () => {
    const decision = decideCommitGuard({
      stagedFiles: ['auth-hardening/AGENTS.md', 'billing-v2/AGENTS.md'],
      rawMessage: 'Touch two projects',
      currentSessionId: 'session-a',
      currentProcess: undefined,
      lock: null,
      lockFileName: LOCK_FILE_NAME,
    });
    expect(decision.kind).toBe('refuse');
    expect(decision.kind === 'refuse' && decision.reason).toContain('auth-hardening');
    expect(decision.kind === 'refuse' && decision.reason).toContain('billing-v2');
  });

  it('refuses a commit that stages the project lock file', () => {
    const decision = decideCommitGuard({
      stagedFiles: ['auth-hardening/.seeya-lock', 'auth-hardening/AGENTS.md'],
      rawMessage: 'Sneak the lock in',
      currentSessionId: 'session-a',
      currentProcess: undefined,
      lock: null,
      lockFileName: LOCK_FILE_NAME,
    });
    expect(decision.kind).toBe('refuse');
    expect(decision.kind === 'refuse' && decision.reason).toContain('.seeya-lock');
  });

  it('refuses a commit into a project locked by a DIFFERENT live session', () => {
    const decision = decideCommitGuard({
      stagedFiles: ['auth-hardening/AGENTS.md'],
      rawMessage: 'Sneaky edit',
      currentSessionId: 'session-b',
      currentProcess: undefined,
      lock: liveLock({ sessionId: 'session-a' }),
      lockFileName: LOCK_FILE_NAME,
    });
    expect(decision.kind).toBe('refuse');
    expect(decision.kind === 'refuse' && decision.reason).toContain('session-a');
  });

  it('refuses when the lock is held by an unidentified but live session, and this commit has none either', () => {
    const decision = decideCommitGuard({
      stagedFiles: ['auth-hardening/AGENTS.md'],
      rawMessage: 'Edit',
      currentSessionId: undefined,
      currentProcess: undefined,
      lock: liveLock({ sessionId: undefined }),
      lockFileName: LOCK_FILE_NAME,
    });
    expect(decision.kind).toBe('refuse');
    expect(decision.kind === 'refuse' && decision.reason).toContain('unidentified session');
  });

  it('refuses a message whose project trailer contradicts the actual project', () => {
    const decision = decideCommitGuard({
      stagedFiles: ['auth-hardening/AGENTS.md'],
      rawMessage: 'Edit\n\nSeeya-Project-Id: wrong-project\n',
      currentSessionId: 'session-a',
      currentProcess: undefined,
      lock: null,
      lockFileName: LOCK_FILE_NAME,
    });
    expect(decision.kind).toBe('refuse');
    expect(decision.kind === 'refuse' && decision.reason).toContain('wrong-project');
  });

  it('refuses a message whose session trailer contradicts the actual session', () => {
    const decision = decideCommitGuard({
      stagedFiles: ['auth-hardening/AGENTS.md'],
      rawMessage: 'Edit\n\nSeeya-Session-Id: someone-else\n',
      currentSessionId: 'session-a',
      currentProcess: undefined,
      lock: null,
      lockFileName: LOCK_FILE_NAME,
    });
    expect(decision.kind).toBe('refuse');
    expect(decision.kind === 'refuse' && decision.reason).toContain('someone-else');
  });
});

// V2-T34 hotfix (PO review, 2026-09-25): the maintainer found, on real use, that EVERY commit
// seeya itself makes while holding a project's own lock was refused by this guard — none of them
// ever run inside a Claude Code session whose CLAUDE_CODE_SESSION_ID equals the lock's own
// sessionId. These prove the same-process authorization that fixes it, and its own limits.
describe('decideCommitGuard — same-process authorization (V2-T34 hotfix)', () => {
  it('authorizes the exact process holding the lock, even with no session identity anywhere (remove/remove-repo from a plain terminal)', () => {
    const decision = decideCommitGuard({
      stagedFiles: ['auth-hardening/AGENTS.md'],
      rawMessage: 'Remove repository app-api from project auth-hardening',
      currentSessionId: undefined,
      currentProcess: { pid: 1234, procStart: '11111' },
      lock: liveLock({ sessionId: undefined, pid: 1234, procStart: '11111' }),
      lockFileName: LOCK_FILE_NAME,
    });
    expect(decision.kind).toBe('allow');
    expect(decision.kind === 'allow' && decision.message).toContain('Seeya-Session-Id: unknown');
  });

  it("authorizes the process holding the lock even when the lock's own sessionId is a fork/launched id nobody's environment could ever match", () => {
    const decision = decideCommitGuard({
      stagedFiles: ['auth-hardening/AGENTS.md'],
      rawMessage: 'Adopt session 11111111-1111-4111-8111-111111111111 into project auth-hardening',
      currentSessionId: undefined,
      currentProcess: { pid: 1234, procStart: '11111' },
      lock: liveLock({ sessionId: 'fork-session-uuid', pid: 1234, procStart: '11111' }),
      lockFileName: LOCK_FILE_NAME,
    });
    expect(decision.kind).toBe('allow');
  });

  it("trusts an already-written session trailer verbatim when authorized by same process, never recomputing it from the lock's own sessionId (item 2)", () => {
    // The exact production defect: open's own leftover-changes commit already carries
    // "Seeya-Session-Id: unknown" (D-025 — nobody present can say whose it was), but the lock it
    // was written under belongs to `launched-session-uuid` (a session that hasn't even started
    // yet). Before this fix, the guard recomputed the "expected" session id from the lock and
    // refused for "contradicting" a trailer seeya itself had just written correctly.
    const decision = decideCommitGuard({
      stagedFiles: ['auth-hardening/status/current.md'],
      rawMessage:
        'Commit changes left uncommitted before opening auth-hardening\n\n' +
        'Seeya-Project-Id: auth-hardening\nSeeya-Session-Id: unknown\n',
      currentSessionId: undefined,
      currentProcess: { pid: 1234, procStart: '11111' },
      lock: liveLock({ sessionId: 'launched-session-uuid', pid: 1234, procStart: '11111' }),
      lockFileName: LOCK_FILE_NAME,
    });
    expect(decision.kind).toBe('allow');
    expect(decision.kind === 'allow' && decision.message).toContain('Seeya-Session-Id: unknown');
    expect(decision.kind === 'allow' && decision.message).not.toContain('launched-session-uuid');
  });

  it('fills a MISSING session trailer with "unknown" when authorized by same process and there is no currentSessionId, never the lock\'s own sessionId', () => {
    const decision = decideCommitGuard({
      stagedFiles: ['auth-hardening/AGENTS.md'],
      rawMessage: 'Remove repository app-api from project auth-hardening',
      currentSessionId: undefined,
      currentProcess: { pid: 1234, procStart: '11111' },
      lock: liveLock({ sessionId: 'launched-session-uuid', pid: 1234, procStart: '11111' }),
      lockFileName: LOCK_FILE_NAME,
    });
    expect(decision.kind).toBe('allow');
    expect(decision.kind === 'allow' && decision.message).toContain('Seeya-Session-Id: unknown');
    expect(decision.kind === 'allow' && decision.message).not.toContain('launched-session-uuid');
  });

  it('still refuses a DIFFERENT process even with the right pid, when procStart differs (recycled-pid tie-break)', () => {
    const decision = decideCommitGuard({
      stagedFiles: ['auth-hardening/AGENTS.md'],
      rawMessage: 'Sneaky edit from a recycled pid',
      currentSessionId: undefined,
      currentProcess: { pid: 1234, procStart: '99999' },
      lock: liveLock({ sessionId: undefined, pid: 1234, procStart: '11111' }),
      lockFileName: LOCK_FILE_NAME,
    });
    expect(decision.kind).toBe('refuse');
  });

  it('still refuses a genuinely different process (different pid entirely)', () => {
    const decision = decideCommitGuard({
      stagedFiles: ['auth-hardening/AGENTS.md'],
      rawMessage: 'Sneaky edit',
      currentSessionId: undefined,
      currentProcess: { pid: 9999, procStart: '11111' },
      lock: liveLock({ sessionId: undefined, pid: 1234, procStart: '11111' }),
      lockFileName: LOCK_FILE_NAME,
    });
    expect(decision.kind).toBe('refuse');
  });
});
