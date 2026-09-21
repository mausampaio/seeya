/**
 * Argument array for `seeya project open` (V2-T28) — opens `claude` fresh (no `--resume`, no
 * prompt) with each associated repository's local path released via `--add-dir`.
 * `docs/spikes/N-adocao-de-sessao.md`'s own Achado 1: `--add-dir` is declared variadic in
 * `claude --help` and swallows the next positional argument if nothing terminates the list — a
 * fresh `open` has no prompt to protect today, but this always appends `--` right after the
 * directories anyway, so a future caller that adds one here can't reintroduce the bug the spike
 * found by forgetting it.
 */

/**
 * @example
 * buildOpenArgs([]) // []
 * buildOpenArgs(['/code/app-api', '/code/app-web'])
 * // ['--add-dir', '/code/app-api', '/code/app-web', '--']
 */
export function buildOpenArgs(addDirs: readonly string[]): string[] {
  if (addDirs.length === 0) {
    return [];
  }
  return ['--add-dir', ...addDirs, '--'];
}
