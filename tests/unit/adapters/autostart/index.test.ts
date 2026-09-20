import { describe, expect, it } from 'vitest';
import { buildAutostart } from '@seeya-ai/engine/adapters/autostart/index.js';
import { WindowsAutostart } from '@seeya-ai/engine/adapters/autostart/windows.js';
import { LinuxAutostart } from '@seeya-ai/engine/adapters/autostart/linux.js';
import { MacosAutostart } from '@seeya-ai/engine/adapters/autostart/macos.js';

const SEEYA_HOME = '/home/<usuario>/.seeya';

describe('buildAutostart', () => {
  it('picks WindowsAutostart on win32', () => {
    expect(buildAutostart('/home/<usuario>', SEEYA_HOME, 'win32')).toBeInstanceOf(WindowsAutostart);
  });

  it('picks MacosAutostart on darwin', () => {
    expect(buildAutostart('/Users/<usuario>', SEEYA_HOME, 'darwin')).toBeInstanceOf(MacosAutostart);
  });

  it('picks LinuxAutostart on linux', () => {
    expect(buildAutostart('/home/<usuario>', SEEYA_HOME, 'linux')).toBeInstanceOf(LinuxAutostart);
  });

  it('falls back to LinuxAutostart for an unrecognized platform', () => {
    expect(buildAutostart('/home/<usuario>', SEEYA_HOME, 'aix')).toBeInstanceOf(LinuxAutostart);
  });
});
