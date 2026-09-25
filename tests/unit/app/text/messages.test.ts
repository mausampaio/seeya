import { describe, expect, it } from 'vitest';
import { MESSAGES } from '../../../../packages/app/src/text/messages.js';

describe('MESSAGES', () => {
  it('every plain string is non-empty (concentrated, but never accidentally blank)', () => {
    for (const [key, value] of Object.entries(MESSAGES)) {
      if (typeof value === 'string') {
        expect(value.length, key).toBeGreaterThan(0);
      }
    }
  });

  it('tabExited renders the exit code', () => {
    expect(MESSAGES.tabExited(0)).toBe('exited (code 0)');
    expect(MESSAGES.tabExited(130)).toBe('exited (code 130)');
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

  // V2-T30: the "Projects"/"Other sessions" row labels — pulled out of
  // electron/projects-list-view.ts's own DOM-building code so the text assembly has its own test.
  it('projectSessionRowLabel names the session and its state', () => {
    expect(MESSAGES.projectSessionRowLabel('demo-project-session', 'ended')).toBe(
      'demo-project-session (ended)',
    );
  });

  it('otherSessionRowLabel names the session, its cwd, and its state', () => {
    expect(MESSAGES.otherSessionRowLabel('unrelated-session', '/code/unrelated', 'ended')).toBe(
      'unrelated-session (/code/unrelated) — ended',
    );
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
