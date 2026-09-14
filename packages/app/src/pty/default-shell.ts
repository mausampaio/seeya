/**
 * The system shell a tab opens when the person picks "shell" instead of a named harness
 * (`claude`/`codex`) in the command bar (docs/PLANO-DE-ENTREGA.md V2-T2, item 3). Pure: takes
 * `platform`/`env` as parameters instead of reading `process.platform`/`process.env` itself, the
 * same discipline `docs/PLANO-DE-ENTREGA.md`'s own "cuidados" ask for ("nenhum
 * `process.platform === 'win32'` fora de um adapter com o caso Linux/macOS ao lado") — this
 * module IS that adapter, and both branches sit right next to each other. The real
 * `process.platform`/`process.env` are read exactly once, at the composition root
 * (`composition/index.ts`), same as every other real-environment read in this project.
 *
 * **Not `adapters/process/resolve-command.ts` (engine, V2-T2 item 4).** That function resolves a
 * NAMED harness binary (`claude`, `codex`) by walking `PATH`/`PATHEXT` — the fix for spike M's
 * third finding (`node-pty` on Windows doesn't search `PATH` itself). A shell is different: on
 * Windows, `cmd.exe` lives in `%SystemRoot%\System32`, which Win32's own `CreateProcess` search
 * order includes even without walking `PATH` by hand (it has its extension already, needs no
 * `PATHEXT` completion); on POSIX, `$SHELL` is already an absolute path when set. Neither needs
 * the harness resolver's PATH walk — this function is the shell's own, simpler case.
 */
export interface ShellCommand {
  readonly command: string;
  readonly args: readonly string[];
}

const WINDOWS_FALLBACK_SHELL = 'cmd.exe';
const POSIX_FALLBACK_SHELL = '/bin/sh';

export function defaultShellCommand(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
): ShellCommand {
  if (platform === 'win32') {
    return { command: env.COMSPEC ?? WINDOWS_FALLBACK_SHELL, args: [] };
  }
  return { command: env.SHELL ?? POSIX_FALLBACK_SHELL, args: [] };
}
