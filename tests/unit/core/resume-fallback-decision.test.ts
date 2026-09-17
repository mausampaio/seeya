/**
 * `parseFallbackAnswer` (S5-T9, `core/resume-fallback-decision.ts`) — the pure decision behind
 * `seeya start-day`'s "open a new session anyway?" question. V2-T7 parametrized it by
 * `reasonKind`: `promptTooLarge` gained a third answer ("resume without the plan") and a new
 * default; `resumeFailed` keeps S5-T9's original two answers and default unchanged.
 */
import { describe, expect, it } from 'vitest';
import { parseFallbackAnswer } from '@seeya-ai/engine/core/resume-fallback-decision.js';

describe('parseFallbackAnswer — resumeFailed (S5-T9, unchanged by V2-T7)', () => {
  it.each(['y', 'Y', 'yes', 'YES', '  y  '])('opens on %j', (answer) => {
    expect(parseFallbackAnswer(answer, 'resumeFailed')).toEqual({ kind: 'open' });
  });

  it.each(['n', 'N', 'no', 'NO', '  no  '])('skips on %j', (answer) => {
    expect(parseFallbackAnswer(answer, 'resumeFailed')).toEqual({ kind: 'skip' });
  });

  it('a blank answer (Enter alone) skips — never opens a history-losing session by distraction', () => {
    expect(parseFallbackAnswer('', 'resumeFailed')).toEqual({ kind: 'skip' });
  });

  it('whitespace-only is treated the same as blank', () => {
    expect(parseFallbackAnswer('   ', 'resumeFailed')).toEqual({ kind: 'skip' });
  });

  it.each(['maybe', 'sure', '1', 'open', 'true'])(
    'reports an invalid answer for %j, without guessing',
    (answer) => {
      const result = parseFallbackAnswer(answer, 'resumeFailed');
      expect(result.kind).toBe('invalid');
      if (result.kind === 'invalid') {
        expect(result.reason).toContain('y');
        expect(result.reason).toContain('n');
      }
    },
  );

  it('"r"/"resume" — the promptTooLarge-only answer — is invalid here, not silently reinterpreted', () => {
    for (const answer of ['r', 'resume']) {
      const result = parseFallbackAnswer(answer, 'resumeFailed');
      expect(result.kind).toBe('invalid');
      if (result.kind === 'invalid') {
        expect(result.reason).toContain('resume without the plan');
        expect(result.reason).toContain('resumeFailed');
      }
    }
  });
});

describe('parseFallbackAnswer — promptTooLarge (V2-T7: a third answer and a new default)', () => {
  it.each(['y', 'Y', 'yes'])('opens a fresh session on %j', (answer) => {
    expect(parseFallbackAnswer(answer, 'promptTooLarge')).toEqual({ kind: 'open' });
  });

  it.each(['r', 'R', 'resume', 'RESUME', '  r  '])('resumes without the plan on %j', (answer) => {
    expect(parseFallbackAnswer(answer, 'promptTooLarge')).toEqual({ kind: 'resumeWithoutPlan' });
  });

  it('a blank answer (Enter alone) also resumes without the plan — the new default', () => {
    expect(parseFallbackAnswer('', 'promptTooLarge')).toEqual({ kind: 'resumeWithoutPlan' });
  });

  it('whitespace-only is treated the same as blank', () => {
    expect(parseFallbackAnswer('   ', 'promptTooLarge')).toEqual({ kind: 'resumeWithoutPlan' });
  });

  it.each(['n', 'N', 'no'])('skips on %j', (answer) => {
    expect(parseFallbackAnswer(answer, 'promptTooLarge')).toEqual({ kind: 'skip' });
  });

  it.each(['maybe', 'sure', '1', 'open', 'true'])(
    'reports an invalid answer for %j, without guessing',
    (answer) => {
      const result = parseFallbackAnswer(answer, 'promptTooLarge');
      expect(result.kind).toBe('invalid');
      if (result.kind === 'invalid') {
        expect(result.reason).toContain('y');
        expect(result.reason).toContain('r');
        expect(result.reason).toContain('n');
      }
    },
  );
});
