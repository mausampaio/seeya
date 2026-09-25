import { describe, expect, it } from 'vitest';
import { formatSessionStateLabel } from '@seeya-ai/engine/core/session-state-label.js';
import { classifyState } from '@seeya-ai/engine/core/classification.js';
import type { SessionWithoutPid } from '@seeya-ai/engine/core/types.js';

describe('formatSessionStateLabel', () => {
  it('alive/idle/ended render as their own name, unchanged', () => {
    expect(formatSessionStateLabel('alive')).toBe('alive');
    expect(formatSessionStateLabel('idle')).toBe('idle');
    expect(formatSessionStateLabel('ended')).toBe('ended');
  });

  it('V2-T52: unknown renders as a fact, not the confusing word "unknown"', () => {
    expect(formatSessionStateLabel('unknown')).toBe('no running process');
  });

  /**
   * V2-T52's own guard: the enum member classification produces stays the literal `'unknown'`
   * (D-027 — it's an identifier, and it also has to keep matching `handoff-schema.ts`'s
   * `z.enum([...,'unknown'])`); only the LABEL a person reads changes. If `classifyState` ever
   * started returning something else for a no-pid session, this test — not just the label test
   * above — would fail first.
   */
  it('the classification enum stays "unknown"; only the label built from it changes', () => {
    const session: SessionWithoutPid = {
      hasPid: false,
      sessionId: '11111111-1111-4111-8111-111111111111',
      cwd: 'c:\\code\\closed',
      name: 'closed',
      hasTranscript: true,
      lastTranscriptWrite: null,
      lastActivity: new Date('2026-09-25T00:00:00.000Z'),
    };
    const state = classifyState(session, {
      now: new Date('2026-09-25T12:00:00.000Z'),
      idleMinutes: 30,
    });

    expect(state).toBe('unknown');
    expect(formatSessionStateLabel(state)).toBe('no running process');
  });
});
