/**
 * `core/project-lock.ts` (V2-T33, D-047 item 1). Pure decisions — no I/O.
 */
import { describe, expect, it } from 'vitest';
import {
  decideProjectLockAcquisition,
  decideProjectLockRelease,
  type ProjectLockInfo,
} from '@seeya-ai/engine/core/project-lock.js';

const LOCK: ProjectLockInfo = {
  sessionId: 'session-abc',
  pid: 4242,
  procStart: undefined,
  acquiredAt: new Date('2026-09-01T00:00:00.000Z'),
};

describe('decideProjectLockAcquisition', () => {
  it('acquires when nothing has been taken yet (null, D-025)', () => {
    expect(decideProjectLockAcquisition(null, false)).toStrictEqual({ kind: 'acquire' });
  });

  it('acquires when the recorded pid is no longer alive (stale — the previous holder crashed, or the machine restarted)', () => {
    expect(decideProjectLockAcquisition(LOCK, false)).toStrictEqual({ kind: 'acquire' });
  });

  it('refuses when the recorded pid is still alive, naming the whole holder (not just its pid)', () => {
    expect(decideProjectLockAcquisition(LOCK, true)).toStrictEqual({
      kind: 'refuse',
      heldBy: LOCK,
    });
  });

  it('a lock with no sessionId (taken outside a Claude Code session) still refuses when alive — absence of an id never weakens the refusal', () => {
    const anonymous: ProjectLockInfo = { ...LOCK, sessionId: undefined };
    expect(decideProjectLockAcquisition(anonymous, true)).toStrictEqual({
      kind: 'refuse',
      heldBy: anonymous,
    });
  });
});

describe('decideProjectLockRelease', () => {
  it('notHeld when nothing was ever taken (D-025: already free is not an error)', () => {
    expect(decideProjectLockRelease(null, 4242)).toStrictEqual({ kind: 'notHeld' });
  });

  it('released when the releasing pid matches the one that took it', () => {
    expect(decideProjectLockRelease(LOCK, 4242)).toStrictEqual({ kind: 'released' });
  });

  it('refuses when a DIFFERENT pid asks to release it — "liberar lock que não é seu recusa" (D-047 item 1)', () => {
    expect(decideProjectLockRelease(LOCK, 9999)).toStrictEqual({
      kind: 'refuse',
      heldBy: LOCK,
    });
  });
});
