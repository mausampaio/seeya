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

export interface NodePtyAdapterOptions {
  /**
   * V2-T6 (measured on the maintainer's Windows 11 build 26200, 2026-09-17): `true` makes
   * node-pty load the ConPTY it bundles (Windows Terminal's `conpty.dll` + `OpenConsole.exe`,
   * `node_modules/node-pty/third_party/conpty/`) instead of the one built into Windows. The inbox
   * ConPTY renders differentially and, after a window resize, its model of the screen diverged
   * from xterm.js's reflowed buffer — two-character leftovers from the previous layout stayed at
   * columns 0-1 of many rows. Five variants were measured by hand (xterm.js's `windowsPty`
   * option with the real build, with a pre-21376 build that turns its reflow off, no option at
   * all, and the bundled ConPTY with/without it): only the bundled ConPTY without the option was
   * clean — it repaints the whole viewport after a resize, which the inbox one did not (the
   * leftover is visible for a few milliseconds and then gone). node-pty's own typings call the
   * option experimental; VS Code ships it on by default. The composition root passes `true` only
   * on win32 (the DLL is Windows-only; node-pty documents the sibling `useConpty` as a no-op
   * elsewhere, and this one is not passed at all off Windows rather than trusting that).
   */
  readonly useConptyDll: boolean;
}

export class NodePtyAdapter implements PtySpawner {
  constructor(private readonly options: NodePtyAdapterOptions) {}

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
      ...(this.options.useConptyDll ? { useConptyDll: true } : {}),
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
