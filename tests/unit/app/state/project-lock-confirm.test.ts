import { describe, expect, it } from 'vitest';
import { formatLockHolderLine } from '../../../../packages/app/src/state/project-lock-confirm.js';

describe('formatLockHolderLine (V2-T71)', () => {
  it('names the session and pid when the holder is known', () => {
    const line = formatLockHolderLine({
      heldBySessionId: 'abc123',
      heldByPid: 456,
      heldByAcquiredAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(line).toContain('Session abc123 (pid 456) has held this lock since');
  });

  it('never invents an identity for an unidentified holder (D-025)', () => {
    const line = formatLockHolderLine({
      heldBySessionId: null,
      heldByPid: 789,
      heldByAcquiredAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(line).toContain('An unidentified session (pid 789) has held this lock since');
  });
});
