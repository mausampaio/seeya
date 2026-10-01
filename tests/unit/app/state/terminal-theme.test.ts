import { describe, expect, it } from 'vitest';
import {
  buildTerminalThemeFromTokens,
  FALLBACK_TERMINAL_THEME,
} from '../../../../packages/app/src/state/terminal-theme.js';

const HEX_COLOUR = /^#[0-9a-f]{6}$/;

describe('FALLBACK_TERMINAL_THEME', () => {
  it('is a set of six-digit hex colours', () => {
    for (const [key, value] of Object.entries(FALLBACK_TERMINAL_THEME)) {
      expect(value, key).toMatch(HEX_COLOUR);
    }
  });

  it('never uses pure black as the background (the maintainer measured it as tiring to read)', () => {
    expect(FALLBACK_TERMINAL_THEME.background).not.toBe('#000000');
  });
});

// PO review (2026-10-01): the terminal's own colours now come straight from the same CSS tokens
// every other surface in the window reads — `buildTerminalThemeFromTokens` is the pure function
// that shape maps through (the DOM read itself lives in `renderer/legacy/theme-view.ts`, outside
// this module on purpose, so this stays testable with made-up strings instead of a real window).
describe('buildTerminalThemeFromTokens', () => {
  it('background/foreground/cursor map straight from the resolved background/text tokens', () => {
    const theme = buildTerminalThemeFromTokens({
      background: '#18181d',
      text: '#f7f7f8',
      brandSoft: '#25214e',
    });
    expect(theme.background).toBe('#18181d');
    expect(theme.foreground).toBe('#f7f7f8');
    expect(theme.cursor).toBe('#f7f7f8');
  });

  it('selection background maps from the resolved brand-soft token', () => {
    const theme = buildTerminalThemeFromTokens({
      background: '#ffffff',
      text: '#121214',
      brandSoft: '#eceaff',
    });
    expect(theme.selectionBackground).toBe('#eceaff');
  });

  it('never uses the same colour for foreground and background — kept legible whatever the two resolved tokens are', () => {
    const theme = buildTerminalThemeFromTokens({
      background: '#ffffff',
      text: '#121214',
      brandSoft: '#eceaff',
    });
    expect(theme.foreground).not.toBe(theme.background);
  });
});
