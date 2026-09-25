import { describe, expect, it } from 'vitest';
import {
  resolveSessionReference,
  resolveSessionReferenceForAdoption,
  toDiscoveredSessionReference,
  type SessionReference,
} from '../../../packages/cli/src/session-reference.js';
import type { DiscoveredSession, SessionIdLookupOutcome } from '@seeya-ai/engine/core/types.js';
import type { SessionIdLookup } from '@seeya-ai/engine/core/ports.js';
import { createSessionWithoutPid } from '../core/_fixtures.js';

type Candidate = SessionReference;

/** A `SessionIdLookup` test double recording every prefix it was asked about — so a test can
 * prove the direct, unwindowed scan was (or wasn't) reached at all, not just what it answers. */
class StubSessionIdLookup implements SessionIdLookup {
  readonly calls: string[] = [];
  constructor(private readonly result: SessionIdLookupOutcome = { kind: 'notFound' }) {}
  findByIdPrefix(idPrefix: string): Promise<SessionIdLookupOutcome> {
    this.calls.push(idPrefix);
    return Promise.resolve(this.result);
  }
}

// V2-T55's own resolveSessionReferenceForAdoption tests below need a full DiscoveredSession
// (createSessionWithoutPid — the fallback lookup only ever produces SessionWithoutPid), unlike
// `candidate()`'s bare three-field SessionReference above.
const fullDiscoveredSession = createSessionWithoutPid;

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    sessionId: '11111111-1111-4111-8111-111111111111',
    cwd: 'c:\\code\\alpha',
    name: 'alpha',
    ...overrides,
  };
}

const toRef = (item: Candidate): SessionReference => item;

describe('resolveSessionReference', () => {
  it('matches by exact sessionId', () => {
    const alpha = candidate();
    const beta = candidate({ sessionId: '22222222-2222-4222-8222-222222222222', name: 'beta' });

    const result = resolveSessionReference([alpha, beta], toRef, alpha.sessionId);

    expect(result).toEqual({ kind: 'found', item: alpha });
  });

  it('matches by a unique sessionId prefix', () => {
    const alpha = candidate({ sessionId: '88881111-0000-4000-8000-000000000000' });
    const beta = candidate({ sessionId: '44442222-0000-4000-8000-000000000000', name: 'beta' });

    const result = resolveSessionReference([alpha, beta], toRef, '88881111');

    expect(result).toEqual({ kind: 'found', item: alpha });
  });

  it('matches by exact display name', () => {
    const alpha = candidate({ name: 'code-6d' });
    const beta = candidate({ sessionId: '22222222-2222-4222-8222-222222222222', name: 'code-9f' });

    const result = resolveSessionReference([alpha, beta], toRef, 'code-6d');

    expect(result).toEqual({ kind: 'found', item: alpha });
  });

  it('matches by cwd, exact spelling', () => {
    const alpha = candidate({ cwd: 'c:\\code\\alpha' });

    const result = resolveSessionReference([alpha], toRef, 'c:\\code\\alpha');

    expect(result).toEqual({ kind: 'found', item: alpha });
  });

  it('matches by cwd through path normalization (separator + trailing slash)', () => {
    const alpha = candidate({ cwd: 'c:\\code\\alpha' });

    const result = resolveSessionReference([alpha], toRef, 'c:/code/alpha/');

    expect(result).toEqual({ kind: 'found', item: alpha });
  });

  it('reports notFound when nothing matches any method', () => {
    const alpha = candidate();

    const result = resolveSessionReference([alpha], toRef, 'nothing-matches-this');

    expect(result).toEqual({ kind: 'notFound' });
  });

  /**
   * The exact scenario S3-T5 exists for: dozens of sessions launched from the same directory. A
   * bare `cwd` match is no longer treated as identifying ONE session — two matches is refused
   * outright, not silently narrowed by picking whichever came first (the old `Array#find`
   * behavior this replaces).
   */
  it('two sessions sharing a cwd: matching by that cwd is ambiguous, never picks one', () => {
    const alpha = candidate({ sessionId: '11111111-1111-4111-8111-111111111111', name: 'alpha' });
    const beta = candidate({ sessionId: '22222222-2222-4222-8222-222222222222', name: 'beta' });

    const result = resolveSessionReference([alpha, beta], toRef, alpha.cwd);

    expect(result.kind).toBe('ambiguous');
    if (result.kind === 'ambiguous') {
      expect(result.matches).toEqual([alpha, beta]);
    }
  });

  it('a sessionId prefix matching two sessions is ambiguous, never picks one', () => {
    const alpha = candidate({ sessionId: '88881111-0000-4000-8000-000000000000', name: 'alpha' });
    const beta = candidate({ sessionId: '88882222-0000-4000-8000-000000000000', name: 'beta' });

    const result = resolveSessionReference([alpha, beta], toRef, '8888');

    expect(result.kind).toBe('ambiguous');
  });

  it('an exact sessionId match is authoritative even if the value would also prefix-match another', () => {
    const exact = candidate({ sessionId: '88881111', name: 'exact' });
    const alsoPrefixed = candidate({
      sessionId: '88881111-more-suffix-that-would-also-prefix-match',
      name: 'longer',
    });

    const result = resolveSessionReference([exact, alsoPrefixed], toRef, '88881111');

    expect(result).toEqual({ kind: 'found', item: exact });
  });

  it('empty string never matches everything by "prefix" — treated as notFound rather than ambiguous-with-all', () => {
    const alpha = candidate();
    const beta = candidate({
      sessionId: '22222222-2222-4222-8222-222222222222',
      name: 'beta',
      cwd: 'c:\\code\\beta',
    });

    const result = resolveSessionReference([alpha, beta], toRef, '');

    expect(result).toEqual({ kind: 'notFound' });
  });
});

