import { describe, expect, it } from 'vitest';
import { formatPlanAge, MESSAGES } from '../../../../packages/app/src/text/messages.js';

describe('MESSAGES', () => {
  it('every plain string is non-empty (concentrated, but never accidentally blank)', () => {
    for (const [key, value] of Object.entries(MESSAGES)) {
      if (typeof value === 'string') {
        expect(value.length, key).toBeGreaterThan(0);
      }
    }
  });

  it('tabExited renders the exit code (V2-T64 PO review: no "code" word)', () => {
    expect(MESSAGES.tabExited(0)).toBe('exited (0)');
    expect(MESSAGES.tabExited(130)).toBe('exited (130)');
  });

  // V2-T7 item 4: the fallback dialog's body text depends on whether "Resume without the plan" is
  // offered at all (only for a promptTooLarge reason) — two different sentences, never the same
  // text with a word swapped in.
  describe('fallbackDialogBody', () => {
    it('mentions the free "resume without the plan" option when offered', () => {
      const text = MESSAGES.fallbackDialogBody(true);
      expect(text).toMatch(/resuming without the plan/i);
      expect(text).toMatch(/real history/i);
    });

    it('falls back to the original S5-T9 wording when not offered', () => {
      const text = MESSAGES.fallbackDialogBody(false);
      expect(text).toMatch(/FRESH conversation/);
      expect(text).not.toMatch(/resume without the plan/i);
    });
  });

  // V2-T67: the Projects tab's own count/lock texts.
  it('projectsTabCount pluralizes the project count', () => {
    expect(MESSAGES.projectsTabCount(0)).toBe('0 projects');
    expect(MESSAGES.projectsTabCount(1)).toBe('1 project');
    expect(MESSAGES.projectsTabCount(2)).toBe('2 projects');
  });

  it('projectsLockLockedBy names the holder by its short session id', () => {
    expect(MESSAGES.projectsLockLockedBy('abcd1234')).toBe('Locked by session abcd1234');
  });

  // V2-T55 item 2: "Other sessions" groups by directory, one row with a count instead of one per
  // session.
  it('otherSessionsDirectoryRowLabel names the directory and how many sessions it holds', () => {
    expect(MESSAGES.otherSessionsDirectoryRowLabel('/code/unrelated', 1)).toBe(
      '/code/unrelated (1 session)',
    );
    expect(MESSAGES.otherSessionsDirectoryRowLabel('/code/unrelated', 3)).toBe(
      '/code/unrelated (3 sessions)',
    );
  });

  // PO review of V2-T66, third round: "(0 days ago)" read as a literal defect, and daysAgo === 1
  // silently had no suffix at all — fixed to "(today)"/"(1 day ago)" singular/"(N days ago)".
  describe('formatPlanAge', () => {
    it('is "today" for daysAgo 0', () => {
      expect(formatPlanAge(0)).toBe('today');
    });

    it('is singular "1 day ago" for daysAgo 1', () => {
      expect(formatPlanAge(1)).toBe('1 day ago');
    });

    it('is plural "N days ago" for daysAgo 2 and beyond', () => {
      expect(formatPlanAge(2)).toBe('2 days ago');
      expect(formatPlanAge(21)).toBe('21 days ago');
    });
  });

  describe('todayPlanTitle', () => {
    it('reads "Plan for <day> (today)" for daysAgo 0', () => {
      expect(MESSAGES.todayPlanTitle('2026-10-01', 0)).toBe('Plan for 2026-10-01 (today)');
    });

    it('reads "Plan for <day> (1 day ago)" for daysAgo 1', () => {
      expect(MESSAGES.todayPlanTitle('2026-09-30', 1)).toBe('Plan for 2026-09-30 (1 day ago)');
    });

    it('reads "Plan for <day> (N days ago)" for daysAgo 2 and beyond', () => {
      expect(MESSAGES.todayPlanTitle('2026-09-20', 2)).toBe('Plan for 2026-09-20 (2 days ago)');
    });
  });

  it('todaySummaryResumedWithoutPlanNote wraps the bare fact in a sentence, distinct from the fallback note', () => {
    const text = MESSAGES.todaySummaryResumedWithoutPlanNote(
      'it was 20000 characters, over the 16384-character limit',
    );
    expect(text).toContain('Resumed without');
    expect(text).toContain('20000 characters');
    expect(text).not.toContain('Opened a new session');
  });
});
