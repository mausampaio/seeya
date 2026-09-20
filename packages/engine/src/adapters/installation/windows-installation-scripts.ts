/**
 * Windows uninstall-registry mechanism for `AppInstallation` (V2-T13, D-045 item 2), built the
 * same way `adapters/autostart/windows-scripts.ts` builds its own Task Scheduler script (this
 * project's own established "compact JSON on stdout, parsed by the TS adapter" shape) — but this
 * one queries `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall` instead, the entry the
 * per-user NSIS installer (`packages/app/electron-builder.yml`'s `nsis.perMachine: false`) writes.
 *
 * **Measured on the machine this task shipped from (docs/QUESTOES.md Q-081), read-only, never
 * created/modified/deleted by this task.** A real per-user NSIS install of this project's own app
 * shows up under that registry path with `DisplayName` set to `"<productName> <version>"` (e.g.
 * `"seeya 0.1.0"`, `electron-builder`'s own NSIS default for `uninstallDisplayName`) — never the
 * bare product name — and, on the build measured, an EMPTY `InstallLocation`: the only field that
 * actually carried the install directory was `UninstallString`
 * (`"<installDir>\Uninstall seeya.exe" /currentuser`). `deriveExecutablePath` below prefers
 * `InstallLocation` when a future `electron-builder` version populates it, and falls back to
 * `UninstallString`'s own directory otherwise — never assumes either field is present.
 *
 * `DisplayName` is matched by `^seeya(\s|$)` (case-insensitive is deliberately NOT used — Windows
 * product names from this project's own installer are always exactly `seeya`, never `Seeya`), not
 * an exact `'seeya'` string, precisely because the real entry carries the version suffix.
 */
// `path.win32`, not the bare default export: this module parses Windows registry strings
// (backslash-separated) regardless of which OS the test runner or the adapter itself is on
// (`npm run verificar:linux` runs these same unit tests inside a Linux container) — the default
// `node:path` export would parse with `/` on that platform and silently mis-split every path here.
import { win32 as path } from 'node:path';

/** `packages/app/electron-builder.yml`'s own `productName`/`executableName` — both `seeya`, kept
 * as two separate constants here (rather than one shared literal) because they answer two
 * different questions (`DisplayName`'s own prefix vs. the installed binary's own filename) that
 * happen to have the same value today; a future rename of one would not necessarily mean the
 * other changed too. */
const PRODUCT_NAME = 'seeya';
const EXECUTABLE_NAME = 'seeya';

/**
 * Lists every entry under the per-user uninstall registry key and reports the first one whose
 * `DisplayName` starts with `seeya` — compact JSON on stdout, `{"found":false}` when none match.
 * No internal try/catch (unlike `adapters/autostart/windows-scripts.ts#buildQueryScript`, whose
 * `Get-ScheduledTask` throws for the ordinary "not registered" case): `Get-ChildItem`/
 * `Get-ItemProperty` over the Uninstall key never throw for "nothing installed" here, only for a
 * genuine problem reaching the registry at all — which is exactly what should surface as a
 * non-zero exit code, mapped to `unknown` by `windows.ts#find` (D-025), not swallowed into
 * `{"found":false}`.
 */
export function buildQueryScript(): string {
  return `
$ErrorActionPreference = 'Stop'
$entries = Get-ChildItem 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall' -ErrorAction Stop |
  ForEach-Object { Get-ItemProperty $_.PsPath }
$match = $entries | Where-Object { $_.DisplayName -match '^${PRODUCT_NAME}(\\s|$)' } | Select-Object -First 1
if ($null -eq $match) {
  [pscustomobject]@{ found = $false } | ConvertTo-Json -Compress
} else {
  [pscustomobject]@{
    found = $true
    installLocation = [string]$match.InstallLocation
    uninstallString = [string]$match.UninstallString
  } | ConvertTo-Json -Compress
}
`;
}

/**
 * The install directory named by `uninstallString`
 * (`"<installDir>\Uninstall <productName>.exe" /currentuser`, this file's own top comment) — the
 * quoted leading token up to the first `"`, with its own filename stripped. `null` when
 * `uninstallString` is empty or carries no quoted path at all (a shape this adapter has never
 * actually observed, but D-025 means a query result this module can't make sense of is reported
 * as "don't know", never guessed at).
 */
function directoryFromUninstallString(uninstallString: string): string | null {
  const match = /^"([^"]+)"/.exec(uninstallString.trim());
  const quotedPath = match?.[1];
  if (quotedPath === undefined || quotedPath === '') {
    return null;
  }
  return path.dirname(quotedPath);
}

/**
 * `installLocation`/`uninstallString` are the raw registry values `windows.ts#find` read back
 * (`buildQueryScript`'s own JSON output) — prefers `installLocation` when non-empty, falls back to
 * `uninstallString`'s own directory (this file's own top comment: the field actually populated on
 * the build this was measured against), and returns `null` when NEITHER gives a usable directory
 * (D-025: `windows.ts#find` reports `unknown` for that case, never guesses a path).
 */
export function deriveExecutablePath(
  installLocation: string,
  uninstallString: string,
): string | null {
  const trimmedInstallLocation = installLocation.trim();
  const directory =
    trimmedInstallLocation !== ''
      ? trimmedInstallLocation
      : directoryFromUninstallString(uninstallString);
  return directory === null ? null : path.join(directory, `${EXECUTABLE_NAME}.exe`);
}
