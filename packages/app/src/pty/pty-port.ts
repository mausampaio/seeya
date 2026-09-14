/**
 * The port `node-pty` sits behind (AGENTS.md § "Dependências": "biblioteca de terceiro que faz
 * I/O fica atrás de uma porta"). Every module outside `pty/` depends on this interface, never on
 * `node-pty` directly — enforced by `eslint.config.js` (node-pty only importable in
 * `packages/app/src/pty/**`, the same inversion-of-onus technique as `spawnHidden`, D-038).
 */
export interface PtyHandle {
  readonly pid: number;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  /** Graceful-enough for a tab: sends the pty's own kill signal (D-038's exception for a session
   * the person explicitly opened doesn't apply the other way — a tab the person closes is the
   * person asking for it to end, same as closing a real terminal window). */
  kill(): void;
  onData(listener: (data: string) => void): void;
  onExit(listener: (event: { readonly exitCode: number }) => void): void;
}

export interface PtySpawnOptions {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly cols: number;
  readonly rows: number;
}

export interface PtySpawner {
  spawn(options: PtySpawnOptions): PtyHandle;
}
