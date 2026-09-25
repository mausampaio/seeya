/**
 * `findSessionByIdPrefix` against a real filesystem, but a fake `~/.claude` + `~/.seeya` built in
 * `tmpdir` (same pattern as `transcript-scan.test.ts`). V2-T55 item 1: this is the direct,
 * `relevanceHours`-ignoring lookup — every fixture below places its transcript OUTSIDE the
 * relevance window transcript-scan.ts would use, to prove that window never gates this path.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { rm } from 'node:fs/promises';
import { findSessionByIdPrefix } from '@seeya-ai/engine/adapters/discovery/index.js';
import {
  createDiscoveryFixture,
  removeDiscoveryFixture,
  transcriptLine,
  writeForksJson,
  writeTranscriptWithContent,
  writeUnreadableTranscriptPlaceholder,
  type DiscoveryFixture,
} from './_fixtures.js';

const NOW = new Date('2026-09-25T12:00:00.000Z');
// Deliberately much older than any `relevanceHours` default (12h) — every session in this file is
// the "closed more than a day ago" case V2-T55 exists for.
const LONG_CLOSED = new Date(NOW.getTime() - 30 * 3_600_000);

const SESSION_A = '11111111-1111-4111-8111-111111111111';
const SESSION_B = '11112222-2222-4222-8222-222222222222';
const FORK_OF_A = '11119999-9999-4999-8999-999999999999';

let fixture: DiscoveryFixture | undefined;

afterEach(async () => {
  if (fixture !== undefined) {
    await removeDiscoveryFixture(fixture);
    fixture = undefined;
  }
});

async function lookup(idPrefix: string) {
  if (fixture === undefined) {
    throw new Error('call createDiscoveryFixture() first');
  }
  return findSessionByIdPrefix(idPrefix, {
    claudeHome: fixture.claudeHome,
    seeyaHome: fixture.seeyaHome,
  });
}

describe('findSessionByIdPrefix', () => {
  it('finds a session by its full id, even long closed and well outside relevanceHours', async () => {
    fixture = await createDiscoveryFixture();
    await writeTranscriptWithContent(
      fixture,
      'c--code-old',
      SESSION_A,
      transcriptLine('c:\\code\\old'),
      LONG_CLOSED,
    );

    const outcome = await lookup(SESSION_A);

    expect(outcome.kind).toBe('found');
    if (outcome.kind !== 'found') throw new Error('expected found');
    expect(outcome.session.hasPid).toBe(false);
    expect(outcome.session.sessionId).toBe(SESSION_A);
    expect(outcome.session.cwd).toBe('c:\\code\\old');
  });

  it('finds a session by a unique prefix', async () => {
    fixture = await createDiscoveryFixture();
    await writeTranscriptWithContent(
      fixture,
      'c--code-old',
      SESSION_A,
      transcriptLine('c:\\code\\old'),
      LONG_CLOSED,
    );

    const outcome = await lookup('11111111');

    expect(outcome.kind).toBe('found');
  });

  it('a prefix matching more than one session is ambiguous, never picks one (D-025)', async () => {
    fixture = await createDiscoveryFixture();
    await writeTranscriptWithContent(
      fixture,
      'c--code-a',
      SESSION_A,
      transcriptLine('c:\\code\\a'),
      LONG_CLOSED,
    );
    await writeTranscriptWithContent(
      fixture,
      'c--code-b',
      SESSION_B,
      transcriptLine('c:\\code\\b'),
      LONG_CLOSED,
    );

    const outcome = await lookup('1111');

    expect(outcome.kind).toBe('ambiguous');
    if (outcome.kind !== 'ambiguous') throw new Error('expected ambiguous');
    expect(outcome.candidates.map((c) => c.sessionId).sort()).toEqual(
      [SESSION_A, SESSION_B].sort(),
    );
  });

  it('a prefix matching nothing is notFound, not an error', async () => {
    fixture = await createDiscoveryFixture();
    await writeTranscriptWithContent(
      fixture,
      'c--code-a',
      SESSION_A,
      transcriptLine('c:\\code\\a'),
      LONG_CLOSED,
    );

    const outcome = await lookup('deadbeef');

    expect(outcome).toEqual({ kind: 'notFound' });
  });

  it('a missing projects directory is notFound, not a crash', async () => {
    fixture = await createDiscoveryFixture();
    await rm(fixture.projectsDir, { recursive: true, force: true });

    const outcome = await lookup(SESSION_A);

    expect(outcome).toEqual({ kind: 'notFound' });
  });

  it('D-012: a registered fork is excluded even when its id matches the prefix', async () => {
    fixture = await createDiscoveryFixture();
    await writeTranscriptWithContent(
      fixture,
      'c--code-fork',
      FORK_OF_A,
      transcriptLine('c:\\code\\fork'),
      LONG_CLOSED,
    );
    await writeForksJson(fixture, [{ sessionId: FORK_OF_A, createdAt: LONG_CLOSED.toISOString() }]);

    const outcome = await lookup(FORK_OF_A);

    expect(outcome).toEqual({ kind: 'notFound' });
  });

  /**
   * Cost proof (V2-T55's own "dizer no relatório o custo"): a transcript whose FILE NAME doesn't
   * match the prefix is never opened. `writeUnreadableTranscriptPlaceholder` makes content reading
   * fail immediately (`EISDIR`) — if `findSessionByIdPrefix` ever tried to read it, the lookup
   * would throw instead of returning `notFound` cleanly, since nothing here catches an `EISDIR`
   * from `readCwdFromTranscript` (only `processTranscriptFile`'s own try/catch would, and this
   * test would then see a `rejected`-shaped outcome instead of a clean notFound if that path were
   * ever reached for a non-matching name — it never resolves at all with this module's own filter,
   * which is the exact behavior this test locks in).
   */
  it('a non-matching file name is never opened (name filter runs before any read)', async () => {
    fixture = await createDiscoveryFixture();
    await writeUnreadableTranscriptPlaceholder(fixture, 'c--code-noise', SESSION_B, LONG_CLOSED);

    const outcome = await lookup(SESSION_A);

    expect(outcome).toEqual({ kind: 'notFound' });
  });
});
