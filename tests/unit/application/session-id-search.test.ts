import { describe, expect, it } from 'vitest';
import { findSessionByIdOrPrefix } from '@seeya-ai/engine/application/session-id-search.js';
import type { SessionIdLookup } from '@seeya-ai/engine/core/ports.js';
import type { DiscoveredSession, SessionIdLookupOutcome } from '@seeya-ai/engine/core/types.js';

const SESSION_A: DiscoveredSession = {
  hasPid: true,
  sessionId: '11111111-1111-4111-8111-111111111111',
  cwd: 'c:\\code\\a',
  name: 'a',
  pid: 4242,
  procStart: '1',
  processIsAlive: true,
  hasTranscript: true,
  lastTranscriptWrite: new Date('2026-09-25T10:00:00.000Z'),
  lastActivity: new Date('2026-09-25T10:00:00.000Z'),
};

class StubSessionIdLookup implements SessionIdLookup {
  calls: string[] = [];
  constructor(private readonly result: SessionIdLookupOutcome) {}
  findByIdPrefix(idPrefix: string): Promise<SessionIdLookupOutcome> {
    this.calls.push(idPrefix);
    return Promise.resolve(this.result);
  }
}

describe('findSessionByIdOrPrefix', () => {
  it('matches an already-known candidate by sessionId prefix, without calling the direct lookup', async () => {
    const lookup = new StubSessionIdLookup({ kind: 'notFound' });

    const outcome = await findSessionByIdOrPrefix([SESSION_A], '11111111', lookup);

    expect(outcome).toEqual({ kind: 'found', session: SESSION_A });
    expect(lookup.calls).toEqual([]);
  });

  it('never matches by name or cwd — only a sessionId prefix (a dedicated id field, unlike cli/session-reference.ts)', async () => {
    const lookup = new StubSessionIdLookup({ kind: 'notFound' });

    const outcome = await findSessionByIdOrPrefix([SESSION_A], 'a', lookup);

    expect(outcome).toEqual({ kind: 'notFound' });
  });

  it('two known candidates sharing a prefix are ambiguous, never picked (D-025)', async () => {
    const sessionB: DiscoveredSession = {
      ...SESSION_A,
      sessionId: '11112222-2222-4222-8222-222222222222',
    };
    const lookup = new StubSessionIdLookup({ kind: 'notFound' });

    const outcome = await findSessionByIdOrPrefix([SESSION_A, sessionB], '1111', lookup);

    expect(outcome.kind).toBe('ambiguous');
  });

  it('falls through to the direct lookup only when nothing already known matched', async () => {
    const found: SessionIdLookupOutcome = { kind: 'found', session: SESSION_A };
    const lookup = new StubSessionIdLookup(found);

    const outcome = await findSessionByIdOrPrefix([], '11111111', lookup);

    expect(outcome).toBe(found);
    expect(lookup.calls).toEqual(['11111111']);
  });
});
