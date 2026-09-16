/**
 * Correlates one fallback confirmation request (V2-T4 item 3, S5-T9's "warn BEFORE, and ask" —
 * the app's own diálogo, mirroring the CLI's `readline` question) with the renderer's eventual
 * answer, by a `requestId` — the main-process half of a main→renderer→main round trip that
 * `ipcRenderer`/`ipcMain`'s own `send`/`on` (fire-and-forget in both directions) has no built-in
 * request/response shape for. Pure bookkeeping, no Electron here — `electron/main.ts` is the only
 * place that actually calls `window.webContents.send`/registers `ipcMain.on` around this.
 *
 * **Never more than one truly pending at a time in production**, because
 * `application/start-day.ts#resumeSessions` calls `deps.confirmFallback` sequentially inside its
 * own loop — but this class doesn't assume that itself (each request gets its own id, keyed
 * independently), the same defensive shape `ExitListenerRegistry` already takes for tab ids rather
 * than trusting a caller's usage pattern to stay singular forever.
 */
export type FallbackDialogDecision = 'open' | 'skip';

export class PendingFallbackRequests {
  private readonly resolvers = new Map<string, (decision: FallbackDialogDecision) => void>();
  private counter = 0;

  /**
   * Registers a new pending request and returns its id plus a promise that resolves once
   * `resolve(requestId, decision)` is called for it — never rejects: a fallback question always
   * gets SOME answer (closing the dialog without choosing counts as "skip", per V2-T4's own
   * cuidado, decided by the renderer before it ever calls back here).
   */
  create(): { readonly requestId: string; readonly answer: Promise<FallbackDialogDecision> } {
    this.counter += 1;
    const requestId = `fallback-${this.counter}`;
    const answer = new Promise<FallbackDialogDecision>((resolve) => {
      this.resolvers.set(requestId, resolve);
    });
    return { requestId, answer };
  }

  /**
   * Resolves the pending request `requestId`, if any. A stale or unknown id — the renderer
   * replying twice, or after the window reloaded mid-question — is a silent no-op, never a throw,
   * same tolerant discipline `ExitListenerRegistry#fire` already uses for a tab id nobody
   * registered.
   */
  resolve(requestId: string, decision: FallbackDialogDecision): void {
    const resolver = this.resolvers.get(requestId);
    if (resolver === undefined) {
      return;
    }
    this.resolvers.delete(requestId);
    resolver(decision);
  }
}
