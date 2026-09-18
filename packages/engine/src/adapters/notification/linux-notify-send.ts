/**
 * Linux native backend: `notify-send` (docs/spikes/B-notificacoes.md § Linux) — no `-A` (actions
 * are out of this task's contract, docs/ESPECIFICACAO.md § "Notificações") **except the one D-034
 * already carved out for a click on the toast BODY** (V2-T8 item 4, mirroring
 * `windows-toast.ts`'s own `launch`/`activationType="protocol"` mechanism): still no button, no
 * `<actions>`-shaped UI — `notify-send`'s own `-A name=Text` just labels the ONE clickable surface
 * most desktop notification servers already show (the notification itself), and this project uses
 * it exactly once, for `default`, the same "click the body, not a button" semantics D-034 already
 * settled for Windows.
 *
 * **Only offered when there is somewhere for the click to go.** `isProtocolHandlerRegistered`
 * (constructor option, defaults to "always false" like `windows-toast.ts`'s own) mirrors
 * `Storage.readProtocolHandlerRegistered()` — no marker, no `-A`, exactly the toast this project
 * already sent before this task (D-025). And **only when the installed `notify-send` understands
 * `--action` at all**: measured inside the `verificar:linux` container (`node:22-bookworm` +
 * `libnotify-bin` 0.8.1-1 from Debian bookworm's own repository, 2026-09-17) — `notify-send
 * --version` prints `notify-send 0.8.1`, and `notify-send --help` documents `-A, --action=
 * [NAME=]Text...` ("Implies --wait"). The task's own instruction names 0.7.10 as the version that
 * introduced the flag; below that, this backend sends the exact same plain toast it always did.
 */
import type { Notice } from '../../core/ports.js';
import type { CommandRunner, DetachedCommandRunner, NotificationBackend } from './backend.js';
import { spawnCommand, spawnDetachedListening } from './backend.js';

/** `shell: false` means these two elements reach `notify-send` verbatim, argv-separated — no shell
 * to interpret quotes/newlines/`&`, so unlike the macOS/Windows backends, there is nothing here to
 * escape (AGENTS.md § "Processos"). `includeAction` (V2-T8 item 4) prepends `--wait
 * --action=default=Open` — `--wait` is technically implied by `--action` alone (measured, see this
 * file's own module docstring), passed explicitly anyway so this argv is self-explanatory without
 * having to know that. Exported for direct unit testing. */
export function buildNotifySendArgs(notice: Notice, includeAction = false): string[] {
  const actionArgs = includeAction ? ['--wait', '--action=default=Open'] : [];
  return [...actionArgs, notice.title, notice.body];
}

/** A parsed `notify-send --version` output (`"notify-send 0.8.1"` → `{major:0,minor:8,patch:1}`).
 * Exported for direct unit testing of the parse alone, separate from the version-gate decision
 * `versionSupportsActionFlag` below makes from it. */
export interface NotifySendVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

/** `undefined` when `output` has no `MAJOR.MINOR.PATCH`-shaped substring at all — a `notify-send`
 * whose `--version` output this module doesn't recognize is treated the same as "too old for
 * `--action`" by `versionSupportsActionFlag` (never a guess in the other direction, D-025). */
