import { describe, expect, it } from 'vitest';
import { describeFallbackReason, formatResumeNotice } from '@seeya-ai/engine/core/resume-notice.js';
import type { ResumeOutcome } from '@seeya-ai/engine/core/types.js';

describe('formatResumeNotice — D-004 "avisar o usuário que houve fallback"', () => {
  it('returns null when the resume attached cleanly, with the plan — nothing to warn about', () => {
    const outcome: ResumeOutcome = { sessionId: 'abc', cwd: '/work/project', kind: 'resumed' };
    expect(formatResumeNotice(outcome)).toBeNull();
  });

  it('names the session and the exit code for a resumeFailed fallback, without inventing a cause', () => {
    const outcome: ResumeOutcome = {
      sessionId: 'abc-123',
      cwd: '/work/project',
      kind: 'freshSession',
      reason: { kind: 'resumeFailed', exitCode: 1 },
    };
    const notice = formatResumeNotice(outcome);
    expect(notice).not.toBeNull();
    expect(notice).toContain('abc-123');
    expect(notice).toContain('/work/project');
    expect(notice).toContain('code 1');
    // D-025: never claims a specific cause (expired session, moved project) the exit code alone
    // can't establish.
    expect(notice).not.toMatch(/expired/i);
    expect(notice).not.toMatch(/moved/i);
  });

  it('names the two numbers for a promptTooLarge fallback', () => {
    const outcome: ResumeOutcome = {
      sessionId: 'abc-123',
      cwd: '/work/project',
      kind: 'freshSession',
      reason: { kind: 'promptTooLarge', promptLength: 9000, limitChars: 4096 },
    };
    const notice = formatResumeNotice(outcome);
    expect(notice).toContain('9000');
    expect(notice).toContain('4096');
  });

  it('always says a fresh session was opened, distinct from a real resume', () => {
    const outcome: ResumeOutcome = {
      sessionId: 'abc-123',
      cwd: '/work/project',
      kind: 'freshSession',
      reason: { kind: 'resumeFailed', exitCode: 1 },
    };
    const notice = formatResumeNotice(outcome) ?? '';
    expect(notice).toMatch(/new session/i);
    expect(notice).toMatch(/fresh conversation/i);
  });

  // V2-T7: the third ResumeOutcome form — resumed with the original transcript, but the plan
  // itself didn't travel as an argument.
  it('names the two numbers AND that the plan is still in the briefing, for resumedWithoutPlan', () => {
    const outcome: ResumeOutcome = {
      sessionId: 'abc-123',
      cwd: '/work/project',
      kind: 'resumedWithoutPlan',
      promptLength: 20_000,
      limitChars: 16_384,
    };
    const notice = formatResumeNotice(outcome);
    expect(notice).not.toBeNull();
    expect(notice).toContain('abc-123');
    expect(notice).toContain('/work/project');
    expect(notice).toContain('20000');
    expect(notice).toContain('16384');
    expect(notice).toMatch(/briefing/i);
    // Distinct from a fresh session: this is still the ORIGINAL session's own transcript.
    expect(notice).not.toMatch(/fresh conversation/i);
    expect(notice).not.toMatch(/opened a new session/i);
  });

  // V2-T7 item 2: `resumeWithoutPlanFailed` never appears inside a `ResumeOutcome` (that attempt
  // failing is reported directly as a skip, `application/start-day.ts#attemptResumeWithoutPlan`)
  // — tested against `describeFallbackReason` itself, the shared "why" text both `formatResumeNotice`
  // above and the CLI's/app's fallback-skip rendering read from.
  it('resume without the plan failing fast is described with its own exit code, never guessed at', () => {
    expect(describeFallbackReason({ kind: 'resumeWithoutPlanFailed', exitCode: 7 })).toBe(
      'resume without the plan failed, exit 7',
    );
  });
});
