/**
 * V2-T8 item 3: the `PATH` a person's login shell would compute, read once at startup so
 * `resolve-command.ts` and every tab's spawn environment see `~/.local/bin`, `nvm`, or a global
 * npm prefix — exactly where `claude`/`codex` tend to live.
 *
 * **The defect this fixes (measured on Linux, matches VS Code's own long-standing issue of the
 * same name).** An app launched from a graphical menu (`.desktop` file, Dock, Start Menu) is a
 * child of the desktop session's own init process, not of a login shell — it inherits whatever
 * `PATH` that session started with, which is usually just `/usr/bin:/bin` and never runs
 * `~/.profile`/`~/.bashrc`/`~/.zshrc`. Opened from a terminal instead, the shell already expanded
 * `PATH` before `exec`-ing the app, so the same binary "works from the terminal, not from the
 * icon" — the defect only exists once the app is installed and launched the graphical way, which
 * is exactly why `npm run app` never surfaced it.
 *
 * **Windows is excluded by construction, not by an `if`.** `composition/index.ts` never calls
 * `readLoginShellPath` there: Windows has no login-shell/`PATH`-in-profile-script split — the
 * environment block a `.exe` launched from the Start Menu receives already IS the user's `PATH`
 * (Explorer builds it from the registry, not from a script an interactive shell would sponsor).
 * `$SHELL` also doesn't exist as a concept there.
 *
 * **Why a marker line, not just "trust the whole stdout".** `-l` (login) makes the shell source
 * profile scripts that can print anything — a MOTD, an `nvm` banner, a stray `echo` from someone's
 * `.bashrc`. This module never assumes stdout IS the `PATH`; it looks for one line starting with
 * `marker + ':'`, and there can be noise before or after it.
 */

/** Prefixes the one line this module looks for. Long and specific on purpose — a real profile
 * script printing this exact token by coincidence is not a real risk this module needs to guard
 * against further. */
export const LOGIN_SHELL_PATH_MARKER = '__seeya_login_shell_path__';

/**
 * The argv this module hands to `spawnHidden(shellCommand, ...)` (composition root only — this
 * function has no I/O of its own). `-l` sources login profile scripts (the whole point); `-i`
 * (interactive) is required too — measured against `bash`/`zsh`: a NON-interactive login shell
 * skips `~/.bashrc`/most of `~/.zshrc`, which is frequently where `nvm`/a global npm prefix are
 * actually appended to `PATH`, as opposed to `~/.profile`. `-c '<script>'` runs one command and
 * exits instead of opening an interactive prompt.
 *
 * The script itself is a single `printf`, not `echo $PATH`: `printf '%s'` never re-interprets a
 * `PATH` entry that happens to contain a backslash or a leading `-`, which some `echo`
 * implementations do.
 *
 * @example
 * buildLoginShellPathArgs('/bin/bash')
 * // → ['-lic', 'printf "%s%s\\n" "__seeya_login_shell_path__:" "$PATH"']
 */
export function buildLoginShellPathArgs(): readonly string[] {
  return ['-lic', `printf "%s%s\\n" "${LOGIN_SHELL_PATH_MARKER}:" "$PATH"`];
}

/**
 * Picks the marked line out of `stdout` and returns the `PATH` value it carries — `undefined` when
 * no line starts with `marker + ':'` at all (the shell errored before reaching the `printf`, or
 * produced no output). Scans every line and keeps the LAST match rather than the first: a profile
 * script that itself echoes the marker text earlier (pathological, but this module doesn't need to
 * trust that it can't happen) should never win over the line this module actually asked for, which
 * is always the last thing `-c`'s own command prints.
 *
 * An empty `PATH` value (the shell ran but exported `PATH=""`) still returns `''`, not `undefined`
 * — that IS the value the login shell computed, and pretending it wasn't found would call
 * `composition/index.ts`'s inherited-`PATH` fallback instead of the empty string this measured for
 * real (D-025: don't upgrade "empty" into "missing").
 *
 * @example
 * parseLoginShellPathOutput(
 *   'Welcome!\n__seeya_login_shell_path__:/usr/local/bin:/usr/bin\n',
 *   LOGIN_SHELL_PATH_MARKER,
 * ) // → '/usr/local/bin:/usr/bin'
 */
export function parseLoginShellPathOutput(
  stdout: string,
  marker: string = LOGIN_SHELL_PATH_MARKER,
): string | undefined {
  const prefix = `${marker}:`;
  // A stray trailing `\r` (a shell whose output somehow carries CRLF) would otherwise leak into
  // the parsed PATH's last entry — stripped defensively, even though this only ever runs on
  // POSIX shells that emit bare `\n`.
  const lines = stdout.split('\n').map((line) => line.replace(/\r$/, ''));
  let found: string | undefined;
  for (const line of lines) {
    if (line.startsWith(prefix)) {
      found = line.slice(prefix.length);
    }
  }
  return found;
}
