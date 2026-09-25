/**
 * `decideAdoptedCopyGrowth` (V2-T32, `packages/engine/src/core/adopted-copy-growth.ts`) — pure
 * over `ForkActivityCheck`.
 */
import { describe, expect, it } from 'vitest';
import { decideAdoptedCopyGrowth } from '@seeya-ai/engine/core/adopted-copy-growth.js';

const ADOPTED_AT = new Date('2026-09-24T10:00:00.000Z');

describe('decideAdoptedCopyGrowth', () => {
  it('is unknown when the transcript could not be found (D-025 — never read as unchanged)', () => {
    expect(decideAdoptedCopyGrowth({ kind: 'notFound' }, ADOPTED_AT)).toStrictEqual({
      kind: 'unknown',
    });
  });

  it('is unchanged when the last write is at or before adoptedAt', () => {
    expect(
      decideAdoptedCopyGrowth({ kind: 'found', lastWrite: ADOPTED_AT, sizeBytes: 100 }, ADOPTED_AT),
    ).toStrictEqual({ kind: 'unchanged' });

    const before = new Date(ADOPTED_AT.getTime() - 1000);
    expect(
      decideAdoptedCopyGrowth({ kind: 'found', lastWrite: before, sizeBytes: 100 }, ADOPTED_AT),
    ).toStrictEqual({ kind: 'unchanged' });
  });

  it('is grew, carrying the last write and size, when the transcript was written to after adoptedAt', () => {
    const after = new Date(ADOPTED_AT.getTime() + 1000);
    expect(
      decideAdoptedCopyGrowth({ kind: 'found', lastWrite: after, sizeBytes: 4096 }, ADOPTED_AT),
    ).toStrictEqual({ kind: 'grew', lastWrite: after, sizeBytes: 4096 });
  });
});
