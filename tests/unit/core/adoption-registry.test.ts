/**
 * `findAdoptionRecord` (V2-T29, `packages/engine/src/core/adoption-registry.ts`) — pure over
 * `AdoptionRecord[]`.
 */
import { describe, expect, it } from 'vitest';
import { findAdoptionRecord } from '@seeya-ai/engine/core/adoption-registry.js';
import type { AdoptionRecord } from '@seeya-ai/engine/core/types.js';

const RECORD: AdoptionRecord = {
  originalSessionId: '11111111-1111-4111-8111-111111111111',
  forkSessionId: '22222222-2222-4222-8222-222222222222',
  projectId: 'auth-hardening',
  adoptedAt: new Date('2026-09-24T10:00:00.000Z'),
};

describe('findAdoptionRecord', () => {
  it('returns the record whose originalSessionId matches', () => {
    expect(findAdoptionRecord([RECORD], RECORD.originalSessionId)).toStrictEqual(RECORD);
  });

  it('returns null when nothing matches (D-025 — no claim either way)', () => {
    expect(findAdoptionRecord([RECORD], '99999999-9999-4999-8999-999999999999')).toBeNull();
  });

  it('returns null for an empty registry', () => {
    expect(findAdoptionRecord([], RECORD.originalSessionId)).toBeNull();
  });

  it('never matches on forkSessionId — only originalSessionId identifies "already adopted"', () => {
    expect(findAdoptionRecord([RECORD], RECORD.forkSessionId)).toBeNull();
  });
});
