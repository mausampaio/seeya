/**
 * `core/project-audit.ts` (V2-T34 item 3). Pure — no I/O.
 */
import { describe, expect, it } from 'vitest';
import { auditCommits } from '@seeya-ai/engine/core/project-audit.js';
import type { AuditableCommit } from '@seeya-ai/engine/core/project-audit.js';

const LOCK_FILE_NAME = '.seeya-lock';

function commit(overrides: Partial<AuditableCommit> = {}): AuditableCommit {
  return {
    hash: 'abc123',
    message: 'Update\n\nSeeya-Project-Id: auth-hardening\nSeeya-Session-Id: session-a\n',
    files: ['auth-hardening/status/current.md'],
    ...overrides,
  };
}

describe('auditCommits — a well-formed commit', () => {
  it('is not reported as escaped', () => {
    expect(auditCommits('auth-hardening', LOCK_FILE_NAME, [commit()])).toEqual([]);
  });
});

describe('auditCommits — each escape reason', () => {
  it('flags a commit with no Seeya-Project-Id trailer at all', () => {
    const c = commit({ message: 'Old-style commit, no trailers' });
    const [result] = auditCommits('auth-hardening', LOCK_FILE_NAME, [c]);
    expect(result?.reasons).toContainEqual({ kind: 'missingOrWrongProjectTrailer', found: null });
    expect(result?.reasons).toContainEqual({ kind: 'missingSessionTrailer' });
  });

  it('flags a commit whose Seeya-Project-Id names a DIFFERENT project', () => {
    const c = commit({ message: 'Edit\n\nSeeya-Project-Id: other\nSeeya-Session-Id: s\n' });
    const [result] = auditCommits('auth-hardening', LOCK_FILE_NAME, [c]);
    expect(result?.reasons).toContainEqual({
      kind: 'missingOrWrongProjectTrailer',
      found: 'other',
    });
  });

  it('flags a commit that also touched another project directory', () => {
    const c = commit({ files: ['auth-hardening/status/current.md', 'billing-v2/AGENTS.md'] });
    const [result] = auditCommits('auth-hardening', LOCK_FILE_NAME, [c]);
    expect(result?.reasons).toContainEqual({
      kind: 'touchesOtherProjects',
      otherProjects: ['billing-v2'],
    });
  });

  it('flags a commit that includes the project lock file', () => {
    const c = commit({ files: ['auth-hardening/status/current.md', 'auth-hardening/.seeya-lock'] });
    const [result] = auditCommits('auth-hardening', LOCK_FILE_NAME, [c]);
    expect(result?.reasons).toContainEqual({ kind: 'includesLockFile' });
  });

  it('a commit can carry more than one reason at once', () => {
    const c = commit({ message: 'No trailers', files: ['auth-hardening/x', 'billing-v2/y'] });
    const [result] = auditCommits('auth-hardening', LOCK_FILE_NAME, [c]);
    expect(result?.reasons.length).toBeGreaterThan(1);
  });
});

describe('auditCommits — the collection', () => {
  it('only reports commits with at least one reason, in order', () => {
    const good = commit({ hash: 'good' });
    const bad = commit({ hash: 'bad', message: 'no trailers' });
    const result = auditCommits('auth-hardening', LOCK_FILE_NAME, [good, bad]);
    expect(result).toHaveLength(1);
    expect(result[0]?.hash).toBe('bad');
  });

  it('an empty commit list reports nothing escaped', () => {
    expect(auditCommits('auth-hardening', LOCK_FILE_NAME, [])).toEqual([]);
  });
});
