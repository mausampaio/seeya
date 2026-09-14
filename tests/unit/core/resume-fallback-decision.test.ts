/**
 * `parseFallbackAnswer` (S5-T9, `core/resume-fallback-decision.ts`) — the pure decision behind
 * `seeya start-day`'s "open a new session anyway?" question. Task's own aceite: unit tests for
 * the three answers AND the empty default.
 */
import { describe, expect, it } from 'vitest';
import { parseFallbackAnswer } from '@seeya-ai/engine/core/resume-fallback-decision.js';

describe('parseFallbackAnswer — the three answers', () => {
  it.each(['y', 'Y', 'yes', 'YES', '  y  '])('opens on %j', (answer) => {
    expect(parseFallbackAnswer(answer)).toEqual({ kind: 'open' });
  });

  it.each(['n', 'N', 'no', 'NO', '  no  '])('skips on %j', (answer) => {
    expect(parseFallbackAnswer(answer)).toEqual({ kind: 'skip' });
  });

  it.each(['maybe', 'sure', '1', 'open', 'true'])(
    'reports an invalid answer for %j, without guessing',
    (answer) => {
      const result = parseFallbackAnswer(answer);
      expect(result.kind).toBe('invalid');
      if (result.kind === 'invalid') {
        expect(result.reason).toContain('y');
        expect(result.reason).toContain('n');
      }
    },
  );
});

describe('parseFallbackAnswer — the empty default', () => {
  it('a blank answer (Enter alone) skips — never opens a history-losing session by distraction', () => {
    expect(parseFallbackAnswer('')).toEqual({ kind: 'skip' });
  });

  it('whitespace-only is treated the same as blank', () => {
    expect(parseFallbackAnswer('   ')).toEqual({ kind: 'skip' });
  });
});
