/**
 * `resumeSessions` (S3-T3, `application/start-day.ts`) — steps 4-5 of `seeya start-day`
 * (docs/ESPECIFICACAO.md § `seeya start-day`). Reuses `_fakes.ts`'s named doubles
 * (docs/TESTES.md: "duplo de I/O é classe/objeto nomeado implementando a porta").
 */
import { describe, expect, it } from 'vitest';
import { resumeSessions, type StartDayDeps } from '@seeya-ai/engine/application/start-day.js';
import { createHandoff } from '../core/_fixtures.js';
import {
  DEFAULT_TEST_CONFIG,
  FakeSessionResumer,
  FakeStorage,
  alwaysOpenFallback,
  cleanlyResumingResumer,
  fallbackNeedingResumer,
  fallbackNeedingThenFailingResumer,
  throwingResumer,
} from './_fakes.js';
import type { ResumeFallbackReason } from '@seeya-ai/engine/core/types.js';

const DAY = '2026-08-16';

const PROMPT_TOO_LARGE_REASON: ResumeFallbackReason = {
  kind: 'promptTooLarge',
  promptLength: 4135,
  limitChars: 4096,
};

/** `confirmFallback` defaults to "open" — most tests here are about resumption/storage
 * bookkeeping, not about the ask itself (that's `describe('resumeSessions — the fallback
 * question (S5-T9)'`) below), so the pre-S5-T9 behavior (a fallback just happens) is the least
 * surprising default. */
function deps(overrides: Partial<StartDayDeps> = {}): StartDayDeps {
  return {
    storage: new FakeStorage(DEFAULT_TEST_CONFIG),
    sessionResumer: cleanlyResumingResumer(),
    confirmFallback: alwaysOpenFallback,
    ...overrides,
  };
}

describe('resumeSessions — the happy path', () => {
  it('resumes every handoff, in order, and reports every outcome', async () => {
    const alpha = createHandoff({ sessionId: 'alpha', name: 'alpha', cwd: 'c:\\code\\alpha' });
    const beta = createHandoff({ sessionId: 'beta', name: 'beta', cwd: 'c:\\code\\beta' });
    const resumer = cleanlyResumingResumer();
    const result = await resumeSessions(deps({ sessionResumer: resumer }), {
      day: DAY,
      handoffs: [alpha, beta],
    });

    expect(result.stoppedEarly).toBe(false);
    expect(result.remaining).toEqual([]);
    expect(result.resumed).toEqual([
      { sessionId: 'alpha', cwd: 'c:\\code\\alpha', fellBack: false },
      { sessionId: 'beta', cwd: 'c:\\code\\beta', fellBack: false },
    ]);
    expect(resumer.calls.map((call) => call.sessionId)).toEqual(['alpha', 'beta']);
  });

  it('reports progress with the right index/total, BEFORE each attempt', async () => {
    const alpha = createHandoff({ sessionId: 'alpha' });
    const beta = createHandoff({ sessionId: 'beta' });
    const events: { index: number; total: number; sessionId: string }[] = [];
    await resumeSessions(deps(), { day: DAY, handoffs: [alpha, beta] }, (event) =>
      events.push({ index: event.index, total: event.total, sessionId: event.handoff.sessionId }),
    );
    expect(events).toEqual([
      { index: 1, total: 2, sessionId: 'alpha' },
      { index: 2, total: 2, sessionId: 'beta' },
    ]);
  });

  it('marks each session resumed in storage right after it resumes — one write per session, not batched', async () => {
    const alpha = createHandoff({ sessionId: 'alpha' });
    const beta = createHandoff({ sessionId: 'beta' });
    const storage = new FakeStorage(DEFAULT_TEST_CONFIG);
    const seenAfterFirst: ReadonlySet<string>[] = [];
    const resumer = new FakeSessionResumer(async (sessionId, cwd) => {
      seenAfterFirst.push(await storage.readResumedSessionIds(DAY));
      return { kind: 'resumed', outcome: { sessionId, cwd, fellBack: false } };
    });
    await resumeSessions(
      { storage, sessionResumer: resumer, confirmFallback: alwaysOpenFallback },
      { day: DAY, handoffs: [alpha, beta] },
    );

    // At the moment beta is attempted, alpha must already be marked — proves the write happened
    // between the two attempts, not after the whole loop.
    expect([...seenAfterFirst[0]!]).toEqual([]);
    expect([...seenAfterFirst[1]!]).toEqual(['alpha']);
    expect([...(await storage.readResumedSessionIds(DAY))].sort()).toEqual(['alpha', 'beta']);
  });

  it('a fallback outcome (fellBack !== false) still counts as resumed — the person got a session', async () => {
    const handoff = createHandoff({ sessionId: 'alpha', cwd: 'c:\\code\\alpha' });
    const reason: ResumeFallbackReason = { kind: 'resumeFailed', exitCode: 1 };
    const storage = new FakeStorage(DEFAULT_TEST_CONFIG);
    const resumer = fallbackNeedingResumer(reason);
    const result = await resumeSessions(
      { storage, sessionResumer: resumer, confirmFallback: alwaysOpenFallback },
      { day: DAY, handoffs: [handoff] },
    );

    expect(result.resumed).toEqual([
      { sessionId: 'alpha', cwd: 'c:\\code\\alpha', fellBack: reason },
    ]);
    expect([...(await storage.readResumedSessionIds(DAY))]).toEqual(['alpha']);
  });

  it('starts from whatever was already resumed for the day, and keeps it in the saved set', async () => {
    const storage = new FakeStorage(DEFAULT_TEST_CONFIG);
    await storage.saveResumedSessionIds(DAY, new Set(['already-done']));
    const handoff = createHandoff({ sessionId: 'alpha' });
    await resumeSessions(
      { storage, sessionResumer: cleanlyResumingResumer(), confirmFallback: alwaysOpenFallback },
      { day: DAY, handoffs: [handoff] },
    );

    expect([...(await storage.readResumedSessionIds(DAY))].sort()).toEqual([
      'alpha',
      'already-done',
    ]);
  });
});

