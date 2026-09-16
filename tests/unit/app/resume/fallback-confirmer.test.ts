import { describe, expect, it } from 'vitest';
import { buildFallbackConfirmer } from '../../../../packages/app/src/resume/fallback-confirmer.js';
import { PendingFallbackRequests } from '../../../../packages/app/src/resume/pending-fallback-requests.js';
import { buildHandoffFixture } from '../_handoff-fixture.js';
import type { FallbackConfirmRequestEvent } from '../../../../packages/app/src/ipc/channels.js';

describe('buildFallbackConfirmer', () => {
  it('sends one request naming the session, cwd and the exact CLI-shared reason text, and resolves "open" from the answer', async () => {
    const pending = new PendingFallbackRequests();
    const sent: FallbackConfirmRequestEvent[] = [];
    const confirmFallback = buildFallbackConfirmer(pending, (request) => sent.push(request));
    const handoff = buildHandoffFixture({ name: 'project-alpha', cwd: '/projects/alpha' });

    const decisionPromise = confirmFallback(handoff, { kind: 'resumeFailed', exitCode: 1 });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.sessionName).toBe('project-alpha');
    expect(sent[0]?.cwd).toBe('/projects/alpha');
    expect(sent[0]?.reasonText).toContain('could not be resumed');
    expect(sent[0]?.reasonText).toContain('code 1');
    pending.resolve(sent[0]?.requestId ?? '', 'open');

    await expect(decisionPromise).resolves.toEqual({ kind: 'open' });
  });

  it('resolves "skip" from a "skip" answer', async () => {
    const pending = new PendingFallbackRequests();
    const sent: FallbackConfirmRequestEvent[] = [];
    const confirmFallback = buildFallbackConfirmer(pending, (request) => sent.push(request));
    const handoff = buildHandoffFixture();

    const decisionPromise = confirmFallback(handoff, {
      kind: 'promptTooLarge',
      promptLength: 20_000,
      limitChars: 16_384,
    });
    pending.resolve(sent[0]?.requestId ?? '', 'skip');

    await expect(decisionPromise).resolves.toEqual({ kind: 'skip' });
  });

  it('promptTooLarge reason text names the character counts, matching the CLI wording', async () => {
    const pending = new PendingFallbackRequests();
    const sent: FallbackConfirmRequestEvent[] = [];
    const confirmFallback = buildFallbackConfirmer(pending, (request) => sent.push(request));

    const decisionPromise = confirmFallback(buildHandoffFixture(), {
      kind: 'promptTooLarge',
      promptLength: 20_000,
      limitChars: 16_384,
    });
    expect(sent[0]?.reasonText).toContain('20000 characters');
    expect(sent[0]?.reasonText).toContain('limit 16384');
    pending.resolve(sent[0]?.requestId ?? '', 'skip');
    await decisionPromise;
  });
});
