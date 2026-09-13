import { describe, expect, it } from 'vitest';
import { buildAutostart } from '../../../../src/adapters/autostart/index.js';
import { WindowsAutostart } from '../../../../src/adapters/autostart/windows.js';
import { LinuxAutostart } from '../../../../src/adapters/autostart/linux.js';
import { MacosAutostart } from '../../../../src/adapters/autostart/macos.js';

describe('buildAutostart', () => {
  it('picks WindowsAutostart on win32', () => {
    expect(buildAutostart('/home/<usuario>', 'win32')).toBeInstanceOf(WindowsAutostart);
  });

  it('picks MacosAutostart on darwin', () => {
    expect(buildAutostart('/Users/<usuario>', 'darwin')).toBeInstanceOf(MacosAutostart);
  });

  it('picks LinuxAutostart on linux', () => {
    expect(buildAutostart('/home/<usuario>', 'linux')).toBeInstanceOf(LinuxAutostart);
  });

  it('falls back to LinuxAutostart for an unrecognized platform', () => {
    expect(buildAutostart('/home/<usuario>', 'aix')).toBeInstanceOf(LinuxAutostart);
  });
});
