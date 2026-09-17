import { describe, expect, it } from 'vitest';
import {
  formatFallbackNoTty,
  formatInvalidSelection,
  formatNoPendingBriefing,
  formatNoSessionMatch,
  formatNoTtyInstructions,
  formatResumeProgress,
  formatStartDaySummary,
  renderFallbackQuestion,
  renderPickerQuestion,
} from '../../../packages/cli/src/format-start-day.js';
import type { ResumeSessionsResult } from '@seeya-ai/engine/application/start-day.js';
import type { ResumeFallbackReason } from '@seeya-ai/engine/core/types.js';
import { createHandoff } from '../core/_fixtures.js';

const PROMPT_TOO_LARGE_REASON: ResumeFallbackReason = {
  kind: 'promptTooLarge',
  promptLength: 4135,
  limitChars: 4096,
};

describe('formatNoPendingBriefing', () => {
  it('names how many days were scanned', () => {
    expect(formatNoPendingBriefing(31)).toContain('31 days scanned');
  });

  // The scan bound is 30 today, so this branch never shows up in real output — but "1 day" is the
  // only reading that is correct if it ever does, and the message used to sidestep the question
  // entirely with "day(s)".
  it('agrees with a singular count', () => {
    expect(formatNoPendingBriefing(1)).toContain('1 day scanned');
  });
});

describe('formatNoTtyInstructions', () => {
  it('mentions both flags a caller without a TTY can use instead', () => {
    const text = formatNoTtyInstructions();
    expect(text).toContain('--all');
    expect(text).toContain('--session');
  });
});

describe('formatNoSessionMatch', () => {
  it('names the value that did not match', () => {
    expect(formatNoSessionMatch('nothing-like-this')).toContain('"nothing-like-this"');
  });

  it('says nothing extra when no normalized value is given', () => {
    expect(formatNoSessionMatch('nothing-like-this')).not.toContain('matched against');
  });

  // Seam for S3-T5's path normalization (docs/PLANO-DE-ENTREGA.md): once a caller has both the
  // raw `--session` value and what it actually compared against handoffs, showing both reveals a
  // value a shell silently mangled (e.g. Git Bash eating backslashes out of a Windows path)
  // instead of a bare "no match" that looks like an ordinary typo.
  it('also shows what it was matched against, when that differs from the received value', () => {
    const message = formatNoSessionMatch('C:Usersmausa', 'c:usersmausa');
    expect(message).toContain('"C:Usersmausa"');
    expect(message).toContain('matched against "c:usersmausa"');
  });

  it('does not repeat the value when the normalized form is identical to what was received', () => {
    const message = formatNoSessionMatch('nothing-like-this', 'nothing-like-this');
    expect(message).not.toContain('matched against');
  });
});

describe('formatInvalidSelection', () => {
  it('carries the original reason, and states plainly that nothing was resumed', () => {
    const message = formatInvalidSelection(
      '"banana" is not a valid option (expected a number from 1 to 2, "all", or blank for none)',
    );
    expect(message).toContain('"banana" is not a valid option');
    expect(message).toContain('Nothing was resumed');
  });

  it('points at --help instead of duplicating --all/--session syntax inline', () => {
    const message = formatInvalidSelection('bad input');
    expect(message).toContain('seeya start-day --help');
  });
});

describe('renderPickerQuestion', () => {
  it('numbers each candidate starting at 1, with name and cwd', () => {
    const alpha = createHandoff({ name: 'alpha', cwd: 'c:\\code\\alpha' });
    const beta = createHandoff({ sessionId: '2', name: 'beta', cwd: 'c:\\code\\beta' });
    const question = renderPickerQuestion([alpha, beta]);
    expect(question).toContain('1) alpha (c:\\code\\alpha)');
    expect(question).toContain('2) beta (c:\\code\\beta)');
  });
});

describe('formatResumeProgress', () => {
  it('names the index, total, and session', () => {
    const handoff = createHandoff({ name: 'alpha', cwd: 'c:\\code\\alpha' });
    expect(formatResumeProgress({ index: 2, total: 3, handoff })).toBe(
      'Resuming 2 of 3: alpha (c:\\code\\alpha)...',
    );
  });
});

