/**
 * V2-T12 item 3: `checkPlatformSupport`'s own docstring in
 * `packages/app/scripts/dist-platform-check.mjs` has the measurement this guard is built on —
 * `node scripts/dist.mjs --linux`, run for real on a Windows host with no container, gets through
 * downloading Electron and packaging the unpacked app before failing with
 * `EPERM: operation not permitted, symlink ...` while building the AppImage target.
 */
import { describe, expect, it } from 'vitest';
import { checkPlatformSupport } from '../../../../packages/app/scripts/dist-platform-check.mjs';

describe('checkPlatformSupport', () => {
  it('rejects --linux on a Windows host, naming the container as the way out', () => {
    const result = checkPlatformSupport(['--linux'], 'win32');

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected checkPlatformSupport to reject --linux on win32');
    }
    expect(result.message).toContain('Linux');
    expect(result.message).toContain('verificar:linux');
  });

  it('accepts -l on a Linux host — the same flag, run where it can actually build', () => {
    expect(checkPlatformSupport(['-l'], 'linux')).toEqual({ ok: true });
  });

  it('rejects --mac on a non-macOS host, naming hdiutil as the reason', () => {
    const result = checkPlatformSupport(['--mac'], 'win32');

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected checkPlatformSupport to reject --mac on win32');
    }
    expect(result.message).toContain('hdiutil');
  });

  it('rejects --macos on a Linux host — same rejection, spelled differently', () => {
    const result = checkPlatformSupport(['--macos'], 'linux');

    expect(result.ok).toBe(false);
  });

  it('accepts --mac on a macOS host', () => {
    expect(checkPlatformSupport(['--mac'], 'darwin')).toEqual({ ok: true });
  });

  it('accepts --win on any host — this task never measured a Windows-target restriction', () => {
    expect(checkPlatformSupport(['--win'], 'linux')).toEqual({ ok: true });
    expect(checkPlatformSupport(['--win'], 'darwin')).toEqual({ ok: true });
  });

  it('leaves an empty argument list alone (no platform requested, nothing to guard)', () => {
    expect(checkPlatformSupport(['--dir'], 'win32')).toEqual({ ok: true });
  });

  it('recognizes the --linux=target and --mac=target forms electron-builder also accepts', () => {
    expect(checkPlatformSupport(['--linux=deb'], 'win32').ok).toBe(false);
    expect(checkPlatformSupport(['--mac=dmg'], 'win32').ok).toBe(false);
  });
});
