/**
 * The one file allowed to import `node-pty` (`eslint.config.js`'s app-scoped rule, same
 * inversion-of-onus as `spawnHidden`, D-038) — implements the `PtySpawner` port (`pty-port.ts`)
 * every other module in `packages/app/src` depends on instead.
 *
 * **Not unit-tested against a real pty on purpose.** `node-pty`'s `spawn` launches a real OS
 * process; this file is a two-line pass-through with no branching of its own (`AGENTS.md` §
 * "Testes": every function has a test, but a zero-branch adapter this thin earns its coverage
 * from `pty/pty-manager.ts`'s own tests instead, which inject a FAKE `PtySpawner` — same "duplo
 * de I/O é classe nomeada implementando a porta" discipline `docs/TESTES.md` already asks
 * `adapters/` in the engine to follow). Real-pty behavior (TUI opens, resize, Ctrl+C, onExit) is
 * proven manually against the app aceite criteria instead (docs/PLANO-DE-ENTREGA.md V2-T2), the
 * same "spawn a real process" boundary `tests/integration/process/` already draws for the engine.
 */
import { spawn } from 'node-pty';
import type { PtyHandle, PtySpawnOptions, PtySpawner } from './pty-port.js';

export class NodePtyAdapter implements PtySpawner {
  spawn(options: PtySpawnOptions): PtyHandle {
    const ptyProcess = spawn(options.command, [...options.args], {
      name: 'xterm-256color',
      cols: options.cols,
      rows: options.rows,
      cwd: options.cwd,
      env: options.env,
      // ConPTY (Windows): never a console window of its own — measured in spike M item 4, the
      // same D-038 guarantee `spawnHidden` gives the engine's own spawns. Ignored on non-Windows
      // (the type declares it Windows-only; passing it elsewhere is a documented no-op).
      useConpty: true,
    });
    return {
      pid: ptyProcess.pid,
      write: (data) => ptyProcess.write(data),
      resize: (cols, rows) => ptyProcess.resize(cols, rows),
      kill: () => ptyProcess.kill(),
      onData: (listener) => ptyProcess.onData(listener),
      onExit: (listener) => ptyProcess.onExit((event) => listener({ exitCode: event.exitCode })),
    };
  }
}
