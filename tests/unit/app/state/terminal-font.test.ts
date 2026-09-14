import { describe, expect, it } from 'vitest';
import { resolveTerminalFontOptions } from '../../../../packages/app/src/state/terminal-font.js';

describe('resolveTerminalFontOptions (V2-T3)', () => {
  it('reads terminalFontFamily/terminalFontSize straight off the config', () => {
    const options = resolveTerminalFontOptions({
      terminalFontFamily: "'Cascadia Code', monospace",
      terminalFontSize: 16,
    });

    expect(options).toEqual({ fontFamily: "'Cascadia Code', monospace", fontSize: 16 });
  });

  it('is insensitive to every other Config field (Pick, not the whole Config)', () => {
    const options = resolveTerminalFontOptions({
      terminalFontFamily: "'FiraCode Nerd Font Mono', monospace",
      terminalFontSize: 14,
    });

    expect(options.fontFamily).toBe("'FiraCode Nerd Font Mono', monospace");
    expect(options.fontSize).toBe(14);
  });
});
