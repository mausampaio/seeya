import { describe, expect, it } from 'vitest';
import { buildSessionSummaryBadges } from '../../../../../../packages/app/src/renderer/features/end-day/session-badges.js';
import type { EndDaySessionSummaryRow } from '../../../../../../packages/app/src/state/end-day-sessions.js';

function row(overrides: Partial<EndDaySessionSummaryRow> = {}): EndDaySessionSummaryRow {
  return {
    sessionId: 's1',
    name: 'alpha',
    cwd: '~/alpha',
    state: 'ended',
    mode: 'lean',
    ...overrides,
  };
}

describe('buildSessionSummaryBadges (V2-T69, PO review round 1 item 7)', () => {
  it("capitalizes the state label, matching the mode badge's own convention", () => {
    const [stateBadge] = buildSessionSummaryBadges(row({ state: 'ended' }));
    expect(stateBadge).toEqual({ label: 'Ended', tone: 'neutral' });
  });

  it('capitalizes every known state label (alive/idle/ended/unknown)', () => {
    expect(buildSessionSummaryBadges(row({ state: 'alive' }))[0]?.label).toBe('Alive');
    expect(buildSessionSummaryBadges(row({ state: 'idle' }))[0]?.label).toBe('Idle');
    expect(buildSessionSummaryBadges(row({ state: 'unknown' }))[0]?.label).toBe(
      'No running process',
    );
  });

  it('shows the mode badge as Lean/Deep, never the raw lowercase value', () => {
    expect(buildSessionSummaryBadges(row({ mode: 'lean' }))[1]).toEqual({
      label: 'Lean',
      tone: 'neutral',
    });
    expect(buildSessionSummaryBadges(row({ mode: 'deep' }))[1]).toEqual({
      label: 'Deep',
      tone: 'neutral',
    });
  });

  it('the state badge tone still follows resolveSessionStateTone (alive -> success)', () => {
    expect(buildSessionSummaryBadges(row({ state: 'alive' }))[0]?.tone).toBe('success');
  });
});
