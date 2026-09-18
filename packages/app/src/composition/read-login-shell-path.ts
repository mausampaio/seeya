/**
 * V2-T8 item 3: the one piece of I/O `login-shell-path.ts`'s own pure module doesn't do — actually
 * spawning the login shell and collecting its stdout. Split into its own file (not left inline in
 * `composition/index.ts`, even though "a leitura mora na raiz de composição" — this file lives
 * inside `composition/`, so that's still true) for the same reason `vitest.config.ts` already
 * carves `termination-posix.ts` out of `adapters/process/termination.ts`: **this code is
 * structurally unreachable on Windows** — `composition/index.ts` only ever calls it for
 * `platform !== 'win32'` — so it needs to be excluded from a Windows coverage run's own
 * denominator the same way `POSIX_ONLY_SOURCE` already excludes `termination-posix.ts`, without
 * having to carve out one function's worth of lines from a much bigger file that IS exercised on
 * every platform. `verificar:linux` (a real Linux container) exercises this file for real, against
 * a real `/bin/sh`/`bash`/`zsh`.
 */
import { spawnHidden } from '@seeya-ai/engine/adapters/process/spawn.js';
import { buildLoginShellPathArgs, parseLoginShellPathOutput } from './login-shell-path.js';

/** "Prazo curto" (V2-T8 item 3's own wording): long enough for a real login shell to source its
 * profile scripts, short enough that a broken/hanging one never delays startup noticeably. Not
 * measured against every shell on every distro — chosen as a round, generous number; a shell that
 * needs longer than this to print one line is already unusual enough that falling back to the
 * inherited `PATH` is the right call, not a bug to chase. */
export const LOGIN_SHELL_PATH_TIMEOUT_MS = 2000;

/**
 * Runs `shellCommand -lic 'printf ...'` (`login-shell-path.ts#buildLoginShellPathArgs`) hidden
 * (`spawnHidden`, D-038) and parses its stdout. Resolves `undefined` on ANY failure — nonzero
 * exit, timeout (`LOGIN_SHELL_PATH_TIMEOUT_MS`), a spawn error (shell not found), or stdout with no
 * marker line — never rejects, so `composition/index.ts` never needs a try/catch of its own; every
 * one of those cases is indistinguishable from "nothing to read" as far as the caller's fallback
 * (keep `process.env.PATH`) is concerned.
 *
 * @example
 * const path = await readLoginShellPath('/bin/zsh'); // undefined if it fails or times out
 */
export function readLoginShellPath(shellCommand: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    let stdout = '';
    let settled = false;
    const finish = (value: string | undefined): void => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(value);
    };
    let child: ReturnType<typeof spawnHidden>;
    try {
      child = spawnHidden(shellCommand, buildLoginShellPathArgs(), {
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: LOGIN_SHELL_PATH_TIMEOUT_MS,
      });
    } catch {
      finish(undefined);
      return;
    }
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.on('error', () => finish(undefined));
    child.on('close', (exitCode) => {
      finish(exitCode === 0 ? parseLoginShellPathOutput(stdout) : undefined);
    });
  });
}
