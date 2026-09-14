/**
 * Resolves a harness command name (`claude`, `codex`) to something `node-pty`'s `spawn` will
 * actually find (V2-T2, item 4; docs/spikes/M-terminal-embutido.md's own "Correção depois do
 * spike"): **on Windows, `node-pty` does not consult `PATH` nor complete an extension** —
 * `pty.spawn('claude', ...)` fails with `File not found` even though `claude` runs fine from a
 * real shell prompt, because a shell does that PATH/`PATHEXT` search itself before ever calling
 * `CreateProcess`. `codex` on Windows is additionally an npm shim (`codex.cmd`), which Windows can
 * only execute through `cmd.exe /c` — passing a bare `.cmd` path to `CreateProcess` fails the same
 * way.
 *
 * This is a NEW module, not moved from anywhere — the problem is generic to any interactive
 * embedded-pty launch, so it lives in the engine (not `packages/app/src`) for the same reason
 * `docs/PLANO-DE-ENTREGA.md` V2-T2 gives: "o mesmo problema vai aparecer quando o `start-day` abrir
 * abas (V2-T3), então não pertence à interface."
 *
 * **No I/O of its own.** `CommandResolutionFs.fileExists` is the one port this module depends on
 * — tests inject a fake, in-memory filesystem (`docs/TESTES.md`: "duplo de I/O é classe/objeto
 * nomeado implementando a porta") instead of touching a real disk, and `platform`/`pathEnv`/
 * `pathExtEnv` are parameters, never `process.platform`/`process.env` read directly (AGENTS.md's
 * own "cuidado": no bare `process.platform === 'win32'` outside an adapter with both branches next
 * to each other — this IS that adapter). The real caller (`packages/app/src/composition/index.ts`)
 * reads the real values once and passes them in, plus a real `fileExists` backed by `node:fs`.
 */
import { access } from 'node:fs/promises';

/** A command resolved to something safe to hand to `node-pty`'s `spawn` directly. */
export interface ResolvedCommand {
  readonly command: string;
  readonly args: readonly string[];
}

/**
 * `command` could not be found anywhere in `PATH` (POSIX), or under any `PATH`/`PATHEXT`
 * combination (Windows). `searched` is the exact list of paths this module actually checked —
 * AGENTS.md's error-message rule ("a mensagem inclui o valor que causou o erro e a forma
 * esperada"): a caller can show the person precisely where it looked, not just "not found".
 */
export interface UnresolvedCommand {
  readonly searched: readonly string[];
}

export type ResolveCommandResult =
  | { readonly kind: 'resolved'; readonly resolved: ResolvedCommand }
  | { readonly kind: 'notFound'; readonly unresolved: UnresolvedCommand };

/** The one I/O this module needs — implemented for real against `node:fs` (`realCommandResolutionFs`
 * below) by the caller, and by an in-memory fake in tests. */
export interface CommandResolutionFs {
  fileExists(path: string): Promise<boolean>;
}

/**
 * The real, `node:fs`-backed `CommandResolutionFs` — the only piece of this module that touches a
 * real disk. `access` (not `stat`) because the question is exactly "can this be found and
 * executed", never anything about the entry's other metadata; any error (permission, ENOENT, a
 * directory answering to the name) means "not this one", not "resolution failed" — a strict
 * PATH walk skips a candidate it can't use, it doesn't abort the search over it.
 */
export const realCommandResolutionFs: CommandResolutionFs = {
  async fileExists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  },
};

export interface ResolveCommandOptions {
  readonly platform: NodeJS.Platform;
  /** `process.env.PATH` (or `Path` — Windows env var lookup is case-insensitive, but this
   * parameter is not: the caller passes whichever key its own `process.env` actually resolved,
   * same discipline as everywhere else in this project that reads an environment variable once,
   * at the composition root, and hands the plain value down. */
  readonly pathEnv: string | undefined;
  /** Windows only. Defaults to the same list `cmd.exe` itself defaults to when `PATHEXT` is unset
   * (`DEFAULT_WINDOWS_PATHEXT` below) — matches what a real shell would try. */
  readonly pathExtEnv: string | undefined;
  readonly fs: CommandResolutionFs;
}

const POSIX_PATH_SEPARATOR = ':';
const WINDOWS_PATH_SEPARATOR = ';';

/** `cmd.exe`'s own default when `PATHEXT` is unset — order matters (first match wins), same as a
 * real shell. */
const DEFAULT_WINDOWS_PATHEXT = ['.COM', '.EXE', '.BAT', '.CMD'];

/** Extensions that can only ever run through `cmd.exe /c` (docs/spikes/M-terminal-embutido.md: the
 * `codex` case) — Win32's `CreateProcess` cannot launch a `.cmd`/`.bat` script directly. */
