/**
 * Correlates one pending main→renderer→main confirmation round trip with the renderer's eventual
 * answer, by a `requestId` — the same job `resume/pending-fallback-requests.ts
 * #PendingFallbackRequests` already does for the fallback dialog (V2-T4 item 3), generalized here
 * (V2-T30) because the "Open" project flow now needs THREE of these (the read-only-lock question,
 * the adoption launch question, the adoption commit question) and a fourth copy of the identical
 * eleven-line class would be exactly the duplication AGENTS.md rules out. `PendingFallbackRequests`
 * itself is left untouched — it already has its own tests and callers, and this task's own risk
 * budget is better spent not touching V2-T4's tested code for a rename.
 *
 * Pure bookkeeping, no Electron here — `electron/project-ipc.ts` is the only place that actually
 * calls `window.webContents.send`/registers `ipcMain.on` around one of these.
 */
export class PendingConfirmations<TAnswer> {
  private readonly resolvers = new Map<string, (answer: TAnswer) => void>();
  private counter = 0;

  constructor(private readonly idPrefix: string) {}

  /**
   * Registers a new pending request and returns its id plus a promise that resolves once
   * `resolve(requestId, answer)` is called for it.
   */
  create(): { readonly requestId: string; readonly answer: Promise<TAnswer> } {
    this.counter += 1;
    const requestId = `${this.idPrefix}-${this.counter}`;
    const answer = new Promise<TAnswer>((resolve) => {
      this.resolvers.set(requestId, resolve);
    });
    return { requestId, answer };
  }

  /**
   * Resolves the pending request `requestId`, if any. A stale or unknown id — the renderer
   * replying twice, or after the window reloaded mid-question — is a silent no-op, never a throw,
   * same tolerant discipline `PendingFallbackRequests.resolve`/`ExitListenerRegistry.fire` already
   * follow.
   */
  resolve(requestId: string, answer: TAnswer): void {
    const resolver = this.resolvers.get(requestId);
    if (resolver === undefined) {
      return;
    }
    this.resolvers.delete(requestId);
    resolver(answer);
  }
}
