/**
 * A pending one-shot listener per tab id (V2-T4 item 2). `pty/pty-manager.ts#PtyManagerCallbacks`
 * only ever holds ONE `onExit` callback for the whole manager's lifetime (wired once, in
 * `electron/main.ts#wireIpc`, dispatching every tab's exit through it by id) — there is no second
 * slot a `TabSessionResumer` could register its own listener into directly. This registry is what
 * lets that single, already-wired callback ALSO notify the resumer's fast-failure race for the
 * specific tabs it opened, without touching `PtyManager` itself: `main.ts`'s own `onExit` callback
 * calls `fire(id, exitCode)` after its ordinary work (marking the tab exited, sending
 * `CHANNELS.tabExit`) — a no-op for the overwhelming majority of tabs (opened from the command
 * bar, never registered here at all).
 */
export class ExitListenerRegistry {
  private readonly listeners = new Map<string, (exitCode: number) => void>();

  /** Registers `listener` for `id`'s next exit. A second `register` call for the same `id` before
   * it fires replaces the first — `TabSessionResumer` never registers twice for the same tab, but
   * "last one wins" is the same tolerant behavior `tabs/tab-model.ts#updateTab` already gives a
   * late event, rather than throwing on a caller mistake this class has no way to diagnose. */
  register(id: string, listener: (exitCode: number) => void): void {
    this.listeners.set(id, listener);
  }

  /**
   * Fires the listener registered for `id`, if any, and forgets it — a listener only ever fires
   * once (V2-T4: "fires at most once"). Nothing to do for an `id` nobody registered, which is the
   * ordinary case for every tab the command bar (not the resumer) opened.
   */
  fire(id: string, exitCode: number): void {
    const listener = this.listeners.get(id);
    if (listener === undefined) {
      return;
    }
    this.listeners.delete(id);
    listener(exitCode);
  }
}
