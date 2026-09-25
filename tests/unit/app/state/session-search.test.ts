import { describe, expect, it } from 'vitest';
import { buildSessionSearchRows } from '../../../../packages/app/src/state/session-search.js';
import { createSessionWithoutPid, createSessionWithPid } from '../../core/_fixtures.js';

const NOW = new Date('2026-09-25T12:00:00.000Z');

describe('buildSessionSearchRows (V2-T55 item 4)', () => {
  it('classifies a no-pid session as unknown, with the V2-T52 label', () => {
    const session = createSessionWithoutPid({
      sessionId: '11111111-1111-4111-8111-111111111111',
    });

    const rows = buildSessionSearchRows([session], NOW, 30, []);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.state).toBe('unknown');
    expect(rows[0]?.stateLabel).toBe('no running process');
    expect(rows[0]?.displaySessionId).toBe('11111111');
  });

  it('classifies a live session as alive', () => {
    // No transcript-write evidence at all: idle is a claim requiring a real timestamp (D-025), so
    // absence of one, not just a distant one, is what proves "alive" here.
    const session = createSessionWithPid({
      pid: 4242,
      processIsAlive: true,
      lastTranscriptWrite: null,
    });

    const rows = buildSessionSearchRows([session], NOW, 999, []);

    expect(rows[0]?.state).toBe('alive');
    expect(rows[0]?.stateLabel).toBe('alive');
  });

  it('a running session is not adoptable, with a reason', () => {
    const session = createSessionWithPid({ pid: 4242, processIsAlive: true });

    const rows = buildSessionSearchRows([session], NOW, 999, []);

    expect(rows[0]?.adopt.kind).toBe('unavailable');
  });

  it('a non-running, not-yet-adopted session is adoptable', () => {
    const session = createSessionWithPid({ pid: 4242, processIsAlive: false });

    const rows = buildSessionSearchRows([session], NOW, 30, []);

    expect(rows[0]?.adopt).toEqual({ kind: 'available' });
  });

  it('short ids stay unique within just this batch, escalating on collision', () => {
    const a = createSessionWithoutPid({ sessionId: '11111111-1111-4111-8111-111111111111' });
    const b = createSessionWithoutPid({ sessionId: '11111111-2222-4222-8222-222222222222' });

    const rows = buildSessionSearchRows([a, b], NOW, 30, []);

    expect(rows[0]?.displaySessionId).not.toBe(rows[1]?.displaySessionId);
  });

  it('an empty candidate list produces an empty row list', () => {
    expect(buildSessionSearchRows([], NOW, 30, [])).toEqual([]);
  });
});
