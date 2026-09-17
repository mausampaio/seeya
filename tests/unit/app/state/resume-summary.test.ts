import { describe, expect, it } from 'vitest';
import { buildResumeSummary } from '../../../../packages/app/src/state/resume-summary.js';
import type { ResumeSessionsResult } from '@seeya-ai/engine/application/start-day.js';
import { buildHandoffFixture } from '../_handoff-fixture.js';

const emptyResult: ResumeSessionsResult = {
  resumed: [],
  skipped: [],
  invalidFallbackAnswers: [],
  remaining: [],
  stoppedEarly: false,
};

describe('buildResumeSummary', () => {
  it('an empty result maps to an all-empty summary', () => {
    const summary = buildResumeSummary(emptyResult, (id) => id);

    expect(summary).toEqual({
      resumed: [],
      skipped: [],
      invalidFallbackAnswers: [],
      remaining: [],
      stoppedEarly: false,
    });
  });

  it('resumed: a clean attach carries kind "resumed" and the resolved label', () => {
    const result: ResumeSessionsResult = {
      ...emptyResult,
      resumed: [{ sessionId: 'session-1', cwd: '/projects/alpha', kind: 'resumed' }],
    };

    const summary = buildResumeSummary(result, () => 'alpha');

    expect(summary.resumed).toEqual([
      { sessionId: 'session-1', name: 'alpha', cwd: '/projects/alpha', kind: 'resumed' },
    ]);
  });

  it('resumed: a freshSession outcome carries the exact CLI-shared reason text, not the raw reason', () => {
    const result: ResumeSessionsResult = {
      ...emptyResult,
      resumed: [
        {
          sessionId: 'session-1',
          cwd: '/projects/alpha',
          kind: 'freshSession',
          reason: { kind: 'resumeFailed', exitCode: 1 },
        },
      ],
    };

    const summary = buildResumeSummary(result, () => 'alpha');

    const outcome = summary.resumed[0];
    expect(outcome?.kind).toBe('freshSession');
    expect(outcome?.kind === 'freshSession' && outcome.noteText).toContain('could not be resumed');
    expect(outcome?.kind === 'freshSession' && outcome.noteText).toContain('code 1');
  });

  // V2-T7: the third ResumeOutcome form.
  it('resumed: a resumedWithoutPlan outcome carries the "N characters, over the limit" fact', () => {
    const result: ResumeSessionsResult = {
      ...emptyResult,
      resumed: [
        {
          sessionId: 'session-1',
          cwd: '/projects/alpha',
          kind: 'resumedWithoutPlan',
          promptLength: 20_000,
          limitChars: 16_384,
        },
      ],
    };

    const summary = buildResumeSummary(result, () => 'alpha');

    const outcome = summary.resumed[0];
    expect(outcome?.kind).toBe('resumedWithoutPlan');
    expect(outcome?.kind === 'resumedWithoutPlan' && outcome.noteText).toContain('20000');
    expect(outcome?.kind === 'resumedWithoutPlan' && outcome.noteText).toContain('16384');
  });

  it('skipped: carries the handoff name/cwd and the reason text', () => {
    const handoff = buildHandoffFixture({ name: 'beta', cwd: '/projects/beta' });
    const result: ResumeSessionsResult = {
      ...emptyResult,
      skipped: [{ handoff, reason: { kind: 'resumeFailed', exitCode: 1 } }],
    };

    const summary = buildResumeSummary(result, (id) => id);

    expect(summary.skipped).toHaveLength(1);
    expect(summary.skipped[0]?.name).toBe('beta');
    expect(summary.skipped[0]?.cwd).toBe('/projects/beta');
    expect(summary.skipped[0]?.reasonText).toContain('could not be resumed');
  });

  it('invalidFallbackAnswers: carries the handoff name/cwd and the raw reason string', () => {
    const handoff = buildHandoffFixture({ name: 'gamma' });
    const result: ResumeSessionsResult = {
      ...emptyResult,
      invalidFallbackAnswers: [{ handoff, reason: 'not a valid answer' }],
    };

    const summary = buildResumeSummary(result, (id) => id);

    expect(summary.invalidFallbackAnswers).toEqual([
      {
        sessionId: handoff.sessionId,
        name: 'gamma',
        cwd: handoff.cwd,
        reason: 'not a valid answer',
      },
    ]);
  });

  it('remaining: one entry per never-attempted handoff', () => {
    const handoff = buildHandoffFixture({ name: 'delta' });
    const result: ResumeSessionsResult = { ...emptyResult, remaining: [handoff] };

    const summary = buildResumeSummary(result, (id) => id);

    expect(summary.remaining).toEqual([
      { sessionId: handoff.sessionId, name: 'delta', cwd: handoff.cwd },
    ]);
  });

  it('stoppedEarly: carries the failing session and the error message, never invented (D-025)', () => {
    const handoff = buildHandoffFixture({ name: 'epsilon' });
    const result: ResumeSessionsResult = {
      ...emptyResult,
      remaining: [handoff],
      stoppedEarly: { handoff, error: new Error('boom') },
    };

    const summary = buildResumeSummary(result, (id) => id);

    expect(summary.stoppedEarly).toEqual({
      session: { sessionId: handoff.sessionId, name: 'epsilon', cwd: handoff.cwd },
      message: 'boom',
    });
  });
});
