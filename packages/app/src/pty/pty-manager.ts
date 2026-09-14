/**
 * Maps tab ids to live `PtyHandle`s (`pty-port.ts`) — the one place that knows which pty backs
 * which tab, so `electron/main.ts` (IPC wiring, D-041: no logic of its own) can address a tab by
 * id without holding a `PtyHandle` reference itself. Depends only on the `PtySpawner` PORT, never
 * on `node-pty` directly — testable with a fake spawner (`AGENTS.md` § "Testes": "duplo de I/O é
 * classe nomeada"), which is exactly how this file's own tests exercise it.
 */
import type { PtyHandle, PtySpawnOptions, PtySpawner } from './pty-port.js';

export interface PtyManagerCallbacks {
  /** Fires for every chunk of output a tab's pty produces. */
  readonly onData: (tabId: string, data: string) => void;
  /** Fires exactly once per tab, when its process ends — whether by `/exit`, Ctrl+C, or
   * `closeTab` calling `PtyHandle.kill()`. */
  readonly onExit: (tabId: string, exitCode: number) => void;
}

/**
 * Thrown by `write`/`resize`/`closeTab` for a `tabId` this manager never created (or already
 * removed) a pty for — never a silent no-op: unlike `tabs/tab-model.ts#updateTab` (which tolerates
 * an update racing a removal because a pty CALLBACK firing late is expected and harmless), a
 * caller explicitly asking to write to/resize/close a specific tab that doesn't exist is a bug in
 * the caller, and AGENTS.md's error-message rule applies: say the id that was asked for.
 */
export class UnknownTabError extends Error {
  constructor(tabId: string) {
    super(`no pty is registered for tab "${tabId}"`);
    this.name = 'UnknownTabError';
  }
}

export class PtyManager {
  private readonly ptys = new Map<string, PtyHandle>();

  constructor(
    private readonly spawner: PtySpawner,
    private readonly callbacks: PtyManagerCallbacks,
  ) {}

  /** Spawns a pty for `tabId` and returns its pid (`tabs/tab-model.ts#withPid` records it on the
   * `Tab`). Registers `onData`/`onExit` forwarding before returning, so no chunk of early output
   * (a shell's own startup banner, for example) is ever lost between spawn and subscription. */
  create(tabId: string, options: PtySpawnOptions): number {
    const handle = this.spawner.spawn(options);
    this.ptys.set(tabId, handle);
    handle.onData((data) => this.callbacks.onData(tabId, data));
    handle.onExit(({ exitCode }) => {
      this.ptys.delete(tabId);
      this.callbacks.onExit(tabId, exitCode);
    });
    return handle.pid;
  }

  private handleFor(tabId: string): PtyHandle {
    const handle = this.ptys.get(tabId);
    if (handle === undefined) {
      throw new UnknownTabError(tabId);
    }
    return handle;
  }

  write(tabId: string, data: string): void {
    this.handleFor(tabId).write(data);
  }

  /** `electron/main.ts` calls this for every open tab when the window itself resizes
   * (docs/PLANO-DE-ENTREGA.md V2-T2: "redimensionar a janela redimensiona o pty") — one call per
   * tab, this function only knows about one. */
  resize(tabId: string, cols: number, rows: number): void {
    this.handleFor(tabId).resize(cols, rows);
  }

  /** Ends the tab's process (docs/PLANO-DE-ENTREGA.md V2-T2: "fechar a aba encerra o processo").
   * The registered `onExit` callback still fires normally from the pty's own exit event — this
   * method doesn't call `callbacks.onExit` itself, so there is exactly one path that reports a
   * tab's exit, whether it asked for it or the process ended on its own. */
  closeTab(tabId: string): void {
    this.handleFor(tabId).kill();
  }

  hasTab(tabId: string): boolean {
    return this.ptys.has(tabId);
  }
}
