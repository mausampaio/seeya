import { describe, expect, it } from 'vitest';
import { PendingConfirmations } from '../../../../packages/app/src/resume/pending-confirmations.js';

describe('PendingConfirmations (V2-T30)', () => {
  it('resolves the promise create() returned when resolve() is called with the same requestId', async () => {
    const pending = new PendingConfirmations<'proceed' | 'decline'>('open-lock');
    const { requestId, answer } = pending.create();

    pending.resolve(requestId, 'proceed');

    await expect(answer).resolves.toBe('proceed');
  });

  it('each request gets its own independent id, even for the same instance', () => {
    const pending = new PendingConfirmations<'commit' | 'decline'>('adopt-commit');
    const first = pending.create();
    const second = pending.create();

    expect(first.requestId).not.toBe(second.requestId);
  });

  it('resolving a stale or unknown id is a silent no-op, never a throw', () => {
    const pending = new PendingConfirmations<'proceed' | 'decline'>('open-lock');

    expect(() => pending.resolve('open-lock-999', 'decline')).not.toThrow();
  });

  it('resolving twice for the same id only delivers to the first answer — the second is a no-op', async () => {
    const pending = new PendingConfirmations<'proceed' | 'decline'>('open-lock');
    const { requestId, answer } = pending.create();

    pending.resolve(requestId, 'proceed');
    expect(() => pending.resolve(requestId, 'decline')).not.toThrow();

    await expect(answer).resolves.toBe('proceed');
  });
});
