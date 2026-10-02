/**
 * `core/project-session-membership.ts` (V2-T77) — the single membership rule shared by the
 * sidebar grouping and `open --resume`'s refusal.
 */
import { describe, expect, it } from 'vitest';
import {
  decideProjectResume,
  sessionBelongsToProject,
} from '@seeya-ai/engine/core/project-session-membership.js';

const EVIDENCE = {
  projectDir: '/ws/auth-hardening',
  forkSessionIds: new Set(['fork-1']),
  lockSessionId: 'holder-1' as string | undefined,
};

describe('sessionBelongsToProject', () => {
  it('matches the project directory despite a trailing separator', () => {
    expect(
      sessionBelongsToProject({ sessionId: 'a', cwd: '/ws/auth-hardening/' }, EVIDENCE, 'posix'),
    ).toBe(true);
  });

  it('matches a registered adoption fork, wherever it ran', () => {
    expect(sessionBelongsToProject({ sessionId: 'fork-1', cwd: '/x' }, EVIDENCE, 'posix')).toBe(
      true,
    );
  });

  it('matches the lock holder, but an unidentified holder matches nothing', () => {
    expect(sessionBelongsToProject({ sessionId: 'holder-1', cwd: '/x' }, EVIDENCE, 'posix')).toBe(
      true,
    );
    expect(
      sessionBelongsToProject(
        { sessionId: 'undefined', cwd: '/x' },
        { ...EVIDENCE, lockSessionId: undefined },
        'posix',
      ),
    ).toBe(false);
  });

  it('does not match a session with no evidence', () => {
    expect(sessionBelongsToProject({ sessionId: 'z', cwd: '/other' }, EVIDENCE, 'posix')).toBe(
      false,
    );
  });
});

describe('decideProjectResume', () => {
  const member = { sessionId: 'a', cwd: '/ws/auth-hardening' };

  it.each(['alive', 'idle'] as const)('refuses a %s session, even a member', (state) => {
    expect(decideProjectResume(member, state, EVIDENCE, 'posix')).toEqual({
      kind: 'sessionRunning',
      state,
    });
  });

  it.each(['ended', 'unknown'] as const)('accepts an %s member', (state) => {
    expect(decideProjectResume(member, state, EVIDENCE, 'posix')).toEqual({ kind: 'eligible' });
  });

  it('refuses a non-member that is not running', () => {
    expect(
      decideProjectResume({ sessionId: 'z', cwd: '/other' }, 'ended', EVIDENCE, 'posix'),
    ).toEqual({ kind: 'notInProject' });
  });
});
