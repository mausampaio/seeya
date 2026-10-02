import { describe, expect, it } from 'vitest';
import {
  CLOSED_SESSION_REASON,
  formatIneligibilityReasons,
} from '../../../../packages/app/src/state/end-day-reasons.js';

describe('formatIneligibilityReasons (V2-T69)', () => {
  it('renders a single reason as a sentence, not the raw token', () => {
    expect(formatIneligibilityReasons(['noRecentActivity'])).toBe(
      'No activity within the relevance window.',
    );
  });

  it('every IneligibilityReason has its own sentence (no fallthrough to a generic one)', () => {
    expect(formatIneligibilityReasons(['noEvidence'])).toMatch(/evidence/i);
    expect(formatIneligibilityReasons(['ownSeeyaFork'])).toMatch(/copy seeya made/i);
    expect(formatIneligibilityReasons(['ignoredCwd'])).toMatch(/ignore list/i);
    expect(formatIneligibilityReasons(['duplicateToday'])).toMatch(/already captured today/i);
  });

  it('joins more than one reason into one readable sentence', () => {
    const text = formatIneligibilityReasons(['ignoredCwd', 'duplicateToday']);
    expect(text).toBe(
      'This directory is in the ignore list. Already captured today with unchanged evidence.',
    );
  });

  it('an empty list is an empty string, never a placeholder', () => {
    expect(formatIneligibilityReasons([])).toBe('');
  });
});

describe('CLOSED_SESSION_REASON (V2-T69)', () => {
  // PO review round 1: the original text cited "(D-031)" — a decision id meaningless to the person
  // reading the dialog, who has no `docs/DECISOES.md` to look it up in. Regression test: this used
  // to read `expect(CLOSED_SESSION_REASON).toMatch(/D-031/)`, which this exact string now fails.
  it('is a plain sentence, never a decision id a reader of the dialog has no way to resolve', () => {
    expect(CLOSED_SESSION_REASON).toBe('Session closed — no running process was found.');
    expect(CLOSED_SESSION_REASON).not.toMatch(/D-0\d+/);
  });
});
