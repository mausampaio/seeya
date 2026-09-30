import { describe, expect, it } from 'vitest';
import { toggleFavoriteProjectId } from '@seeya-ai/engine/core/favorite-projects.js';

describe('toggleFavoriteProjectId (V2-T63)', () => {
  it('adds a project id when favoriting', () => {
    expect(toggleFavoriteProjectId(['billing'], 'auth-hardening', true)).toEqual([
      'billing',
      'auth-hardening',
    ]);
  });

  it('removes a project id when unfavoriting', () => {
    expect(toggleFavoriteProjectId(['billing', 'auth-hardening'], 'billing', false)).toEqual([
      'auth-hardening',
    ]);
  });

  it('favoriting an already-favorited id is a no-op (never duplicates)', () => {
    expect(toggleFavoriteProjectId(['billing'], 'billing', true)).toEqual(['billing']);
  });

  it('unfavoriting an id that was never favorited is a no-op', () => {
    expect(toggleFavoriteProjectId(['billing'], 'auth-hardening', false)).toEqual(['billing']);
  });

  it('starting from an empty list, favoriting adds the one id', () => {
    expect(toggleFavoriteProjectId([], 'auth-hardening', true)).toEqual(['auth-hardening']);
  });
});
