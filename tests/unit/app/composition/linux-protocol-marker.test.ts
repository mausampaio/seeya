import { describe, expect, it } from 'vitest';
import { shouldMarkLinuxProtocolRegistered } from '../../../../packages/app/src/composition/linux-protocol-marker.js';

describe('shouldMarkLinuxProtocolRegistered (V2-T8 item 4)', () => {
  it('true for a packaged Linux run with no APPIMAGE env — inferred .deb install', () => {
    expect(
      shouldMarkLinuxProtocolRegistered({
        platform: 'linux',
        isPackaged: true,
        appImageEnv: undefined,
      }),
    ).toBe(true);
  });

  it('false when running from an AppImage — nothing installed a .desktop file', () => {
    expect(
      shouldMarkLinuxProtocolRegistered({
        platform: 'linux',
        isPackaged: true,
        appImageEnv: '/home/<usuario>/seeya.AppImage',
      }),
    ).toBe(false);
  });

  it('false for an unpackaged dev launch (npm run app) — no .desktop file exists at all', () => {
    expect(
      shouldMarkLinuxProtocolRegistered({
        platform: 'linux',
        isPackaged: false,
        appImageEnv: undefined,
      }),
    ).toBe(false);
  });

  it('false on any other platform, regardless of isPackaged/appImageEnv', () => {
    expect(
      shouldMarkLinuxProtocolRegistered({
        platform: 'win32',
        isPackaged: true,
        appImageEnv: undefined,
      }),
    ).toBe(false);
    expect(
      shouldMarkLinuxProtocolRegistered({
        platform: 'darwin',
        isPackaged: true,
        appImageEnv: undefined,
      }),
    ).toBe(false);
  });
});
