import { describe, expect, it } from 'vitest';
import { looksLikeSessionIdReference } from '@seeya-ai/engine/core/session-id-shape.js';

describe('looksLikeSessionIdReference', () => {
  it('a full sessionId (UUID) looks like an id reference', () => {
    expect(looksLikeSessionIdReference('11111111-1111-4111-8111-111111111111')).toBe(true);
  });

  it('a short hex prefix looks like an id reference', () => {
    expect(looksLikeSessionIdReference('a1b2c3d4')).toBe(true);
  });

  it('a one-character value is too short to trigger a scan', () => {
    expect(looksLikeSessionIdReference('a')).toBe(false);
  });

  it('an empty value is not an id reference', () => {
    expect(looksLikeSessionIdReference('')).toBe(false);
  });

  it('a cwd (has a path separator) is never an id reference', () => {
    expect(looksLikeSessionIdReference('c:\\code\\seeya')).toBe(false);
    expect(looksLikeSessionIdReference('/home/<usuario>/seeya')).toBe(false);
  });

  it('a display name with a non-hex letter is not an id reference', () => {
    expect(looksLikeSessionIdReference('code-6d')).toBe(false);
  });

  it('uppercase hex is still accepted (case-insensitive)', () => {
    expect(looksLikeSessionIdReference('A1B2C3D4')).toBe(true);
  });
});
