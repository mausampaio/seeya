import { describe, expect, it } from 'vitest';
import {
  buildTodayPanelData,
  offersResumeCheckbox,
  refreshTodayPanelLiveness,
} from '../../../../packages/app/src/state/today-panel.js';
import type { PendingBriefingLookup } from '@seeya-ai/engine/application/find-pending-briefing.js';
import type { CwdHistoryEntry } from '@seeya-ai/engine/application/cwd-history.js';
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
          resumeStatus: { kind: 'neverResumed' },
          cwdHistory: [],
        },
      ],
    });
  });

  it('cwdHistory is empty (never an error) when the caller omits the map entirely', () => {
    const handoff = modelHandoff();
    const lookup: PendingBriefingLookup = {
      found: true,
      daysAgo: 1,
      resumedSessionIds: new Set(),
      briefing: { day: '2026-08-16', handoffs: [handoff], rejected: [] },
    };

    const data = buildTodayPanelData(lookup);

    expect(data.kind === 'pending' && data.rows[0]?.cwdHistory).toEqual([]);
  });

  it('carries the precomputed cwd history through for the matching sessionId, untouched', () => {
    const handoff = modelHandoff();
    const history: readonly CwdHistoryEntry[] = [
      { cwd: 'C:\\code', firstDay: '2026-08-14', lastDay: '2026-08-14', exists: false },
      { cwd: 'C:\\code\\seeya', firstDay: '2026-08-16', lastDay: '2026-08-16', exists: true },
    ];
    const lookup: PendingBriefingLookup = {
      found: true,
      daysAgo: 0,
      resumedSessionIds: new Set(),
      briefing: { day: '2026-08-16', handoffs: [handoff], rejected: [] },
    };

    const data = buildTodayPanelData(lookup, new Map([[handoff.sessionId, history]]));

    expect(data.kind === 'pending' && data.rows[0]?.cwdHistory).toEqual(history);
  });

  it('a sessionId with no entry in the map falls back to an empty history, never a guess (D-025)', () => {
    const handoff = modelHandoff();
    const lookup: PendingBriefingLookup = {
      found: true,
      daysAgo: 0,
      resumedSessionIds: new Set(),
      briefing: { day: '2026-08-16', handoffs: [handoff], rejected: [] },
    };

    const data = buildTodayPanelData(lookup, new Map([['some-other-session', []]]));

    expect(data.kind === 'pending' && data.rows[0]?.cwdHistory).toEqual([]);
  });

  it('a session resumed today but not running now is marked "resumedEarlier", not silently dropped', () => {
    const handoff = modelHandoff({ tomorrowPlan: ['ship it'] });
    const lookup: PendingBriefingLookup = {
      found: true,
      daysAgo: 0,
      resumedSessionIds: new Set(['session-1']),
      briefing: { day: '2026-08-17', handoffs: [handoff], rejected: [] },
    };

    const data = buildTodayPanelData(lookup);

    expect(data.kind).toBe('pending');
    expect(data.kind === 'pending' && data.rows[0]?.resumeStatus).toEqual({
      kind: 'resumedEarlier',
    });
  });

  it('a session never resumed is "neverResumed" by default', () => {
    const handoff = modelHandoff();
    const lookup: PendingBriefingLookup = {
      found: true,
      daysAgo: 0,
      resumedSessionIds: new Set(),
      briefing: { day: '2026-08-17', handoffs: [handoff], rejected: [] },
    };

    const data = buildTodayPanelData(lookup);

    expect(data.kind === 'pending' && data.rows[0]?.resumeStatus).toEqual({
      kind: 'neverResumed',
    });
  });

  describe('V2-T9 item 4 — liveness wins over resumed.json', () => {
    it('a session running now blocks the checkbox — "runningNow", with the matching tab id', () => {
      const handoff = modelHandoff();
      const lookup: PendingBriefingLookup = {
        found: true,
        daysAgo: 0,
        resumedSessionIds: new Set(),
        briefing: { day: '2026-08-17', handoffs: [handoff], rejected: [] },
      };

      const data = buildTodayPanelData(
        lookup,
        new Map(),
        new Map([[handoff.sessionId, { matchedTabId: 'tab-1' }]]),
      );

      expect(data.kind === 'pending' && data.rows[0]?.resumeStatus).toEqual({
        kind: 'runningNow',
        matchedTabId: 'tab-1',
      });
    });

    it('running now with no matching tab (resumed by hand in a bare terminal) still blocks the checkbox', () => {
      const handoff = modelHandoff();
      const lookup: PendingBriefingLookup = {
        found: true,
        daysAgo: 0,
        resumedSessionIds: new Set(),
        briefing: { day: '2026-08-17', handoffs: [handoff], rejected: [] },
      };

      const data = buildTodayPanelData(
        lookup,
        new Map(),
        new Map([[handoff.sessionId, { matchedTabId: null }]]),
      );

      expect(data.kind === 'pending' && data.rows[0]?.resumeStatus).toEqual({
        kind: 'runningNow',
        matchedTabId: null,
      });
    });

    it('resumed earlier but no longer running wins the checkbox BACK — the achado this item fixes', () => {
      const handoff = modelHandoff();
      const lookup: PendingBriefingLookup = {
        found: true,
        daysAgo: 0,
        resumedSessionIds: new Set([handoff.sessionId]),
        briefing: { day: '2026-08-17', handoffs: [handoff], rejected: [] },
      };

      // Not in the live index at all — the session isn't running any more (app restarted, tab
      // closed by hand). resumed.json alone would still say "already resumed"; liveness overrules it.
      const data = buildTodayPanelData(lookup, new Map(), new Map());

      expect(data.kind === 'pending' && data.rows[0]?.resumeStatus).toEqual({
        kind: 'resumedEarlier',
      });
    });

    it('running now AND already in resumed.json still reports runningNow, never both', () => {
      const handoff = modelHandoff();
      const lookup: PendingBriefingLookup = {
        found: true,
        daysAgo: 0,
        resumedSessionIds: new Set([handoff.sessionId]),
        briefing: { day: '2026-08-17', handoffs: [handoff], rejected: [] },
      };

      const data = buildTodayPanelData(
        lookup,
        new Map(),
        new Map([[handoff.sessionId, { matchedTabId: 'tab-2' }]]),
      );

      expect(data.kind === 'pending' && data.rows[0]?.resumeStatus.kind).toBe('runningNow');
    });
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

describe('offersResumeCheckbox — V2-T18 defect 1: the checkbox comes back for resumedEarlier', () => {
  it('resumedEarlier offers the checkbox — the achado this task exists to fix', () => {
    expect(offersResumeCheckbox({ kind: 'resumedEarlier' })).toBe(true);
  });

  it('neverResumed offers the checkbox, as it always did', () => {
    expect(offersResumeCheckbox({ kind: 'neverResumed' })).toBe(true);
  });

  it('runningNow is the ONLY status that blocks the checkbox', () => {
    expect(offersResumeCheckbox({ kind: 'runningNow', matchedTabId: null })).toBe(false);
    expect(offersResumeCheckbox({ kind: 'runningNow', matchedTabId: 'tab-1' })).toBe(false);
  });
});

describe('refreshTodayPanelLiveness — V2-T18 defect 2: the panel tracks the ambient cycle', () => {
  it('returns null with no cached inputs — nothing built yet, never a fabricated panel (D-025)', () => {
    expect(refreshTodayPanelLiveness(null, new Map())).toBeNull();
  });

  it('a session that goes live on a LATER tick recomputes as runningNow, without a fresh lookup', () => {
    const handoff = modelHandoff();
    const lookup: PendingBriefingLookup = {
      found: true,
      daysAgo: 0,
      resumedSessionIds: new Set(),
      briefing: { day: '2026-08-17', handoffs: [handoff], rejected: [] },
    };
    const inputs = { lookup, cwdHistoryBySessionId: new Map() };

    // First tick: the session isn't running yet — same "found nothing live" shape getTodayPanel
    // itself would have produced on this same lookup.
    const beforeOpen = refreshTodayPanelLiveness(inputs, new Map());
    expect(beforeOpen?.kind === 'pending' && beforeOpen.rows[0]?.resumeStatus).toEqual({
      kind: 'neverResumed',
    });

    // A LATER tick: the person opened the session from a bare terminal — the exact scenario the
    // window is supposed to reflect "sem reabrir o app" (the mantenedor's own aceite wording).
    // `inputs` (the lookup/cwd-history) is untouched; only `liveSessionIds` is fresh.
    const afterOpen = refreshTodayPanelLiveness(
      inputs,
      new Map([[handoff.sessionId, { matchedTabId: null }]]),
    );
    expect(afterOpen?.kind === 'pending' && afterOpen.rows[0]?.resumeStatus).toEqual({
      kind: 'runningNow',
      matchedTabId: null,
    });
  });

  it('a "noBriefing" lookup recomputes the same message, never crashing on empty history', () => {
    const lookup: PendingBriefingLookup = { found: false, daysSearched: 30 };
    const inputs = { lookup, cwdHistoryBySessionId: new Map() };

    const data = refreshTodayPanelLiveness(inputs, new Map());

    expect(data?.kind).toBe('noBriefing');
  });
});