describe('resumeSessions — an attemptResume()/runFallback() that throws stops the loop (docs/QUESTOES.md Q-027 item 5)', () => {
  it('stops before the failing session, reports it as remaining, and never marks it resumed', async () => {
    const alpha = createHandoff({ sessionId: 'alpha', name: 'alpha' });
    const beta = createHandoff({ sessionId: 'beta', name: 'beta' });
    const gamma = createHandoff({ sessionId: 'gamma', name: 'gamma' });
    const storage = new FakeStorage(DEFAULT_TEST_CONFIG);
    const resumer = new FakeSessionResumer((sessionId) =>
      sessionId === 'beta'
        ? Promise.reject(new Error('claude is not on PATH'))
        : Promise.resolve({
            kind: 'resumed',
            outcome: { sessionId, cwd: 'c:\\code\\x', fellBack: false },
          }),
    );

    const result = await resumeSessions(
      { storage, sessionResumer: resumer, confirmFallback: alwaysOpenFallback },
      { day: DAY, handoffs: [alpha, beta, gamma] },
    );

    expect(result.resumed).toHaveLength(1);
    expect(result.resumed[0]?.sessionId).toBe('alpha');
    expect(result.stoppedEarly).not.toBe(false);
    if (result.stoppedEarly !== false) {
      expect(result.stoppedEarly.handoff.sessionId).toBe('beta');
      expect(result.stoppedEarly.error.message).toBe('claude is not on PATH');
    }
    // beta AND gamma never ran — gamma is never even attempted once the loop stops.
    expect(result.remaining.map((h) => h.sessionId)).toEqual(['beta', 'gamma']);
    expect(resumer.calls.map((call) => call.sessionId)).toEqual(['alpha', 'beta']);
    expect([...(await storage.readResumedSessionIds(DAY))]).toEqual(['alpha']);
  });

  it('a value thrown that is not an Error is wrapped, never left as a non-Error in the result', async () => {
    const handoff = createHandoff({ sessionId: 'alpha' });
    // Deliberately a non-Error rejection — this is exactly the case `toError` (start-day.ts) exists
    // to normalize, so the test needs a real one to reject with.
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    const resumer = new FakeSessionResumer(() => Promise.reject('a plain string failure'));
    const result = await resumeSessions(
      {
        storage: new FakeStorage(DEFAULT_TEST_CONFIG),
        sessionResumer: resumer,
        confirmFallback: alwaysOpenFallback,
      },
      { day: DAY, handoffs: [handoff] },
    );
    expect(result.stoppedEarly).not.toBe(false);
    if (result.stoppedEarly !== false) {
      expect(result.stoppedEarly.error).toBeInstanceOf(Error);
      expect(result.stoppedEarly.error.message).toBe('a plain string failure');
    }
  });

  it('an empty handoff list resumes nothing and never touches the resumer', async () => {
    const resumer = throwingResumer('should never be called');
    const result = await resumeSessions(deps({ sessionResumer: resumer }), {
      day: DAY,
      handoffs: [],
    });
    expect(result).toEqual({
      resumed: [],
      skipped: [],
      invalidFallbackAnswers: [],
      remaining: [],
      stoppedEarly: false,
    });
    expect(resumer.calls).toHaveLength(0);
  });

  it('runFallback() that fails fast after an "open" answer stops the loop the same way (S5-T9)', async () => {
    const alpha = createHandoff({ sessionId: 'alpha', name: 'alpha' });
    const beta = createHandoff({ sessionId: 'beta', name: 'beta' });
    const resumer = fallbackNeedingThenFailingResumer(
      PROMPT_TOO_LARGE_REASON,
      'claude is not on PATH',
    );

    const result = await resumeSessions(
      {
        storage: new FakeStorage(DEFAULT_TEST_CONFIG),
        sessionResumer: resumer,
        confirmFallback: alwaysOpenFallback,
      },
      { day: DAY, handoffs: [alpha, beta] },
    );

    expect(result.resumed).toEqual([]);
    expect(result.stoppedEarly).not.toBe(false);
    if (result.stoppedEarly !== false) {
      expect(result.stoppedEarly.handoff.sessionId).toBe('alpha');
      expect(result.stoppedEarly.error.message).toBe('claude is not on PATH');
    }
    expect(result.remaining.map((h) => h.sessionId)).toEqual(['alpha', 'beta']);
  });
});

