/**
 * Windows native backend: a WinRT toast shown via PowerShell (docs/spikes/B-notificacoes.md §
 * Windows), the same dependency-free P/Invoke-adjacent technique
 * `adapters/process/console-signal.ts` uses for `CTRL_BREAK_EVENT` — no npm dependency, no
 * PowerShell module, no external binary.
 *
 * **Why `-EncodedCommand`, not a `-Command` string.** Same reasoning as
 * `console-signal.ts`'s own module comment, reused rather than re-litigated here: a `-Command`
 * string gets re-parsed by PowerShell itself after surviving `spawn`'s own argument handling,
 * which is exactly the kind of double-escaping that spike measured breaking. Base64 sidesteps
 * both: the script text is only ever decoded and run, never re-parsed as a command line.
 */
import type { Notice } from '../../core/ports.js';
import type { ProtocolScheme } from '../../core/types.js';
import type { CommandRunner, NotificationBackend } from './backend.js';
import { spawnCommand } from './backend.js';

/** PowerShell's own AppUserModelID — Spike B measured a toast shown under this identity works
 * with zero registration, since PowerShell already owns it. */
const POWERSHELL_APP_ID =
  '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Escapes `value` for embedding inside a PowerShell single-quoted string literal — doubling `'`
 * is that syntax's only escape rule. Defensive rather than load-bearing today: `escapeXml` above
 * already turns any `'` in the notice's own text into `&apos;` before it gets here, so the toast
 * XML this wraps should never contain a literal single quote in practice — kept anyway (and
 * exported for its own direct test) so a future change to the XML shape can't silently reopen a
 * script-injection path. */
