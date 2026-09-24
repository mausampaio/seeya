/**
 * Argument array for `seeya project adopt` (V2-T29) — resumes `originalSessionId` into a fork
 * (`--fork-session`), pins the fork's own id (`--session-id`, chosen by the caller BEFORE spawning
 * so it can be registered in `forks.json`, D-012 — `core/ports.ts#ForkRegistration`'s own
 * docstring), releases the project directory (`--add-dir`), and opens with
 * `buildAdoptionInstruction(projectDir)` as the first message.
 *
 * **`projectDir`, a single string, not an `addDirs` list.** This flow only ever releases exactly
 * one directory — the project's own — and the instruction now has to name that exact path
 * (`adopt-instruction.ts`'s own docstring on why). A list that always holds one element is a
 * weaker type than the element itself (AGENTS.md § "Tipos": make the invalid state
 * unrepresentable); this also rules out, at the type level, the instruction and `--add-dir` ever
 * naming two different directories.
 *
 * **`--` right after `--add-dir`, same gotcha `adapters/harness/args.ts#buildOpenArgs`
 * already guards against** (`docs/spikes/N-adocao-de-sessao.md`'s Achado 1): `--add-dir` is
 * variadic and swallows the next positional argument — here that would be the instruction itself —
 * unless something terminates the list first. Confirmed for THIS exact three-flag combination
 * (`--resume` + `--fork-session` + `--session-id`, together with `--add-dir`) with a disposable
 * session while implementing this task (docs/QUESTOES.md Q-090): the fork came out named exactly
 * the requested id, and the original session's transcript was untouched afterward.
 */
import { buildAdoptionInstruction } from './adopt-instruction.js';

/**
 * @example
 * buildAdoptArgs(
 *   '11111111-1111-4111-8111-111111111111',
 *   '22222222-2222-4222-8222-222222222222',
 *   '/seeya/workspace/auth-hardening',
 * )
 * // [
 * //   '--resume', '11111111-...', '--fork-session', '--session-id', '22222222-...',
 * //   '--add-dir', '/seeya/workspace/auth-hardening', '--', buildAdoptionInstruction('/seeya/...'),
 * // ]
 */
export function buildAdoptArgs(
  originalSessionId: string,
  forkSessionId: string,
  projectDir: string,
): string[] {
  return [
    '--resume',
    originalSessionId,
    '--fork-session',
    '--session-id',
    forkSessionId,
    '--add-dir',
    projectDir,
    '--',
    buildAdoptionInstruction(projectDir),
  ];
}
