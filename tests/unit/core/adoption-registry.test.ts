/**
 * `findAdoptionRecord` (V2-T29, `packages/engine/src/core/adoption-registry.ts`) — pure over
 * `AdoptionRecord[]`.
 */
import { describe, expect, it } from 'vitest';
import {
  findAdoptionRecord,
  selectProjectAdoption,
} from '@seeya-ai/engine/core/adoption-registry.js';
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

/** V2-T32 item 5: `revert-adoption <id> [<session>]`'s own selection. */
describe('selectProjectAdoption', () => {
  const SECOND: AdoptionRecord = {
    originalSessionId: '33333333-3333-4333-8333-333333333333',
    forkSessionId: '44444444-4444-4444-8444-444444444444',
    projectId: 'auth-hardening',
    adoptedAt: new Date('2026-09-24T11:00:00.000Z'),
  };
  const OTHER_PROJECT: AdoptionRecord = {
    originalSessionId: '55555555-5555-4555-8555-555555555555',
    forkSessionId: '66666666-6666-4666-8666-666666666666',
    projectId: 'billing-v2',
    adoptedAt: new Date('2026-09-24T12:00:00.000Z'),
  };

  it('is noneForProject when the project has no adoption at all', () => {
    expect(selectProjectAdoption([OTHER_PROJECT], 'auth-hardening', undefined)).toStrictEqual({
      kind: 'noneForProject',
    });
  });

  it('finds the one adoption when the project has exactly one and no session was given', () => {
    expect(
      selectProjectAdoption([RECORD, OTHER_PROJECT], 'auth-hardening', undefined),
    ).toStrictEqual({ kind: 'found', record: RECORD });
  });

  it('is ambiguous when the project has more than one adoption and no session was given', () => {
    const result = selectProjectAdoption(
      [RECORD, SECOND, OTHER_PROJECT],
      'auth-hardening',
      undefined,
    );
    expect(result.kind).toBe('ambiguous');
    expect(result.kind === 'ambiguous' && result.matches).toStrictEqual([RECORD, SECOND]);
  });

  it('matches an exact originalSessionId or forkSessionId over a prefix', () => {
    expect(
      selectProjectAdoption([RECORD, SECOND], 'auth-hardening', RECORD.originalSessionId),
    ).toStrictEqual({ kind: 'found', record: RECORD });
    expect(
      selectProjectAdoption([RECORD, SECOND], 'auth-hardening', SECOND.forkSessionId),
    ).toStrictEqual({ kind: 'found', record: SECOND });
  });

  it('matches a prefix of either id when no exact match exists', () => {
    expect(selectProjectAdoption([RECORD, SECOND], 'auth-hardening', '2222')).toStrictEqual({
      kind: 'found',
      record: RECORD,
    });
  });

  it('is notFound when the reference matches neither id, exactly or by prefix', () => {
    expect(selectProjectAdoption([RECORD, SECOND], 'auth-hardening', 'zzzz')).toStrictEqual({
      kind: 'notFound',
    });
  });

  it('is ambiguous when a prefix matches more than one adoption in the same project', () => {
    const collidingSecond: AdoptionRecord = {
      ...SECOND,
      originalSessionId: '11113333-0000-0000-0000-000000000000',
    };
    const result = selectProjectAdoption([RECORD, collidingSecond], 'auth-hardening', '1111');
    expect(result.kind).toBe('ambiguous');
    expect(result.kind === 'ambiguous' && result.matches).toStrictEqual([RECORD, collidingSecond]);
  });

  it('never matches a record from a different project', () => {
    expect(
      selectProjectAdoption([OTHER_PROJECT], 'auth-hardening', OTHER_PROJECT.originalSessionId),
    ).toStrictEqual({ kind: 'noneForProject' });
  });
});
