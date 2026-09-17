import { describe, expect, it } from 'vitest';
import {
  deriveWindowsPtyOptions,
  resolveTerminalOptions,
} from '../../../../packages/app/src/state/terminal-options.js';

describe('resolveTerminalOptions (V2-T3/V2-T6)', () => {
  it('reads terminalFontFamily/terminalFontSize straight off the config, and carries windowsPty through unchanged', () => {
    const options = resolveTerminalOptions(
      { terminalFontFamily: "'Cascadia Code', monospace", terminalFontSize: 16 },
      { backend: 'conpty', buildNumber: 26200 },
    );

    expect(options).toEqual({
      fontFamily: "'Cascadia Code', monospace",
      fontSize: 16,
      windowsPty: { backend: 'conpty', buildNumber: 26200 },
    });
  });

  it('is insensitive to every other Config field (Pick, not the whole Config)', () => {
    const options = resolveTerminalOptions(
      { terminalFontFamily: "'FiraCode Nerd Font Mono', monospace", terminalFontSize: 14 },
      undefined,
    );

    expect(options.fontFamily).toBe("'FiraCode Nerd Font Mono', monospace");
    expect(options.fontSize).toBe(14);
  });

  it('passes windowsPty through as undefined without inventing a value (D-025)', () => {
    const options = resolveTerminalOptions(
      { terminalFontFamily: 'monospace', terminalFontSize: 14 },
      undefined,
    );

    expect(options.windowsPty).toBeUndefined();
  });
});

describe('deriveWindowsPtyOptions (V2-T6)', () => {
  it('parses a real Windows 11 release (10.0.26200) into a build number', () => {
    expect(deriveWindowsPtyOptions('win32', '10.0.26200')).toEqual({
      backend: 'conpty',
      buildNumber: 26200,
    });
  });

  it('is undefined off Windows, regardless of what release looks like', () => {
    expect(deriveWindowsPtyOptions('linux', '6.8.0')).toBeUndefined();
    expect(deriveWindowsPtyOptions('darwin', '23.5.0')).toBeUndefined();
    // Even a release string shaped like Windows's own MAJOR.MINOR.BUILD stays undefined off
    // Windows — this option only ever means something to a ConPTY-hosted pty.
    expect(deriveWindowsPtyOptions('linux', '10.0.26200')).toBeUndefined();
  });

  it('is undefined on Windows when release does not parse to a build number (D-025: no number, no claim)', () => {
    expect(deriveWindowsPtyOptions('win32', 'unknown')).toBeUndefined();
    expect(deriveWindowsPtyOptions('win32', '10.0')).toBeUndefined();
    expect(deriveWindowsPtyOptions('win32', '10.0.abc')).toBeUndefined();
    expect(deriveWindowsPtyOptions('win32', '')).toBeUndefined();
  });

  it('reports the ConPTY backend, never winpty (nothing in this app targets winpty)', () => {
    const result = deriveWindowsPtyOptions('win32', '10.0.19045');

    expect(result?.backend).toBe('conpty');
  });
});