export function escapeForPowerShellSingleQuotedString(value: string): string {
  return value.replace(/'/g, "''");
}

/** V2-T10 item 2: the URI the toast's `launch` attribute carries, built from whichever scheme is
 * active (`core/types.ts#ProtocolScheme`) — never a hardcoded `seeya://open` any more, since a dev
 * launch's toast now has to point at `seeya-dev://open` instead (D-034's closing paragraph: the
 * toast itself has no `<actions>` element and never will; this is only ever "bring the window to
 * front", not a decision about the day). */
function protocolLaunchUri(scheme: ProtocolScheme): string {
  return `${scheme}://open`;
}

/**
 * The toast's visual content — title + body, no `<actions>` element: this task's contract has
 * none (docs/ESPECIFICACAO.md § "Notificações"; D-034's closing paragraph confirms this stays true
 * even now that the interface exists to click INTO).
 *
 * **`scheme` (V2-T5b item 5, reshaped from a boolean by V2-T10 item 2).** A non-`null` scheme
 * adds `launch="<scheme>://open" activationType="protocol"` on the `<toast>` root — Spike B's own
 * validated mechanism (docs/spikes/B-notificacoes.md § "VALIDADO"): clicking the toast body (not a
 * button) asks Windows to activate whatever handler is registered for that scheme, which
 * `packages/app/src/electron/main.ts#registerProtocolHandler` registers via
 * `app.setAsDefaultProtocolClient`. `null` (the default every EXISTING caller of this function
 * gets, unchanged) omits both attributes entirely — the exact toast this project already sent
 * before V2-T5b. Whoever calls this decides `scheme` from `Storage.readActiveProtocolScheme()`
 * (D-025: no marker, no launch attribute — a toast whose click target isn't registered would
 * surface Windows' own "how do you want to open seeya?" picker instead of focusing the window,
 * worse than the plain toast this project already had).
 */
export function buildToastXml(notice: Notice, scheme: ProtocolScheme | null = null): string {
  const toastAttributes =
    scheme === null
      ? ''
      : ` launch="${escapeXml(protocolLaunchUri(scheme))}" activationType="protocol"`;
  return (
    `<toast${toastAttributes}><visual><binding template="ToastGeneric">` +
    `<text>${escapeXml(notice.title)}</text>` +
    `<text>${escapeXml(notice.body)}</text>` +
    '</binding></visual></toast>'
  );
}

/** V2-T10 item 3: the registry path the script itself tests before trusting `scheme` still has an
 * owner — `HKCU:\Software\Classes\<scheme>` is exactly what `app.setAsDefaultProtocolClient`
 * writes (and what NSIS's own uninstall snippet, `packages/app/build/installer.nsh`, removes for
 * `seeya` on uninstall). `scheme` is always one of this project's own two literal
 * `ProtocolScheme` values, never external input, so no escaping beyond PowerShell's own
 * single-quote doubling (applied by the caller below) is needed. */
function registryTestPath(scheme: ProtocolScheme): string {
  return `HKCU:\\Software\\Classes\\${scheme}`;
}

/**
 * The full PowerShell script: loads the two WinRT types explicitly (docs/spikes/B-notificacoes.md:
 * skipping either one fails with a `PSArgumentException` pointing at the wrong type) and shows the
 * toast under `POWERSHELL_APP_ID`.
 *
 * **V2-T10 item 3: when `scheme` is given, THIS SAME SCRIPT tests whether that scheme still has a
 * registry entry before trusting the marker at all** — `Test-Path 'HKCU:\Software\Classes\<scheme>'`,
 * decided at the moment the toast actually shows, inside the one PowerShell process this backend
 * already spawns (no second process, no extra round trip). The marker
 * (`Storage.readActiveProtocolScheme()`) can be stale — the app was uninstalled since the last time
 * a window registered, or the marker survived a manual delete of `~/.seeya/` — and D-025 says a
 * toast must never claim a click destination it can't back up: a launch attribute pointing at an
 * unowned scheme would surface Windows' own "how do you want to open seeya?" picker instead of
 * focusing the window, worse than the plain toast this project already had. Two XML variants are
 * embedded (`withLaunchXml`/`plainXml`) and the script itself picks between them at runtime — this
 * function can't decide in advance, because only the machine the toast actually shows on knows
 * whether the key still exists.
 *
 * `scheme === null` (the marker never existed at all) skips the registry check outright — there is
 * nothing to test, and asking `Test-Path` about "no scheme" would be a check with no question
 * behind it.
 */
export function buildToastScript(notice: Notice, scheme: ProtocolScheme | null = null): string {
  const appId = escapeForPowerShellSingleQuotedString(POWERSHELL_APP_ID);
  const plainXml = escapeForPowerShellSingleQuotedString(buildToastXml(notice, null));
  const loadXml =
    scheme === null
      ? `$doc.LoadXml('${plainXml}')`
      : buildConditionalLoadXml(scheme, plainXml, buildToastXml(notice, scheme));
  return `
$ErrorActionPreference = 'Stop'
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
$doc = New-Object Windows.Data.Xml.Dom.XmlDocument
${loadXml}
$notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('${appId}')
$notifier.Show([Windows.UI.Notifications.ToastNotification]::new($doc))
`;
}

/** The `if (Test-Path ...) { ... } else { ... }` block `buildToastScript` embeds when `scheme` is
 * known — extracted so that function's own body stays readable at a glance. */
function buildConditionalLoadXml(
  scheme: ProtocolScheme,
  plainXml: string,
  withLaunchXmlRaw: string,
): string {
  const withLaunchXml = escapeForPowerShellSingleQuotedString(withLaunchXmlRaw);
  const registryPath = escapeForPowerShellSingleQuotedString(registryTestPath(scheme));
  return (
    `if (Test-Path '${registryPath}') {\n` +
    `  $doc.LoadXml('${withLaunchXml}')\n` +
    '} else {\n' +
    `  $doc.LoadXml('${plainXml}')\n` +
    '}'
  );
}

/** `powershell.exe -NoProfile -NonInteractive -NoLogo -EncodedCommand <base64>` — same argument
 * shape `console-signal.ts#runPowerShellScript` already uses. Exported so a test can assert on the
 * exact argument array, and decode the base64 back to confirm the script it wraps. */
export function buildPowerShellArgs(script: string): string[] {
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  return ['-NoProfile', '-NonInteractive', '-NoLogo', '-EncodedCommand', encoded];
}

export interface WindowsToastBackendOptions {
  /** Defaults to `process.platform` — overridable so `isAvailable()` is testable on any host
   * (docs/PLANO-DE-ENTREGA.md S4-T1's own instruction, same seam
   * `adapters/process/termination.ts#terminateGracefully` already uses). */
  readonly platform?: NodeJS.Platform;
  /** Defaults to `'powershell.exe'`. Overridable so a test (or the e2e harness) can point this at
   * a fake executable instead of ever spawning the real one. */
  readonly command?: string;
  readonly run?: CommandRunner;
  /** V2-T5b item 5, reshaped by V2-T10 item 2: reports `Storage.readActiveProtocolScheme()` —
   * this adapter never imports `Storage` itself (D-020: only a composition root names a concrete
   * adapter), so whoever builds this backend (`adapters/notification/index.ts#buildNotifier`)
   * injects the read. Defaults to a function that always resolves `null` — D-025's own reading of
   * "no evidence a marker was checked at all" is the SAME as "no marker exists": every caller of
   * the bare `notifier` singleton (unaware of `Storage`) keeps sending the pre-V2-T5b toast shape
   * unless explicitly wired otherwise. */
  readonly activeProtocolScheme?: () => Promise<ProtocolScheme | null>;
}

export class WindowsToastBackend implements NotificationBackend {
  readonly name = 'windows-toast';
  private readonly platform: NodeJS.Platform;
  private readonly command: string;
  private readonly run: CommandRunner;
  private readonly activeProtocolScheme: () => Promise<ProtocolScheme | null>;

  constructor(options: WindowsToastBackendOptions = {}) {
    this.platform = options.platform ?? process.platform;
    this.command = options.command ?? 'powershell.exe';
    this.run = options.run ?? spawnCommand;
    this.activeProtocolScheme = options.activeProtocolScheme ?? (() => Promise.resolve(null));
  }

  /** Spike B measured this resolves with zero extra dependency on every Windows host tried — no
   * existence probe the way `LinuxNotifySendBackend` needs one (see that file's own docstring). */
  isAvailable(): Promise<boolean> {
    return Promise.resolve(this.platform === 'win32');
  }

  supportsActions(): boolean {
    return false;
  }

  async send(notice: Notice): Promise<void> {
    // A broken/throwing check reads as "no active scheme" (isAvailableSafely's own precedent in
    // chain.ts for a broken capability probe) — never let a marker-read failure escalate into a
    // WORSE toast than this project already had, and never let it take the whole notify() chain
    // down with it either.
    const scheme = await this.activeProtocolScheme().catch(() => null);
    const args = buildPowerShellArgs(buildToastScript(notice, scheme));
    const result = await this.run(this.command, args);
    if (result.exitCode !== 0) {
      throw new Error(
        `windows toast helper exited ${String(result.exitCode)}, expected 0. ` +
          `stderr: ${result.stderr || '(empty)'}`,
      );
    }
  }
}
