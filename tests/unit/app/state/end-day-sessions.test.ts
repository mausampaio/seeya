import { describe, expect, it } from 'vitest';
import {
  buildEndDayPreviewRows,
  buildEndDayResultRows,
} from '../../../../packages/app/src/state/end-day-sessions.js';
import { buildHandoffFixture } from '../_handoff-fixture.js';
import type {
  CapturedSession,
  EndDayResult,
  IneligibleSession,
} from '@seeya-ai/engine/application/types.js';
import type { SessionListing } from '@seeya-ai/engine/core/types.js';

const HOME_DIR = '/home/x';

function captured(overrides: Partial<CapturedSession> = {}): CapturedSession {
  return { handoff: buildHandoffFixture(), terminated: false, ...overrides };
}

function ineligible(overrides: Partial<IneligibleSession> = {}): IneligibleSession {
  return {
    sessionId: 'session-2',
    cwd: '/home/x/ignored',
    name: 'ignored',
    reasons: ['ignoredCwd'],
    ...overrides,
  };
}

function listing(overrides: Partial<SessionListing> = {}): SessionListing {
  return {
    sessionId: 'session-3',
    cwd: '/home/x/closed',
    name: 'closed-one',
    info: { kind: 'read', aiTitle: null, lastPrompt: null },
    ...overrides,
  };
}

function buildResult(overrides: Partial<EndDayResult> = {}): EndDayResult {
  return {
    day: '2026-09-30',
    scope: { kind: 'fullDay' },
    discoveredCount: 0,
    rejectedDiscoveries: [],
    ineligible: [],
    captured: [],
    failedCaptures: [],
    terminationNotices: [],
    dryRun: true,
    briefingPreview: null,
    sessionsInScope: 0,
    listedSessions: [],
    forkCleanup: null,
    forkCleanupError: null,
    ...overrides,
  };
}

describe('buildEndDayPreviewRows (V2-T69)', () => {
  it('maps result.captured to willBeCaptured rows with the directory already formatted', () => {
    const result = buildResult({
      captured: [captured({ handoff: buildHandoffFixture({ cwd: '/home/x/alpha' }) })],
    });

    const { willBeCaptured } = buildEndDayPreviewRows(result, HOME_DIR, 'posix');

    expect(willBeCaptured).toEqual([
      { sessionId: 'session-1', name: 'alpha', cwd: '~/alpha', state: 'ended', mode: 'lean' },
    ]);
  });

  it('maps result.ineligible to notCaptured rows kind "ineligible" with a readable reason', () => {
    const result = buildResult({ ineligible: [ineligible()] });

    const { notCaptured } = buildEndDayPreviewRows(result, HOME_DIR, 'posix');

    expect(notCaptured).toEqual([
      {
        sessionId: 'session-2',
        name: 'ignored',
        cwd: '~/ignored',
        kind: 'ineligible',
        reason: 'This directory is in the ignore list.',
        fullReason: 'This directory is in the ignore list.',
      },
    ]);
  });

  it('maps result.listedSessions to notCaptured rows kind "closed"', () => {
    const result = buildResult({ listedSessions: [listing()] });

    const { notCaptured } = buildEndDayPreviewRows(result, HOME_DIR, 'posix');

    expect(notCaptured).toHaveLength(1);
    expect(notCaptured[0]?.kind).toBe('closed');
    // PO review round 1 (V2-T69, item 6): user-facing text never cites a decision id — the person
    // reading this dialog has no `docs/DECISOES.md` to look `D-031` up in.
    expect(notCaptured[0]?.reason).toBe('Session closed — no running process was found.');
    expect(notCaptured[0]?.reason).not.toMatch(/D-0\d+/);
  });

  it('maps result.failedCaptures to notCaptured rows kind "failed" with the raw error', () => {
    const result = buildResult({
      failedCaptures: [
        { sessionId: 'session-4', name: 'broken', cwd: '/home/x/broken', reason: 'ENOENT' },
      ],
    });

    const { notCaptured } = buildEndDayPreviewRows(result, HOME_DIR, 'posix');

    expect(notCaptured).toEqual([
      {
        sessionId: 'session-4',
        name: 'broken',
        cwd: '~/broken',
        kind: 'failed',
        reason: 'ENOENT',
        fullReason: 'ENOENT',
      },
    ]);
  });

  // PO review round 1 (V2-T69, item 5): a long message with a home-rooted path gets a short,
  // `~`-abbreviated `reason` for display, while `fullReason` keeps the complete original text for
  // a tooltip — this is the exact shape End day's own failure rows need it for.
  it('abbreviates a home-rooted path inside a long failedCaptures reason, keeping the full text', () => {
    const longPath = `${HOME_DIR}/.seeya/days/2026-09-30/sessions/session-9.json`;
    const rawReason = `${longPath} is not valid JSON: Unexpected token o in JSON at position 1 while parsing near the start of the document body`;
    const result = buildResult({
      failedCaptures: [
        { sessionId: 'session-9', name: 'poisoned', cwd: longPath, reason: rawReason },
      ],
    });

    const { notCaptured } = buildEndDayPreviewRows(result, HOME_DIR, 'posix');

    expect(notCaptured).toHaveLength(1);
    const row = notCaptured[0];
    expect(row?.reason).not.toBe(rawReason);
    expect(row?.reason).toMatch(/^~\/\.seeya\/days\//);
    expect(row?.reason.length).toBeLessThan(rawReason.length);
    expect(row?.fullReason).toBe(rawReason);
  });

  it('a day with nothing in any bucket produces two empty lists, never undefined', () => {
    const { willBeCaptured, notCaptured } = buildEndDayPreviewRows(
      buildResult(),
      HOME_DIR,
      'posix',
    );
    expect(willBeCaptured).toEqual([]);
    expect(notCaptured).toEqual([]);
  });
});

describe('buildEndDayResultRows (V2-T69)', () => {
  it('maps result.captured to captured rows, same shape as the preview', () => {
    const result = buildResult({
      captured: [captured({ handoff: buildHandoffFixture({ cwd: '/home/x/alpha' }) })],
      dryRun: false,
    });
    const { captured: rows } = buildEndDayResultRows(result, HOME_DIR, 'posix');
    expect(rows).toEqual([
      { sessionId: 'session-1', name: 'alpha', cwd: '~/alpha', state: 'ended', mode: 'lean' },
    ]);
  });

  it('maps result.failedCaptures to failed rows with the reason, no kind tag', () => {
    const result = buildResult({
      failedCaptures: [
        { sessionId: 'session-4', name: 'broken', cwd: '/home/x/broken', reason: 'ENOENT' },
      ],
      dryRun: false,
    });
    const { failed } = buildEndDayResultRows(result, HOME_DIR, 'posix');
    expect(failed).toEqual([
      {
        sessionId: 'session-4',
        name: 'broken',
        cwd: '~/broken',
        reason: 'ENOENT',
        fullReason: 'ENOENT',
      },
    ]);
  });

  it('combines ineligible and listed sessions into one skipped list', () => {
    const result = buildResult({
      ineligible: [ineligible()],
      listedSessions: [listing()],
      dryRun: false,
    });
    const { skipped } = buildEndDayResultRows(result, HOME_DIR, 'posix');
    expect(skipped).toHaveLength(2);
    expect(skipped.map((row) => row.sessionId)).toEqual(['session-2', 'session-3']);
  });
});
