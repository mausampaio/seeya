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

  /**
   * `write`/`resize`/`closeTab` below all return a boolean instead of throwing when `tabId` has
   * no live pty — a **tolerant no-op**, not an error. A tab whose process already exited (the
   * person typed `exit` in the shell) still sits in the renderer's tab strip (`tabs/tab-model.ts`:
   * closing never removes a tab, only marks it), and three ordinary UI actions can still target
   * it after that: typing into its (now inert) terminal, resizing the window (which resizes
   * EVERY open tab, including ones that just exited), or clicking its own close button a second
   * time. Each of those used to reach this class through an `ipcMain.on` handler with nothing
   * catching the resulting throw — an uncaught exception in a `ipcMain.on` listener becomes an
   * `uncaughtException` in Electron's main process, which pops "A JavaScript error occurred in
   * the main process" and, worse, `resizeTab` hits this for EVERY exited tab on EVERY window
   * resize, so the dialog could fire repeatedly from one resize. This is the exact same "a late
   * event for a tab that's already gone is expected, not a bug" reasoning
   * `tabs/tab-model.ts#updateTab`'s own docstring already gives for the identical race on the
   * model side — `PtyManager` needed the same tolerance, not a `try/catch` bolted onto
   * `electron/main.ts` around each call site.
   */
  private handleFor(tabId: string): PtyHandle | null {
    return this.ptys.get(tabId) ?? null;
  }

  /** `false` when `tabId` has no live pty (see this class's own docstring above) — never throws. */
  write(tabId: string, data: string): boolean {
    const handle = this.handleFor(tabId);
    if (handle === null) {
      return false;
    }
    handle.write(data);
    return true;
  }

  /** `electron/main.ts` calls this for every open tab when the window itself resizes
   * (docs/PLANO-DE-ENTREGA.md V2-T2: "redimensionar a janela redimensiona o pty") — one call per
   * tab, this function only knows about one. `false` when `tabId` has no live pty — never throws
   * (see this class's own docstring above; an exited tab is exactly what a resize routinely hits). */
  resize(tabId: string, cols: number, rows: number): boolean {
    const handle = this.handleFor(tabId);
    if (handle === null) {
      return false;
    }
    handle.resize(cols, rows);
    return true;
  }

  /** Ends the tab's process (docs/PLANO-DE-ENTREGA.md V2-T2: "fechar a aba encerra o processo").
   * The registered `onExit` callback still fires normally from the pty's own exit event — this
   * method doesn't call `callbacks.onExit` itself, so there is exactly one path that reports a
   * tab's exit, whether it asked for it or the process ended on its own. `false` when `tabId` has
   * no live pty — never throws (see this class's own docstring above: clicking an already-exited
   * tab's close button is the obvious way to hit this). */
  closeTab(tabId: string): boolean {
    const handle = this.handleFor(tabId);
    if (handle === null) {
      return false;
    }
    handle.kill();
    return true;
  }

  hasTab(tabId: string): boolean {
    return this.ptys.has(tabId);
  }
}