export function parseNotifySendVersion(output: string): NotifySendVersion | undefined {
  const match = /(\d+)\.(\d+)\.(\d+)/.exec(output);
  if (match === null) {
    return undefined;
  }
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

/** Encodes a version as one comparable integer (`major*1_000_000 + minor*1_000 + patch`) — a
 * simple total order that holds as long as `minor`/`patch` each stay below 1000, true of every
 * `notify-send` version this project has seen. */
function versionScore(version: NotifySendVersion): number {
  return version.major * 1_000_000 + version.minor * 1_000 + version.patch;
}

/** The task's own instruction: `--action` needs `notify-send` 0.7.10 or newer. `undefined` (no
 * parseable version at all) never supports it — same "absence is the least specific true claim"
 * rule D-025 applies everywhere else in this project. */
const MINIMUM_ACTION_CAPABLE_VERSION: NotifySendVersion = { major: 0, minor: 7, patch: 10 };

export function versionSupportsActionFlag(version: NotifySendVersion | undefined): boolean {
  return (
    version !== undefined && versionScore(version) >= versionScore(MINIMUM_ACTION_CAPABLE_VERSION)
  );
}

export interface LinuxNotifySendBackendOptions {
  readonly platform?: NodeJS.Platform;
  readonly command?: string;
  readonly run?: CommandRunner;
  /** V2-T8 item 4: mirrors `WindowsToastBackendOptions`'s own field of the same name exactly —
   * whoever builds this backend (`adapters/notification/index.ts#buildDefaultBackends`) injects
   * `Storage.readProtocolHandlerRegistered()` when it has a `Storage` to read (D-020: this adapter
   * has none of its own). Defaults to "always false", the same safe default the Windows backend
   * uses. */
  readonly isProtocolHandlerRegistered?: () => Promise<boolean>;
  /** Test seam for the `--wait`ed, detached click listener `send()` spawns when it decides to offer
   * the click — never the same as `run` above, which AWAITS the process's exit; see
   * `backend.ts#DetachedLaunch`'s own docstring for why `send()` cannot use `run` for this. */
  readonly spawnDetached?: DetachedCommandRunner;
  /** V2-T8 item 4: opens `seeya://open` once a click is confirmed — real implementation spawns
   * `xdg-open` (hidden, D-038, awaited briefly); a test injects a spy instead of ever launching a
   * real browser/handler. */
  readonly openProtocolUrl?: (url: string) => Promise<void>;
}

const PROTOCOL_LAUNCH_URL = 'seeya://open';
const CLICKED_ACTION_ID = 'default';

/** Real implementation of `openProtocolUrl` — `xdg-open <url>`, hidden (D-038) and awaited (this
 * one is short-lived: `xdg-open` itself forks its own long-running handler and exits quickly). Not
 * `spawnDetachedListening`: nothing here needs to keep running or be read back after the fact. */
async function xdgOpen(url: string): Promise<void> {
  const result = await spawnCommand('xdg-open', [url]);
  if (result.exitCode !== 0) {
    throw new Error(
      `xdg-open ${url} exited ${String(result.exitCode)}, expected 0. stderr: ${result.stderr || '(empty)'}`,
    );
  }
}

/**
 * Unlike the Windows/macOS backends, availability needs a real probe, not just a platform check:
 * Spike B is explicit that a server with no graphical session has none of this ("em servidor sem
 * sessão gráfica, nada disso existe") — `libnotify` itself may simply not be installed.
 * `--version` is a cheap, side-effect-free way to ask.
 */
export class LinuxNotifySendBackend implements NotificationBackend {
  readonly name = 'linux-notify-send';
  private readonly platform: NodeJS.Platform;
  private readonly command: string;
  private readonly run: CommandRunner;
  private readonly isProtocolHandlerRegistered: () => Promise<boolean>;
  private readonly spawnDetached: DetachedCommandRunner;
  private readonly openProtocolUrl: (url: string) => Promise<void>;

  constructor(options: LinuxNotifySendBackendOptions = {}) {
    this.platform = options.platform ?? process.platform;
    this.command = options.command ?? 'notify-send';
    this.run = options.run ?? spawnCommand;
    this.isProtocolHandlerRegistered =
      options.isProtocolHandlerRegistered ?? (() => Promise.resolve(false));
    this.spawnDetached = options.spawnDetached ?? spawnDetachedListening;
    this.openProtocolUrl = options.openProtocolUrl ?? xdgOpen;
  }

  async isAvailable(): Promise<boolean> {
    if (this.platform !== 'linux') {
      return false;
    }
    try {
      const result = await this.run(this.command, ['--version']);
      return result.exitCode === 0;
    } catch {
      // ENOENT (binary missing) or any other spawn failure: no different from "not installed".
      return false;
    }
  }

  supportsActions(): boolean {
    return false;
  }

  async send(notice: Notice): Promise<void> {
    if (!(await this.shouldOfferClickAction())) {
      await this.sendPlain(notice);
      return;
    }
    await this.sendWithClickAction(notice);
  }

  /** V2-T8 item 4's own gate: a click has somewhere to go (the marker exists) AND the installed
   * `notify-send` actually understands `--action`. Either `false` falls back to `sendPlain` —
   * exactly the toast this project already sent before this task. */
  private async shouldOfferClickAction(): Promise<boolean> {
    const registered = await this.isProtocolHandlerRegistered().catch(() => false);
    if (!registered) {
      return false;
    }
    const probe = await this.run(this.command, ['--version']).catch(() => undefined);
    if (probe === undefined || probe.exitCode !== 0) {
      return false;
    }
    return versionSupportsActionFlag(parseNotifySendVersion(probe.stdout));
  }

  private async sendPlain(notice: Notice): Promise<void> {
    const result = await this.run(this.command, buildNotifySendArgs(notice));
    if (result.exitCode !== 0) {
      throw new Error(
        `notify-send exited ${String(result.exitCode)}, expected 0. stderr: ${result.stderr || '(empty)'}`,
      );
    }
  }

  /**
   * Spawns the `--wait`ed, action-carrying `notify-send` detached (D-038) and returns as soon as
   * the OS confirms it started — the toast is already showing by then (this file's own module
   * docstring: `--wait` only delays the PROCESS's exit, never the toast's appearance). The
   * eventual click (or timeout, or dismissal) is handled by `handleClickResult` as a background
   * continuation, never awaited here.
   */
  private async sendWithClickAction(notice: Notice): Promise<void> {
    const launch = this.spawnDetached(this.command, buildNotifySendArgs(notice, true));
    const started = await launch.spawned;
    if (!started) {
      throw new Error(`notify-send (with click action) failed to start — command: ${this.command}`);
    }
    void launch.closed.then((result) => this.handleClickResult(result));
  }

  /** `result.stdout` is exactly the clicked action's NAME (`notify-send --help`'s own wording,
   * measured against 0.8.1) with nothing else — a dismissal or timeout prints nothing instead. Any
   * other value (a different action id, empty, whitespace) is not the click this project cares
   * about and is silently ignored, not an error: a person dismissing a notification is normal, not
   * a defect to report. */
  private async handleClickResult(result: { readonly stdout: string }): Promise<void> {
    if (result.stdout.trim() !== CLICKED_ACTION_ID) {
      return;
    }
    // Best-effort (D-025's own spirit applied to an action, not just data): a failed xdg-open here
    // just means the window never comes to front — no different from D-034's "notice, not a
    // decision" scope for this click, and nothing left in this project would be able to report a
    // failure this late anyway (the daemon has already moved on).
    await this.openProtocolUrl(PROTOCOL_LAUNCH_URL).catch(() => {});
  }
}
