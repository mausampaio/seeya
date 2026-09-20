import { describe, expect, it } from 'vitest';
import {
  buildQueryScript,
  deriveExecutablePath,
} from '@seeya-ai/engine/adapters/installation/windows-installation-scripts.js';

describe('buildQueryScript', () => {
  it('queries the per-user uninstall key and matches DisplayName starting with "seeya"', () => {
    const script = buildQueryScript();
    expect(script).toContain(
      "Get-ChildItem 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall'",
    );
    expect(script).toContain("Where-Object { $_.DisplayName -match '^seeya(\\s|$)' }");
    expect(script).toContain('found = $true');
    expect(script).toContain('found = $false');
  });
});

describe('deriveExecutablePath', () => {
  it('prefers InstallLocation when it is non-empty', () => {
    expect(deriveExecutablePath('C:\\Users\\<usuario>\\AppData\\Local\\Programs\\seeya', '')).toBe(
      'C:\\Users\\<usuario>\\AppData\\Local\\Programs\\seeya\\seeya.exe',
    );
  });

  it("falls back to UninstallString's own directory when InstallLocation is empty (measured case, Q-081)", () => {
    const uninstallString =
      '"C:\\Users\\<usuario>\\AppData\\Local\\Programs\\seeya\\Uninstall seeya.exe" /currentuser';
    expect(deriveExecutablePath('', uninstallString)).toBe(
      'C:\\Users\\<usuario>\\AppData\\Local\\Programs\\seeya\\seeya.exe',
    );
  });

  it('both empty → null, never a guessed path (D-025)', () => {
    expect(deriveExecutablePath('', '')).toBeNull();
  });

  it('UninstallString with no quoted path at all → null', () => {
    expect(deriveExecutablePath('', 'not-a-quoted-command-line')).toBeNull();
  });
});
