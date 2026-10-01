import { describe, expect, it } from 'vitest';
import {
  encodeSidebarCollapsedPreference,
  parseSidebarCollapsedPreference,
  sidebarToggleButtonLabel,
} from '../../../../packages/app/src/state/sidebar-collapse.js';

describe('parseSidebarCollapsedPreference (V2-T30 item 2)', () => {
  it('the literal encoded "true" is collapsed', () => {
    expect(parseSidebarCollapsedPreference('true')).toBe(true);
  });

  it('the literal encoded "false" is expanded', () => {
    expect(parseSidebarCollapsedPreference('false')).toBe(false);
  });

  it('no value stored yet opens expanded (D-025 — absence is not a decision)', () => {
    expect(parseSidebarCollapsedPreference(null)).toBe(false);
  });

  it('a malformed value opens expanded too, never trusted as a guess', () => {
    expect(parseSidebarCollapsedPreference('yes')).toBe(false);
    expect(parseSidebarCollapsedPreference('1')).toBe(false);
    expect(parseSidebarCollapsedPreference('')).toBe(false);
  });
});

describe('encodeSidebarCollapsedPreference', () => {
  it('round-trips through parseSidebarCollapsedPreference', () => {
    expect(parseSidebarCollapsedPreference(encodeSidebarCollapsedPreference(true))).toBe(true);
    expect(parseSidebarCollapsedPreference(encodeSidebarCollapsedPreference(false))).toBe(false);
  });
});

describe('sidebarToggleButtonLabel (maintainer acceptance, 2026-09-25; icon since V2-T64 PO review)', () => {
  it('collapsed: the icon offers to expand it again, and the tooltip names the shortcut', () => {
    expect(sidebarToggleButtonLabel(true)).toEqual({
      icon: 'expand',
      tooltip: 'Show sidebar (Ctrl+B)',
    });
  });

  it('expanded: the icon offers to collapse it, and the tooltip names the shortcut', () => {
    expect(sidebarToggleButtonLabel(false)).toEqual({
      icon: 'collapse',
      tooltip: 'Hide sidebar (Ctrl+B)',
    });
  });
});
