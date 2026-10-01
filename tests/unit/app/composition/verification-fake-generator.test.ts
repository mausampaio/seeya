import { describe, expect, it } from 'vitest';
import { VerificationFakeHandoffGenerator } from '../../../../packages/app/src/composition/verification-fake-generator.js';
import type { Clock } from '@seeya-ai/engine/core/ports.js';
import type { DiscoveredSession } from '@seeya-ai/engine/core/types.js';

class FakeClock implements Clock {
  readonly sleptMs: number[] = [];
  now(): Date {
    return new Date('2026-01-01T00:00:00.000Z');
  }
  sleep(ms: number): Promise<void> {
    this.sleptMs.push(ms);
    return Promise.resolve();
  }
}

const SESSION: DiscoveredSession = {
  hasPid: false,
  sessionId: 'session-1',
  cwd: '/home/x/alpha',
  name: 'alpha',
  hasTranscript: true,
  lastTranscriptWrite: null,
  lastActivity: null,
};

describe('VerificationFakeHandoffGenerator (V2-T69)', () => {
  it('sleeps for exactly delayMs via the Clock port, never a raw timer (D-019)', async () => {
    const clock = new FakeClock();
    const generator = new VerificationFakeHandoffGenerator(clock, 1500);

    await generator.generate(SESSION);

    expect(clock.sleptMs).toEqual([1500]);
  });

  it('returns a canned understanding naming itself as a fixture, never empty', async () => {
    const clock = new FakeClock();
    const generator = new VerificationFakeHandoffGenerator(clock, 0);

    const result = await generator.generate(SESSION);

    expect(result.understanding).toMatch(/verification fixture/i);
    expect(result.understanding).toContain('alpha');
    expect(result.pendingItems.length).toBeGreaterThan(0);
    expect(result.tomorrowPlan.length).toBeGreaterThan(0);
  });
});
