import { describe, expect, it } from 'vitest';
import { buildAppInstallation } from '@seeya-ai/engine/adapters/installation/index.js';
import { WindowsAppInstallation } from '@seeya-ai/engine/adapters/installation/windows.js';
import { LinuxAppInstallation } from '@seeya-ai/engine/adapters/installation/linux.js';
import { MacosAppInstallation } from '@seeya-ai/engine/adapters/installation/macos.js';

describe('buildAppInstallation', () => {
  it('picks WindowsAppInstallation on win32', () => {
    expect(buildAppInstallation('win32')).toBeInstanceOf(WindowsAppInstallation);
  });

  it('picks MacosAppInstallation on darwin', () => {
    expect(buildAppInstallation('darwin')).toBeInstanceOf(MacosAppInstallation);
  });

  it('picks LinuxAppInstallation on linux', () => {
    expect(buildAppInstallation('linux')).toBeInstanceOf(LinuxAppInstallation);
  });

  it('falls back to LinuxAppInstallation for an unrecognized platform', () => {
    expect(buildAppInstallation('aix')).toBeInstanceOf(LinuxAppInstallation);
  });
});
