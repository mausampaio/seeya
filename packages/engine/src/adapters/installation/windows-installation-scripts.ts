/**
 * Windows uninstall-registry mechanism for `AppInstallation` (V2-T13, D-045 item 2), built the
 * same way `adapters/autostart/windows-scripts.ts` builds its own Task Scheduler script (this
 * project's own established "compact JSON on stdout, parsed by the TS adapter" shape) — but this
 * one queries the uninstall registry instead, the entry the NSIS installer
 * (`packages/app/electron-builder.yml`) writes.
 *
 * **Measured on the maintainer's own machine (docs/QUESTOES.md Q-081), read-only, never
 * created/modified/deleted by this task — TWO separate installs, two different shapes.**
 *
 * - **Per-user** (`nsis.perMachine: false`, this project's own default): the entry lands under
 *   `HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall`, `DisplayName` set to
 *   `"<productName> <version>"` (e.g. `"seeya 0.1.0"`, `electron-builder`'s own NSIS default for
 *   `uninstallDisplayName`) — never the bare product name. `InstallLocation` came back EMPTY; the
 *   only field that actually carried the install directory was `UninstallString`
 *   (`"<installDir>\Uninstall seeya.exe" /currentuser`).
 * - **Per-machine** (the installer's OWN "for all users" option, not this project's default but
 *   real and selectable): the entry lands under
 *   `HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall` instead — NEVER under HKCU at
 *   all, a completely disjoint registry root a query scoped to HKCU alone would silently report
 *   as `notInstalled`. `InstallLocation` was ALSO empty here, and `UninstallString` this time
 *   measured as an empty string too (unlike the per-user case) — `DisplayIcon` (typically
 *   `"<execPath>",0` or a bare `<execPath>`) is the third and last fallback this module tries
 *   before honestly giving up (`deriveExecutablePath` below).
 *
 * **Three registry roots, not one** — `buildQueryScript` below reads all three and reports the
 * first `seeya`-prefixed match from any of them: HKCU (per-user), HKLM (per-machine, native view)
 * and `HKLM:\...\WOW6432Node\...` (per-machine, the 32-bit view a 64-bit Windows can also route an
 * installer's registration through, depending on how it was built) — "installed" means found in
 * ANY of the three, never just the first one that happens to exist.
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

/** The three registry roots a real NSIS install (per-user OR per-machine, either 32- or 64-bit
 * registration view) can land its uninstall entry under — this file's own top comment has the two
 * real shapes measured. */
const UNINSTALL_REGISTRY_ROOTS = [
  'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
];

/**
 * Lists every entry under all three roots above and reports the first one whose `DisplayName`
 * starts with `seeya` — compact JSON on stdout, `{"found":false}` when none match. Each
 * `Get-ChildItem` call carries its own `-ErrorAction SilentlyContinue`: a root that doesn't exist
 * on this machine (e.g. no per-machine install at all, or a 64-bit Windows with nothing ever
 * registered through the WOW6432Node view) is the ORDINARY case, not a failure — only a genuine
 * problem reaching the registry at all (permission denied, `powershell.exe` itself missing) should
 * surface as a non-zero exit code, mapped to `unknown` by `windows.ts#find` (D-025), never
 * swallowed into `{"found":false}`.
 */
export function buildQueryScript(): string {
  const rootsLiteral = UNINSTALL_REGISTRY_ROOTS.map((root) => `'${root}'`).join(', ');
  return `
$ErrorActionPreference = 'Stop'
$roots = @(${rootsLiteral})
$entries = foreach ($root in $roots) {
  Get-ChildItem $root -ErrorAction SilentlyContinue | ForEach-Object { Get-ItemProperty $_.PsPath }
}
$match = $entries | Where-Object { $_.DisplayName -match '^${PRODUCT_NAME}(\\s|$)' } | Select-Object -First 1
if ($null -eq $match) {
  [pscustomobject]@{ found = $false } | ConvertTo-Json -Compress
} else {
  [pscustomobject]@{
    found = $true
    installLocation = [string]$match.InstallLocation
    uninstallString = [string]$match.UninstallString
    displayIcon = [string]$match.DisplayIcon
  } | ConvertTo-Json -Compress
}
`;
}

/**
 * The install directory named by `uninstallString`
 * (`"<installDir>\Uninstall <productName>.exe" /currentuser`, this file's own top comment) — the
 * quoted leading token up to the first `"`, with its own filename stripped. `null` when
 * `uninstallString` is empty or carries no quoted path at all (the measured per-machine case, and
 * any other shape this adapter can't make sense of — D-025 means it's reported as "don't know",
 * never guessed at).
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
 * `DisplayIcon` names the executable DIRECTLY (unlike `InstallLocation`/`UninstallString`, which
 * name a directory this module has to append `seeya.exe` to) — typically `"<execPath>",0` (a
 * quoted path plus a trailing icon-index suffix) or a bare, unquoted `<execPath>`. `null` when
 * empty or unparseable — the last fallback `deriveExecutablePath` tries, for the measured
 * per-machine case where `InstallLocation`/`UninstallString` were BOTH empty.
 */
function pathFromDisplayIcon(displayIcon: string): string | null {
  const withoutIconIndex = displayIcon.trim().replace(/,\d+$/, '');
  if (withoutIconIndex === '') {
    return null;
  }
  const quoted = /^"([^"]+)"$/.exec(withoutIconIndex);
  return quoted?.[1] ?? withoutIconIndex;
}

/**
 * `installLocation`/`uninstallString`/`displayIcon` are the raw registry values `windows.ts#find`
 * read back (`buildQueryScript`'s own JSON output). Three-step fallback, in the order this file's
 * own top comment measured being populated: `installLocation` (a directory, `seeya.exe` appended)
 * → `uninstallString`'s own directory (same append) → `displayIcon` (already names the executable
 * directly, used as-is). `null` when NONE of the three gives a usable path (D-025:
 * `windows.ts#find` reports `unknown` for that case, never guesses a path) — the measured
 * per-machine install left `installLocation`/`uninstallString` both empty, so a real machine can
 * reach this third fallback, not just a hypothetical.
 */
export function deriveExecutablePath(
  installLocation: string,
  uninstallString: string,
  displayIcon: string,
): string | null {
  const trimmedInstallLocation = installLocation.trim();
  if (trimmedInstallLocation !== '') {
    return path.join(trimmedInstallLocation, `${EXECUTABLE_NAME}.exe`);
  }
  const uninstallDir = directoryFromUninstallString(uninstallString);
  if (uninstallDir !== null) {
    return path.join(uninstallDir, `${EXECUTABLE_NAME}.exe`);
  }
  return pathFromDisplayIcon(displayIcon);
}
