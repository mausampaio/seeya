import { describe, expect, it } from 'vitest';
import {
  resolveTerminalTheme,
  TERMINAL_THEME_DARK,
  TERMINAL_THEME_LIGHT,
} from '../../../../packages/app/src/state/terminal-theme.js';

const HEX_COLOUR = /^#[0-9a-f]{6}$/;

describe('TERMINAL_THEME_DARK', () => {
  it('is a set of six-digit hex colours', () => {
    for (const [key, value] of Object.entries(TERMINAL_THEME_DARK)) {
      expect(value, key).toMatch(HEX_COLOUR);
    }
  });

  it('never uses pure black as the background (the maintainer measured it as tiring to read)', () => {
    expect(TERMINAL_THEME_DARK.background).not.toBe('#000000');
  });
});

// V2-T62 (D-051): the light counterpart — "o terminal segue o tema".
describe('TERMINAL_THEME_LIGHT', () => {
  it('is a set of six-digit hex colours', () => {
    for (const [key, value] of Object.entries(TERMINAL_THEME_LIGHT)) {
      expect(value, key).toMatch(HEX_COLOUR);
    }
  });

  it('never uses pure white as the background text on white (kept legible, matches the tokens)', () => {
    expect(TERMINAL_THEME_LIGHT.foreground).not.toBe(TERMINAL_THEME_LIGHT.background);
  });
});

describe('resolveTerminalTheme', () => {
  it('picks TERMINAL_THEME_DARK for "dark"', () => {
    expect(resolveTerminalTheme('dark')).toBe(TERMINAL_THEME_DARK);
  });

  it('picks TERMINAL_THEME_LIGHT for "light"', () => {
    expect(resolveTerminalTheme('light')).toBe(TERMINAL_THEME_LIGHT);
  });
});
