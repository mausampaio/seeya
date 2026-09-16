import { describe, expect, it } from 'vitest';
import { PendingFallbackRequests } from '../../../../packages/app/src/resume/pending-fallback-requests.js';

describe('PendingFallbackRequests', () => {
  it('resolves the answer promise once resolve() is called with the matching requestId', async () => {
    const pending = new PendingFallbackRequests();
    const { requestId, answer } = pending.create();

    pending.resolve(requestId, 'open');

    await expect(answer).resolves.toBe('open');
  });

  it('two independent requests each resolve to their own answer, never crossed', async () => {
    const pending = new PendingFallbackRequests();
    const first = pending.create();
    const second = pending.create();
    expect(first.requestId).not.toBe(second.requestId);

    pending.resolve(second.requestId, 'skip');
    pending.resolve(first.requestId, 'open');

    await expect(first.answer).resolves.toBe('open');
    await expect(second.answer).resolves.toBe('skip');
  });

  it('resolving an unknown requestId is a silent no-op (never throws)', () => {
    const pending = new PendingFallbackRequests();

    expect(() => pending.resolve('does-not-exist', 'skip')).not.toThrow();
  });

  it('resolving the same requestId twice only honors the first answer', async () => {
    const pending = new PendingFallbackRequests();
    const { requestId, answer } = pending.create();

    pending.resolve(requestId, 'open');
    expect(() => pending.resolve(requestId, 'skip')).not.toThrow();

    await expect(answer).resolves.toBe('open');
  });
});
