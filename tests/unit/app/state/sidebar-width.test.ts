import { describe, expect, it } from 'vitest';
import {
  clampSidebarWidth,
  DEFAULT_SIDEBAR_WIDTH,
  encodeSidebarWidthPreference,
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  parseSidebarWidthPreference,
} from '../../../../packages/app/src/state/sidebar-width.js';

describe('clampSidebarWidth', () => {
  it('leaves an in-range width untouched', () => {
    expect(clampSidebarWidth(300)).toBe(300);
  });

  it('clamps below the minimum', () => {
    expect(clampSidebarWidth(10)).toBe(MIN_SIDEBAR_WIDTH);
  });

  it('clamps above the maximum', () => {
    expect(clampSidebarWidth(10_000)).toBe(MAX_SIDEBAR_WIDTH);
  });
});

describe('parseSidebarWidthPreference', () => {
  it('a stored numeric string parses to that width', () => {
    expect(parseSidebarWidthPreference('320')).toBe(320);
  });

  it('D-025: absence (nothing stored yet) reads as the default width, never a guess', () => {
    expect(parseSidebarWidthPreference(null)).toBe(DEFAULT_SIDEBAR_WIDTH);
  });

  it('a malformed value is never trusted, reads as the default', () => {
    expect(parseSidebarWidthPreference('oops')).toBe(DEFAULT_SIDEBAR_WIDTH);
  });

  it('an empty string is never trusted, reads as the default', () => {
    expect(parseSidebarWidthPreference('')).toBe(DEFAULT_SIDEBAR_WIDTH);
  });

  it('a stored value out of range is clamped back into range, not rejected outright', () => {
    expect(parseSidebarWidthPreference('20')).toBe(MIN_SIDEBAR_WIDTH);
    expect(parseSidebarWidthPreference('9999')).toBe(MAX_SIDEBAR_WIDTH);
  });
});

describe('encodeSidebarWidthPreference', () => {
  it('round-trips through parseSidebarWidthPreference', () => {
    const encoded = encodeSidebarWidthPreference(340);
    expect(parseSidebarWidthPreference(encoded)).toBe(340);
  });

  it('clamps before encoding — an out-of-range width is never persisted as-is', () => {
    expect(encodeSidebarWidthPreference(10)).toBe(String(MIN_SIDEBAR_WIDTH));
  });
});
