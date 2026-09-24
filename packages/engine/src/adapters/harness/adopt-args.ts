/**
 * Argument array for `seeya project adopt` (V2-T29) — resumes `originalSessionId` into a fork
 * (`--fork-session`), pins the fork's own id (`--session-id`, chosen by the caller BEFORE spawning
 * so it can be registered in `forks.json`, D-012 — `core/ports.ts#ForkRegistration`'s own
 * docstring), releases the project directory (`--add-dir`), and opens with the fixed
 * `ADOPTION_INSTRUCTION` as the first message.
 *
 * **`--` right after `--add-dir`'s directories, same gotcha `adapters/harness/args.ts#buildOpenArgs`
 * already guards against** (`docs/spikes/N-adocao-de-sessao.md`'s Achado 1): `--add-dir` is
 * variadic and swallows the next positional argument — here that would be the instruction itself —
 * unless something terminates the list first. Confirmed for THIS exact three-flag combination
 * (`--resume` + `--fork-session` + `--session-id`, together with `--add-dir`) with a disposable
 * session while implementing this task (docs/QUESTOES.md Q-090): the fork came out named exactly
 * the requested id, and the original session's transcript was untouched afterward.
 */
import { ADOPTION_INSTRUCTION } from './adopt-instruction.js';

/**
 * @example
 * buildAdoptArgs(
 *   '11111111-1111-4111-8111-111111111111',
 *   '22222222-2222-4222-8222-222222222222',
 *   ['/seeya/workspace/auth-hardening'],
 * )
 * // [
 * //   '--resume', '11111111-...', '--fork-session', '--session-id', '22222222-...',
 * //   '--add-dir', '/seeya/workspace/auth-hardening', '--', ADOPTION_INSTRUCTION,
 * // ]
 */
export function buildAdoptArgs(
  originalSessionId: string,
  forkSessionId: string,
  addDirs: readonly string[],
): string[] {
  const args = ['--resume', originalSessionId, '--fork-session', '--session-id', forkSessionId];
  if (addDirs.length > 0) {
    args.push('--add-dir', ...addDirs);
  }
  args.push('--', ADOPTION_INSTRUCTION);
  return args;
}
