import { describe, expect, it } from 'vitest';
import { isValidProjectId } from '@seeya-ai/engine/core/project-id.js';

describe('isValidProjectId', () => {
  it('accepts a single lowercase word', () => {
    expect(isValidProjectId('auth')).toBe(true);
  });

  it('accepts lowercase words joined by hyphens', () => {
    expect(isValidProjectId('auth-hardening')).toBe(true);
  });

  it('accepts digits mixed with letters', () => {
    expect(isValidProjectId('v2-migration')).toBe(true);
  });

  it('rejects the empty string', () => {
    expect(isValidProjectId('')).toBe(false);
  });

  it('rejects uppercase letters', () => {
    expect(isValidProjectId('Auth-Hardening')).toBe(false);
  });

  it('rejects a space', () => {
    expect(isValidProjectId('auth hardening')).toBe(false);
  });

  it('rejects a leading hyphen', () => {
    expect(isValidProjectId('-auth')).toBe(false);
  });

  it('rejects a trailing hyphen', () => {
    expect(isValidProjectId('auth-')).toBe(false);
  });

  it('rejects a double hyphen', () => {
    expect(isValidProjectId('auth--hardening')).toBe(false);
  });

  it('rejects a path separator — the case that matters most (this becomes a directory name)', () => {
    expect(isValidProjectId('auth/hardening')).toBe(false);
    expect(isValidProjectId('auth\\hardening')).toBe(false);
  });

  it('rejects a path-escape attempt', () => {
    expect(isValidProjectId('..')).toBe(false);
    expect(isValidProjectId('../escape')).toBe(false);
  });

  it('rejects a dot', () => {
    expect(isValidProjectId('.')).toBe(false);
  });
});
