/**
 * Notification adapter: native per-OS toast, implements `Notifier` (`core/ports.ts`,
 * docs/ARQUITETURA.md, docs/PLANO-DE-ENTREGA.md S4-T1).
 *
 * Spike B's fallback chain (docs/spikes/B-notificacoes.md § "Cadeia de fallback proposta"): one
 * native backend per OS, degrading to `StderrBackend` when nothing is available or every attempt
 * fails (`chain.ts#ChainNotifier`, docs/TESTES.md § "Cadeia de fallback do notificador").
 *
 * **No action buttons** (docs/ESPECIFICACAO.md § "Notificações"): the contract is title + body
 * only. Spike B's own chain sketched a SECOND, action-capable tier per OS (`terminal-notifier` on
 * macOS, `notify-send -A` on Linux, WinRT's `activationType="protocol"` on Windows) — cut here
 * because nothing in this task's contract depends on a click, and `terminal-notifier` specifically
 * would add an external binary "que pode não estar instalado" for a capability nothing uses yet.
 * See docs/QUESTOES.md Q-038 and `scripts/validate-windows-toast-protocol.mjs` for the one piece
 * of that cut tier docs/PLANO-DE-ENTREGA.md still asks to prepare: manual validation of Windows'
 * `activationType="protocol"`, which only a human at a real desktop can do.
 *
 * Everything else in this directory (`backend.ts`, `chain.ts`, `stderr-backend.ts`,
 * `windows-toast.ts`, `macos-osascript.ts`, `linux-notify-send.ts`) is this module's own internal
 * wiring — not re-exported, same "adapter's public surface is its `index.ts`" convention
 * `adapters/discovery/index.ts`/`adapters/generation/index.ts` already follow. Tests import the
 * specific file they need directly.
 *
 * **V2-T5b item 5: the Windows backend can now include `launch="seeya://open"` on the toast** —
 * still no `<actions>` element, still no button (D-034's closing paragraph is explicit this
 * doesn't change): a click on the toast BODY asks Windows to activate whatever registered
 * `seeya://` protocol handler, which the interface's own composition root registers. Whether to
 * include it depends on `Storage.readProtocolHandlerRegistered()` (D-025) — a fact this adapter
 * has no `Storage` of its own to read (D-020), so `buildNotifier` below is what a caller WITH a
 * `Storage` uses instead of the bare `notifier` singleton.
 *
 * **V2-T8 item 4: the Linux backend gets the same click, by a different mechanism.** `notify-send
 * -A default=Open --wait`, detached (D-038) — same gate (`Storage.readProtocolHandlerRegistered()`)
 * plus a `notify-send` version check (`linux-notify-send.ts`'s own docstring: 0.7.10+). Still the
 * toast BODY, still no button — D-034 unchanged. macOS has no such mechanism this task adds:
 * `osascript` cannot deliver a click back to the process that showed the notification.
 */
import type { Notifier } from '../../core/ports.js';
import type { NotificationBackend } from './backend.js';
import { ChainNotifier } from './chain.js';
import { WindowsToastBackend } from './windows-toast.js';
import { MacOsascriptBackend } from './macos-osascript.js';
import { LinuxNotifySendBackend } from './linux-notify-send.js';

/**
 * One native backend per OS. `platform` defaults to `process.platform` but is overridable — same
 * default-parameter seam `adapters/process/termination.ts#terminateGracefully` already uses — so
 * this factory itself stays unit-testable without depending on which OS actually runs the test
 * (the S2-T1 lesson: a test that only passes on one OS hides a defect on the other two). An
 * unrecognized `platform` returns no native backend at all: `ChainNotifier` still works, falling
 * straight to its own built-in stderr fallback.
 *
 * `isProtocolHandlerRegistered` is read by BOTH the Windows and the Linux branch (V2-T5b item 5;
 * V2-T8 item 4) — passed straight through to each backend's own option of the same name. macOS has
 * no toast-click mechanism this project wires up at all (V2-T8's own "o que não entra": `osascript`
 * cannot deliver a click back, see that module's own docstring).
 */
export function buildDefaultBackends(
  platform: NodeJS.Platform = process.platform,
  isProtocolHandlerRegistered?: () => Promise<boolean>,
): NotificationBackend[] {
  if (platform === 'win32') {
    return [
      new WindowsToastBackend(
        isProtocolHandlerRegistered === undefined ? {} : { isProtocolHandlerRegistered },
      ),
    ];
  }
  if (platform === 'darwin') {
    return [new MacOsascriptBackend()];
  }
  if (platform === 'linux') {
    return [
      new LinuxNotifySendBackend(
        isProtocolHandlerRegistered === undefined ? {} : { isProtocolHandlerRegistered },
      ),
    ];
  }
  return [];
}

/** Ready-to-use singleton, same convention `adapters/process/index.ts#processControl` already
 * established — `cli/` (D-020) imports this directly rather than constructing the chain itself.
 * Never includes the V2-T5b `launch` attribute (no `isProtocolHandlerRegistered` passed) — a
 * caller that HAS a `Storage` to check (`packages/cli/src/composition.ts#buildDaemonContext`, the
 * one place that matters — "quem manda o toast é o daemon") uses `buildNotifier` below instead. */
export const notifier: Notifier = new ChainNotifier(buildDefaultBackends());

/**
 * V2-T5b item 5: the notifier a caller WITH a `Storage` builds instead of importing the bare
 * `notifier` singleton above — so far, only `cli/composition.ts#buildDaemonContext` (the daemon is
 * what sends every toast this project shows; the interface itself never sends its own, this task's
 * own "alternativa descartada"). `platform` defaults to `process.platform`, same seam
 * `buildDefaultBackends` already offers.
 */
export function buildNotifier(
  isProtocolHandlerRegistered: () => Promise<boolean>,
  platform: NodeJS.Platform = process.platform,
): Notifier {
  return new ChainNotifier(buildDefaultBackends(platform, isProtocolHandlerRegistered));
}
