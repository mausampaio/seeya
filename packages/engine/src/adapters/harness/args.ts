/**
 * Argument array for `seeya project open` (V2-T28) — opens `claude` fresh (no `--resume`, no
 * prompt) with each associated repository's local path released via `--add-dir`.
 * `docs/spikes/N-adocao-de-sessao.md`'s own Achado 1: `--add-dir` is declared variadic in
 * `claude --help` and swallows the next positional argument if nothing terminates the list — a
 * fresh `open` has no prompt to protect today, but this always appends `--` right after the
 * directories anyway, so a future caller that adds one here can't reintroduce the bug the spike
 * found by forgetting it.
 *
 * **`--session-id`/`--append-system-prompt` (V2-T35 items 2/4) come FIRST, before `--add-dir`** —
 * so the variadic `--add-dir` list is never adjacent to another flag's own value; it only ever has
 * to worry about what follows it, which after this function is always either nothing or the `--`
 * terminator (`core/ports.ts#HarnessLauncher.open`'s own docstring on both values' origin).
 */

/**
 * @example
 * buildOpenArgs([], '11111111-1111-4111-8111-111111111111', null)
 * // ['--session-id', '11111111-1111-4111-8111-111111111111']
 * buildOpenArgs(['/code/app-api', '/code/app-web'], '11111111-1111-4111-8111-111111111111', 'note')
 * // ['--session-id', '...', '--append-system-prompt', 'note', '--add-dir', '/code/app-api', '/code/app-web', '--']
 */
export function buildOpenArgs(
  addDirs: readonly string[],
  sessionId: string,
  systemPromptAppend: string | null,
): string[] {
  const args = ['--session-id', sessionId];
  if (systemPromptAppend !== null) {
    args.push('--append-system-prompt', systemPromptAppend);
  }
  if (addDirs.length > 0) {
    args.push('--add-dir', ...addDirs, '--');
  }
  return args;
}
