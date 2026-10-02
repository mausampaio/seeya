import { describe, expect, it } from 'vitest';
import {
  formatLockHolderLine,
  shortLockHolderSessionId,
} from '../../../../packages/app/src/state/project-lock-confirm.js';

describe('shortLockHolderSessionId (V2-T71, PO review round 1)', () => {
  it('shortens a real UUID the same way the Projects tab lock column already does', () => {
    expect(shortLockHolderSessionId('33333333-3333-4333-8333-333333333333')).toBe('33333333');
  });

  it('a batch of one never collides with itself — a short, non-UUID id passes through unchanged', () => {
    expect(shortLockHolderSessionId('abc123')).toBe('abc123');
  });
});

describe('formatLockHolderLine (V2-T71)', () => {
  it('names the session (shortened) and pid when the holder is known', () => {
    const line = formatLockHolderLine({
      heldBySessionId: '33333333-3333-4333-8333-333333333333',
      heldByPid: 456,
      heldByAcquiredAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(line).toContain('Session 33333333 (pid 456) has held this lock since');
    expect(line).not.toContain('33333333-3333-4333-8333-333333333333');
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
