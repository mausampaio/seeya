import { describe, expect, it } from 'vitest';
import { buildTodayPanelData } from '../../../../packages/app/src/state/today-panel.js';
import type { PendingBriefingLookup } from '@seeya-ai/engine/application/find-pending-briefing.js';
import { buildHandoffFixture as modelHandoff } from '../_handoff-fixture.js';

describe('buildTodayPanelData', () => {
  it('returns "noBriefing" with the days-searched count when nothing was found', () => {
    const lookup: PendingBriefingLookup = { found: false, daysSearched: 30 };

    const data = buildTodayPanelData(lookup);

    expect(data.kind).toBe('noBriefing');
    expect(data.kind === 'noBriefing' && data.message.includes('30 days')).toBe(true);
  });

  it('returns "pending" with one row per handoff, day and daysAgo carried through', () => {
    const handoff = modelHandoff({ tomorrowPlan: ['ship it'] });
    const lookup: PendingBriefingLookup = {
      found: true,
      daysAgo: 1,
      resumedSessionIds: new Set(),
      briefing: { day: '2026-08-16', handoffs: [handoff], rejected: [] },
    };

    const data = buildTodayPanelData(lookup);

    expect(data).toEqual({
      kind: 'pending',
      day: '2026-08-16',
      daysAgo: 1,
      rows: [
        {
          sessionId: 'session-1',
          name: 'alpha',
          cwd: '/projects/alpha',
          firstPlanLine: 'ship it',
          alreadyResumed: false,
        },
      ],
    });
  });

  it('a session already resumed today is marked, not silently dropped', () => {
    const handoff = modelHandoff({ tomorrowPlan: ['ship it'] });
    const lookup: PendingBriefingLookup = {
      found: true,
      daysAgo: 0,
      resumedSessionIds: new Set(['session-1']),
      briefing: { day: '2026-08-17', handoffs: [handoff], rejected: [] },
    };

    const data = buildTodayPanelData(lookup);

    expect(data.kind).toBe('pending');
    expect(data.kind === 'pending' && data.rows[0]?.alreadyResumed).toBe(true);
  });

  it('firstPlanLine prefers tomorrowPlan[0] over pendingItems[0]', () => {
    const handoff = modelHandoff({ tomorrowPlan: ['ship it'], pendingItems: ['finish refactor'] });
    const lookup: PendingBriefingLookup = {
      found: true,
      daysAgo: 1,
      resumedSessionIds: new Set(),
      briefing: { day: '2026-08-16', handoffs: [handoff], rejected: [] },
    };

    const data = buildTodayPanelData(lookup);

    expect(data.kind === 'pending' && data.rows[0]?.firstPlanLine).toBe('ship it');
  });

  it('firstPlanLine falls back to pendingItems[0] when tomorrowPlan is empty', () => {
    const handoff = modelHandoff({ tomorrowPlan: [], pendingItems: ['finish refactor'] });
    const lookup: PendingBriefingLookup = {
      found: true,
      daysAgo: 1,
      resumedSessionIds: new Set(),
      briefing: { day: '2026-08-16', handoffs: [handoff], rejected: [] },
    };

    const data = buildTodayPanelData(lookup);

    expect(data.kind === 'pending' && data.rows[0]?.firstPlanLine).toBe('finish refactor');
  });

  it('firstPlanLine is null (never a fabricated placeholder) when a model handoff reported nothing', () => {
    const handoff = modelHandoff({ tomorrowPlan: [], pendingItems: [] });
    const lookup: PendingBriefingLookup = {
      found: true,
      daysAgo: 1,
      resumedSessionIds: new Set(),
      briefing: { day: '2026-08-16', handoffs: [handoff], rejected: [] },
    };

    const data = buildTodayPanelData(lookup);

    expect(data.kind === 'pending' && data.rows[0]?.firstPlanLine).toBeNull();
  });

  it('firstPlanLine is null for a non-model handoff — no plan was ever generated (D-025)', () => {
    const handoff = modelHandoff({
      source: 'deterministic',
      tomorrowPlan: [],
      pendingItems: [],
    });
    const lookup: PendingBriefingLookup = {
      found: true,
      daysAgo: 1,
      resumedSessionIds: new Set(),
      briefing: { day: '2026-08-16', handoffs: [handoff], rejected: [] },
    };

    const data = buildTodayPanelData(lookup);

    expect(data.kind === 'pending' && data.rows[0]?.firstPlanLine).toBeNull();
  });
});