const SHELL_SCRIPT_EXTENSIONS = new Set(['.BAT', '.CMD']);

function splitPath(pathEnv: string | undefined, separator: string): readonly string[] {
  if (pathEnv === undefined || pathEnv === '') {
    return [];
  }
  return pathEnv.split(separator).filter((entry) => entry !== '');
}

function joinPath(directory: string, fileName: string, platform: NodeJS.Platform): string {
  const separator = platform === 'win32' ? '\\' : '/';
  const endsWithSeparator = directory.endsWith('/') || directory.endsWith('\\');
  return endsWithSeparator ? `${directory}${fileName}` : `${directory}${separator}${fileName}`;
}

async function resolvePosix(
  command: string,
  args: readonly string[],
  options: ResolveCommandOptions,
): Promise<ResolveCommandResult> {
  const searched: string[] = [];
  for (const directory of splitPath(options.pathEnv, POSIX_PATH_SEPARATOR)) {
    const candidate = joinPath(directory, command, options.platform);
    searched.push(candidate);
    if (await options.fs.fileExists(candidate)) {
      return { kind: 'resolved', resolved: { command: candidate, args } };
    }
  }
  return { kind: 'notFound', unresolved: { searched } };
}

function windowsPathExt(pathExtEnv: string | undefined): readonly string[] {
  const parsed = splitPath(pathExtEnv, WINDOWS_PATH_SEPARATOR);
  return parsed.length > 0
    ? parsed.map((extension) => extension.toUpperCase())
    : DEFAULT_WINDOWS_PATHEXT;
}

/** `true` when `command` already ends with one of `extensions` — a caller that already typed
 * `claude.exe` shouldn't have `.exe` appended a second time. Case-insensitive, matching Windows'
 * own filesystem semantics. */
function hasKnownExtension(command: string, extensions: readonly string[]): boolean {
  const upper = command.toUpperCase();
  return extensions.some((extension) => upper.endsWith(extension));
}

async function resolveWindows(
  command: string,
  args: readonly string[],
  options: ResolveCommandOptions,
): Promise<ResolveCommandResult> {
  const extensions = windowsPathExt(options.pathExtEnv);
  const candidateExtensions = hasKnownExtension(command, extensions) ? [''] : extensions;
  const searched: string[] = [];
  for (const directory of splitPath(options.pathEnv, WINDOWS_PATH_SEPARATOR)) {
    for (const extension of candidateExtensions) {
      const candidate = joinPath(directory, `${command}${extension}`, options.platform);
      searched.push(candidate);
      if (await options.fs.fileExists(candidate)) {
        return { kind: 'resolved', resolved: resolveWindowsMatch(candidate, args, extension) };
      }
    }
  }
  return { kind: 'notFound', unresolved: { searched } };
}

/** `extension` is `''` when `command` already carried its own extension — read it back off the
 * resolved path instead, so a `claude.cmd` typed directly still gets wrapped in `cmd.exe /c`. */
function resolveWindowsMatch(
  candidate: string,
  args: readonly string[],
  extension: string,
): ResolvedCommand {
  const effectiveExtension =
    extension === '' ? candidate.slice(candidate.lastIndexOf('.')) : extension;
  if (SHELL_SCRIPT_EXTENSIONS.has(effectiveExtension.toUpperCase())) {
    // Win32's CreateProcess cannot launch a .cmd/.bat directly (spike M's own measurement) — only
    // cmd.exe /c can. /d disables AutoRun scripts (a user's own cmd.exe customization should never
    // silently run before ours); /s keeps the quoting cmd.exe itself would produce for a path with
    // spaces (the common case for a real npm global install path).
    return { command: 'cmd.exe', args: ['/d', '/s', '/c', candidate, ...args] };
  }
  return { command: candidate, args };
}

/**
 * Resolves `command` for the given `options.platform` — POSIX (`PATH` only, no extension games)
 * or Windows (`PATH` × `PATHEXT`, `.cmd`/`.bat` wrapped in `cmd.exe /c`). `args` pass through
 * unchanged except in the `.cmd`/`.bat` case, where they become `cmd.exe`'s own trailing
 * arguments.
 *
 * @example
 * const result = await resolveCommand('codex', ['--resume', id], {
 *   platform: process.platform,
 *   pathEnv: process.env.PATH,
 *   pathExtEnv: process.env.PATHEXT,
 *   fs: realCommandResolutionFs,
 * });
 */
export function resolveCommand(
  command: string,
  args: readonly string[],
  options: ResolveCommandOptions,
): Promise<ResolveCommandResult> {
  return options.platform === 'win32'
    ? resolveWindows(command, args, options)
    : resolvePosix(command, args, options);
}
