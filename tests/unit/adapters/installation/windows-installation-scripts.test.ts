import { describe, expect, it } from 'vitest';
import {
  buildQueryScript,
  deriveExecutablePath,
} from '@seeya-ai/engine/adapters/installation/windows-installation-scripts.js';

describe('buildQueryScript', () => {
  it('queries all three uninstall roots (per-user, per-machine, per-machine 32-bit view)', () => {
    const script = buildQueryScript();
    expect(script).toContain('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall');
    expect(script).toContain('HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall');
    expect(script).toContain(
      'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    );
    expect(script).toContain('-ErrorAction SilentlyContinue');
    expect(script).toContain("Where-Object { $_.DisplayName -match '^seeya(\\s|$)' }");
    expect(script).toContain('found = $true');
    expect(script).toContain('found = $false');
  });
});

describe('deriveExecutablePath', () => {
  it('prefers InstallLocation when it is non-empty', () => {
    expect(
      deriveExecutablePath('C:\\Users\\<usuario>\\AppData\\Local\\Programs\\seeya', '', ''),
    ).toBe('C:\\Users\\<usuario>\\AppData\\Local\\Programs\\seeya\\seeya.exe');
  });

  it("falls back to UninstallString's own directory when InstallLocation is empty (measured per-user case, Q-081)", () => {
    const uninstallString =
      '"C:\\Users\\<usuario>\\AppData\\Local\\Programs\\seeya\\Uninstall seeya.exe" /currentuser';
    expect(deriveExecutablePath('', uninstallString, '')).toBe(
      'C:\\Users\\<usuario>\\AppData\\Local\\Programs\\seeya\\seeya.exe',
    );
  });

  // Measured per-machine install (Q-081): InstallLocation AND UninstallString both came back
  // empty — DisplayIcon was the only field that named the executable at all.
  it('falls back to DisplayIcon (quoted, with a trailing icon index) when the first two are empty', () => {
    expect(deriveExecutablePath('', '', '"C:\\Program Files\\seeya\\seeya.exe",0')).toBe(
      'C:\\Program Files\\seeya\\seeya.exe',
    );
  });

  it('DisplayIcon without quotes or an icon index is used as-is', () => {
    expect(deriveExecutablePath('', '', 'C:\\Program Files\\seeya\\seeya.exe')).toBe(
      'C:\\Program Files\\seeya\\seeya.exe',
    );
  });

  it('all three empty → null, never a guessed path (D-025)', () => {
    expect(deriveExecutablePath('', '', '')).toBeNull();
  });

  it('UninstallString with no quoted path and no usable DisplayIcon → null', () => {
    expect(deriveExecutablePath('', 'not-a-quoted-command-line', '')).toBeNull();
  });
});