describe('resolveSessionReferenceForAdoption (V2-T55 item 1)', () => {
  it('a windowed match is returned as-is, never touching the direct lookup', async () => {
    const alpha = fullDiscoveredSession({ name: 'alpha' });
    const lookup = new StubSessionIdLookup();

    const result = await resolveSessionReferenceForAdoption([alpha], lookup, 'alpha');

    expect(result).toEqual({ kind: 'found', item: alpha });
    expect(lookup.calls).toEqual([]);
  });

  it('a windowed ambiguous match is returned as-is, never escalating to the direct lookup', async () => {
    const alpha = fullDiscoveredSession({ sessionId: '88881111-0000-4000-8000-000000000000' });
    const beta = fullDiscoveredSession({ sessionId: '88882222-0000-4000-8000-000000000000' });
    const lookup = new StubSessionIdLookup();

    const result = await resolveSessionReferenceForAdoption([alpha, beta], lookup, '8888');

    expect(result.kind).toBe('ambiguous');
    expect(lookup.calls).toEqual([]);
  });

  it('an id-shaped value not found in the window falls back to the direct lookup', async () => {
    const found = fullDiscoveredSession({ sessionId: '11111111-1111-4111-8111-111111111111' });
    const lookup = new StubSessionIdLookup({ kind: 'found', session: found });

    const result = await resolveSessionReferenceForAdoption([], lookup, '11111111');

    expect(result).toEqual({ kind: 'found', item: found });
    expect(lookup.calls).toEqual(['11111111']);
  });

  it('the direct lookup returning ambiguous is surfaced as ambiguous, never picked', async () => {
    const a = fullDiscoveredSession({ sessionId: '11111111-1111-4111-8111-111111111111' });
    const b = fullDiscoveredSession({ sessionId: '11112222-2222-4222-8222-222222222222' });
    const lookup = new StubSessionIdLookup({ kind: 'ambiguous', candidates: [a, b] });

    const result = await resolveSessionReferenceForAdoption([], lookup, '1111');

    expect(result).toEqual({ kind: 'ambiguous', matches: [a, b] });
  });

  it('a value that does not look like an id never reaches the direct lookup, even unmatched in the window', async () => {
    const lookup = new StubSessionIdLookup({ kind: 'found', session: fullDiscoveredSession() });

    const result = await resolveSessionReferenceForAdoption([], lookup, 'my-project-folder');

    expect(result).toEqual({ kind: 'notFound' });
    expect(lookup.calls).toEqual([]);
  });

  it('the direct lookup itself finding nothing is a plain notFound', async () => {
    const lookup = new StubSessionIdLookup({ kind: 'notFound' });

    const result = await resolveSessionReferenceForAdoption([], lookup, 'deadbeef');

    expect(result).toEqual({ kind: 'notFound' });
  });
});

describe('toDiscoveredSessionReference', () => {
  it('projects the three fields resolveSessionReference matches against, nothing else', () => {
    const session: DiscoveredSession = {
      sessionId: '11111111-1111-4111-8111-111111111111',
      cwd: 'c:\\code\\alpha',
      name: 'alpha',
      hasTranscript: true,
      lastTranscriptWrite: null,
      lastActivity: null,
      hasPid: false,
    };
    expect(toDiscoveredSessionReference(session)).toEqual({
      sessionId: session.sessionId,
      cwd: session.cwd,
      name: session.name,
    });
  });
});