describe('resumeSessions — the fallback question (S5-T9)', () => {
  it('"skip" never opens a fallback, never marks the session resumed, and the loop continues', async () => {
    const alpha = createHandoff({ sessionId: 'alpha', name: 'alpha', cwd: 'c:\\code\\alpha' });
    const beta = createHandoff({ sessionId: 'beta', name: 'beta', cwd: 'c:\\code\\beta' });
    const storage = new FakeStorage(DEFAULT_TEST_CONFIG);
    const resumer = fallbackNeedingResumer(PROMPT_TOO_LARGE_REASON);
    const asked: string[] = [];

    const result = await resumeSessions(
      {
        storage,
        sessionResumer: resumer,
        confirmFallback: (handoff) => {
          asked.push(handoff.sessionId);
          return Promise.resolve({ kind: 'skip' });
        },
      },
      { day: DAY, handoffs: [alpha, beta] },
    );

    expect(result.resumed).toEqual([]);
    expect(result.skipped).toEqual([
      { handoff: alpha, reason: PROMPT_TOO_LARGE_REASON },
      { handoff: beta, reason: PROMPT_TOO_LARGE_REASON },
    ]);
    expect(result.stoppedEarly).toBe(false);
    expect(resumer.fallbackCalls).toHaveLength(0);
    expect(asked).toEqual(['alpha', 'beta']);
    expect([...(await storage.readResumedSessionIds(DAY))]).toEqual([]);
  });

  it('an empty answer (the default) also skips — Enter never opens a history-losing session', async () => {
    const alpha = createHandoff({ sessionId: 'alpha' });
    const resumer = fallbackNeedingResumer(PROMPT_TOO_LARGE_REASON);

    const result = await resumeSessions(
      {
        storage: new FakeStorage(DEFAULT_TEST_CONFIG),
        sessionResumer: resumer,
        // The real `cli/start-day-command.ts#makeFallbackConfirmer` runs the raw answer through
        // `core/resume-fallback-decision.ts#parseFallbackAnswer`, whose own unit tests cover
        // blank -> skip; this fake only needs to hand `resumeSessions` the already-parsed
        // decision to prove the ORCHESTRATION treats "skip" correctly, whichever answer produced
        // it.
        confirmFallback: () => Promise.resolve({ kind: 'skip' }),
      },
      { day: DAY, handoffs: [alpha] },
    );

    expect(result.skipped).toEqual([{ handoff: alpha, reason: PROMPT_TOO_LARGE_REASON }]);
    expect(resumer.fallbackCalls).toHaveLength(0);
  });

  it('an invalid answer is reported, never resumes that session, and the loop continues to the next handoff', async () => {
    const alpha = createHandoff({ sessionId: 'alpha', name: 'alpha' });
    const beta = createHandoff({ sessionId: 'beta', name: 'beta' });
    const storage = new FakeStorage(DEFAULT_TEST_CONFIG);
    const resumer = fallbackNeedingResumer(PROMPT_TOO_LARGE_REASON);

    const result = await resumeSessions(
      {
        storage,
        sessionResumer: resumer,
        confirmFallback: () =>
          Promise.resolve({ kind: 'invalid', reason: '"banana" is not a valid answer' }),
      },
      { day: DAY, handoffs: [alpha, beta] },
    );

    expect(result.resumed).toEqual([]);
    expect(result.stoppedEarly).toBe(false);
    expect(result.invalidFallbackAnswers).toEqual([
      { handoff: alpha, reason: '"banana" is not a valid answer' },
      { handoff: beta, reason: '"banana" is not a valid answer' },
    ]);
    expect(resumer.fallbackCalls).toHaveLength(0);
    expect([...(await storage.readResumedSessionIds(DAY))]).toEqual([]);
  });

  it('"open" runs the fallback and marks the session resumed, with the SAME reason it was asked about', async () => {
    const alpha = createHandoff({ sessionId: 'alpha', cwd: 'c:\\code\\alpha' });
    const storage = new FakeStorage(DEFAULT_TEST_CONFIG);
    const resumer = fallbackNeedingResumer(PROMPT_TOO_LARGE_REASON);

    const result = await resumeSessions(
      { storage, sessionResumer: resumer, confirmFallback: alwaysOpenFallback },
      { day: DAY, handoffs: [alpha] },
    );

    expect(result.resumed).toEqual([
      { sessionId: 'alpha', cwd: 'c:\\code\\alpha', fellBack: PROMPT_TOO_LARGE_REASON },
    ]);
    expect(resumer.fallbackCalls).toHaveLength(1);
    expect(resumer.fallbackCalls[0]?.reason).toEqual(PROMPT_TOO_LARGE_REASON);
    expect([...(await storage.readResumedSessionIds(DAY))]).toEqual(['alpha']);
  });
});
