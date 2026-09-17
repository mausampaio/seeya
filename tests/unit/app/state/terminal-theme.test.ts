import { describe, expect, it } from 'vitest';
import { TERMINAL_THEME } from '../../../../packages/app/src/state/terminal-theme.js';

const HEX_COLOUR = /^#[0-9a-f]{6}$/;

describe('TERMINAL_THEME', () => {
  it('is a set of six-digit hex colours', () => {
    for (const [key, value] of Object.entries(TERMINAL_THEME)) {
      expect(value, key).toMatch(HEX_COLOUR);
    }
  });

  it('never uses pure black as the background (the maintainer measured it as tiring to read)', () => {
    expect(TERMINAL_THEME.background).not.toBe('#000000');
  });
});
