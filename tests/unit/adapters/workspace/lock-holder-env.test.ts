/**
 * `adapters/workspace/lock-holder-env.ts` (V2-T34 hotfix, PO review 2026-09-25). Pure string/env
 * shaping — the real end-to-end proof (a real `git commit` authorized through this exact
 * mechanism) is `tests/integration/workspace/commit-msg-hook.test.ts`'s own "same-process
 * lock-holder authorization" suite.
 */
import { describe, expect, it } from 'vitest';
import {
  LOCK_HOLDER_PID_ENV_VAR,
  LOCK_HOLDER_PROC_START_ENV_VAR,
  buildLockHolderEnv,
  readLockHolderProcess,
} from '@seeya-ai/engine/adapters/workspace/lock-holder-env.js';

describe('buildLockHolderEnv', () => {
  it('returns both variables when procStart is present', () => {
    expect(buildLockHolderEnv({ pid: 4242, procStart: '12345' })).toEqual({
      [LOCK_HOLDER_PID_ENV_VAR]: '4242',
      [LOCK_HOLDER_PROC_START_ENV_VAR]: '12345',
    });
  });

  it('omits SEEYA_LOCK_HOLDER_PROC_START entirely when procStart is undefined (never a literal "undefined" string)', () => {
    const env = buildLockHolderEnv({ pid: 4242, procStart: undefined });
    expect(env).toEqual({ [LOCK_HOLDER_PID_ENV_VAR]: '4242' });
    expect(LOCK_HOLDER_PROC_START_ENV_VAR in env).toBe(false);
  });

  it('returns an empty object for an ordinary commit not made while holding a lock', () => {
    expect(buildLockHolderEnv(undefined)).toEqual({});
  });
});

describe('readLockHolderProcess', () => {
  it('reads both fields back when both are present', () => {
    expect(
      readLockHolderProcess({
        [LOCK_HOLDER_PID_ENV_VAR]: '4242',
        [LOCK_HOLDER_PROC_START_ENV_VAR]: '12345',
      }),
    ).toEqual({ pid: 4242, procStart: '12345' });
  });

  it('reads procStart as undefined when only the pid is present', () => {
    expect(readLockHolderProcess({ [LOCK_HOLDER_PID_ENV_VAR]: '4242' })).toEqual({
      pid: 4242,
      procStart: undefined,
    });
  });

  it('returns undefined when SEEYA_LOCK_HOLDER_PID is missing entirely', () => {
    expect(readLockHolderProcess({})).toBeUndefined();
    expect(readLockHolderProcess({ [LOCK_HOLDER_PROC_START_ENV_VAR]: '12345' })).toBeUndefined();
  });

  it('returns undefined for a pid that does not parse as a positive integer (D-025: never a guessed identity)', () => {
    expect(readLockHolderProcess({ [LOCK_HOLDER_PID_ENV_VAR]: 'not-a-number' })).toBeUndefined();
    expect(readLockHolderProcess({ [LOCK_HOLDER_PID_ENV_VAR]: '0' })).toBeUndefined();
    expect(readLockHolderProcess({ [LOCK_HOLDER_PID_ENV_VAR]: '-4242' })).toBeUndefined();
  });

  it('round-trips through buildLockHolderEnv', () => {
    const lockHolder = { pid: 555, procStart: 'p-1' };
    expect(readLockHolderProcess(buildLockHolderEnv(lockHolder))).toEqual(lockHolder);
  });
});