describe('formatStartDaySummary', () => {
  it('lists every resumed session, with a clean resume showing no extra notice', () => {
    const result: ResumeSessionsResult = {
      resumed: [{ sessionId: 'alpha-id', cwd: 'c:\\code\\alpha', kind: 'resumed' }],
      skipped: [],
      invalidFallbackAnswers: [],
      remaining: [],
      stoppedEarly: false,
    };
    const text = formatStartDaySummary(result);
    expect(text).toContain('Resumed:');
    expect(text).toContain('alpha-id');
    expect(text).not.toContain('Not resumed');
  });

  it('surfaces the fallback notice for a resumed-via-fallback session', () => {
    const result: ResumeSessionsResult = {
      resumed: [
        {
          sessionId: 'alpha-id',
          cwd: 'c:\\code\\alpha',
          kind: 'freshSession',
          reason: { kind: 'resumeFailed', exitCode: 1 },
        },
      ],
      skipped: [],
      invalidFallbackAnswers: [],
      remaining: [],
      stoppedEarly: false,
    };
    const text = formatStartDaySummary(result);
    expect(text).toContain('could not be resumed');
  });

  // V2-T7: the third ResumeOutcome form gets its own notice, never the "opened a new session"
  // wording that only applies to freshSession.
  it('surfaces the "resumed without the plan" notice for that third outcome form', () => {
    const result: ResumeSessionsResult = {
      resumed: [
        {
          sessionId: 'alpha-id',
          cwd: 'c:\\code\\alpha',
          kind: 'resumedWithoutPlan',
          promptLength: 20_000,
          limitChars: 16_384,
        },
      ],
      skipped: [],
      invalidFallbackAnswers: [],
      remaining: [],
      stoppedEarly: false,
    };
    const text = formatStartDaySummary(result);
    expect(text).toContain('without');
    expect(text).toContain('20000');
    expect(text).toContain('16384');
    expect(text).not.toContain('Opened a new session');
  });

  it('names what stopped the loop AND lists every session that never got a chance', () => {
    const failed = createHandoff({ name: 'beta', cwd: 'c:\\code\\beta' });
    const neverTried = createHandoff({
      sessionId: 'gamma-id',
      name: 'gamma',
      cwd: 'c:\\code\\gamma',
    });
    const result: ResumeSessionsResult = {
      resumed: [{ sessionId: 'alpha-id', cwd: 'c:\\code\\alpha', kind: 'resumed' }],
      skipped: [],
      invalidFallbackAnswers: [],
      remaining: [failed, neverTried],
      stoppedEarly: { handoff: failed, error: new Error('claude is not on PATH') },
    };
    const text = formatStartDaySummary(result);
    expect(text).toContain('Resumed:');
    expect(text).toContain('stopped after "beta"');
    expect(text).toContain('claude is not on PATH');
    expect(text).toContain('- beta (c:\\code\\beta)');
    expect(text).toContain('- gamma (c:\\code\\gamma)');
  });

  it('nothing resumed and nothing remaining is an empty summary', () => {
    const result: ResumeSessionsResult = {
      resumed: [],
      skipped: [],
      invalidFallbackAnswers: [],
      remaining: [],
      stoppedEarly: false,
    };
    expect(formatStartDaySummary(result)).toBe('');
  });

  // S5-T9 aceite: "o resumo final continua listando o que aconteceu, inclusive 'pulada a pedido'".
  it('lists a session skipped at the fallback question, with why a fallback was offered at all', () => {
    const skippedHandoff = createHandoff({ sessionId: 'alpha-id', cwd: 'c:\\code\\alpha' });
    const result: ResumeSessionsResult = {
      resumed: [],
      skipped: [{ handoff: skippedHandoff, reason: PROMPT_TOO_LARGE_REASON }],
      invalidFallbackAnswers: [],
      remaining: [],
      stoppedEarly: false,
    };
    const text = formatStartDaySummary(result);
    expect(text).toContain('Skipped at your request');
    expect(text).toContain('alpha-id');
    expect(text).toContain('too long to pass safely');
  });

  it('lists a session whose fallback answer was invalid, with the parse reason', () => {
    const handoff = createHandoff({ sessionId: 'alpha-id', cwd: 'c:\\code\\alpha' });
    const result: ResumeSessionsResult = {
      resumed: [],
      skipped: [],
      invalidFallbackAnswers: [{ handoff, reason: '"banana" is not a valid answer' }],
      remaining: [],
      stoppedEarly: false,
    };
    const text = formatStartDaySummary(result);
    expect(text).toContain('invalid answer to the fallback question');
    expect(text).toContain('"banana" is not a valid answer');
  });
});

const RESUME_FAILED_REASON: ResumeFallbackReason = { kind: 'resumeFailed', exitCode: 1 };

describe('renderFallbackQuestion', () => {
  it('resumeFailed: names the session, the reason, warns about a fresh conversation, and defaults to no', () => {
    const handoff = createHandoff({ name: 'alpha', cwd: 'c:\\code\\alpha' });
    const text = renderFallbackQuestion(handoff, RESUME_FAILED_REASON);
    expect(text).toContain('"alpha"');
    expect(text).toContain('c:\\code\\alpha');
    expect(text).toContain('could not be resumed');
    expect(text).toContain('FRESH conversation');
    expect(text).toContain('[y/N]');
    // V2-T7's third answer never appears for this reason.
    expect(text).not.toMatch(/resume without the plan/i);
  });

  // V2-T7: the promptTooLarge question gets a third answer and a new default.
  it('promptTooLarge: names the session, the reason, offers "resume without the plan", and defaults to it', () => {
    const handoff = createHandoff({ name: 'alpha', cwd: 'c:\\code\\alpha' });
    const text = renderFallbackQuestion(handoff, PROMPT_TOO_LARGE_REASON);
    expect(text).toContain('"alpha"');
    expect(text).toContain('c:\\code\\alpha');
    expect(text).toContain('too long to pass safely');
    expect(text).toMatch(/resume without the plan/i);
    expect(text).toContain('[R/y/n]');
    expect(text).toContain('blank = resume without the plan');
  });
});

describe('formatFallbackNoTty', () => {
  it('resumeFailed: states the reason AND that it is skipping by default, without asking', () => {
    const handoff = createHandoff({ name: 'alpha', cwd: 'c:\\code\\alpha' });
    const text = formatFallbackNoTty(handoff, RESUME_FAILED_REASON);
    expect(text).toContain('"alpha"');
    expect(text).toContain('could not be resumed');
    expect(text).toContain('skipping it by default');
  });

  // V2-T7: the no-TTY default now matches the same per-reason default parseFallbackAnswer('')
  // applies — "resume without the plan" for promptTooLarge, never "skipping" (which would silently
  // discard a session that could have kept its full history for free).
  it('promptTooLarge: states the reason AND that it is resuming without the plan by default', () => {
    const handoff = createHandoff({ name: 'alpha', cwd: 'c:\\code\\alpha' });
    const text = formatFallbackNoTty(handoff, PROMPT_TOO_LARGE_REASON);
    expect(text).toContain('"alpha"');
    expect(text).toContain('too long to pass safely');
    expect(text).toMatch(/resuming it without yesterday's plan by default/i);
    expect(text).not.toContain('skipping it by default');
  });
});
