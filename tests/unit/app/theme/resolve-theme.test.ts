import { describe, expect, it } from 'vitest';
import { resolveEffectiveTheme } from '../../../../packages/app/src/theme/resolve-theme.js';

describe('resolveEffectiveTheme (V2-T62, D-051)', () => {
  it('"system" follows the OS when it prefers dark', () => {
    expect(resolveEffectiveTheme('system', true)).toBe('dark');
  });

  it('"system" follows the OS when it prefers light', () => {
    expect(resolveEffectiveTheme('system', false)).toBe('light');
  });

  it('a pinned "light" ignores the OS signal either way', () => {
    expect(resolveEffectiveTheme('light', true)).toBe('light');
    expect(resolveEffectiveTheme('light', false)).toBe('light');
  });

  it('a pinned "dark" ignores the OS signal either way', () => {
    expect(resolveEffectiveTheme('dark', true)).toBe('dark');
    expect(resolveEffectiveTheme('dark', false)).toBe('dark');
  });
});
