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
      lock: null,
      lockFileName: LOCK_FILE_NAME,
    });
    expect(decision.kind).toBe('refuse');
    expect(decision.kind === 'refuse' && decision.reason).toContain('someone-else');
  });
});
