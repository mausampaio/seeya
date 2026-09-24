/**
 * The fixed initial message `seeya project adopt` sends the resumed fork (V2-T29 item 3). Short
 * and fixed-length by construction, like `adapters/generation/system-prompt.ts
 * #GENERATION_SYSTEM_PROMPT` — safe as a CLI positional argument under D-015's real ceiling
 * (docs/spikes/H-retomada-interativa.md's own correction: ~19 KB measured fine, Windows cuts a
 * command line near 32,767 characters). The `projectDir` interpolated below is bounded by the
 * workspace root plus a `projectId` (`core/project-id.ts#isValidProjectId`), nowhere near that
 * ceiling — `adopt-args.test.ts` asserts the built instruction stays a few KB at most.
 *
 * **The exact wording is load-bearing** — `docs/spikes/N-adocao-de-sessao.md`'s Pergunta 2 measured
 * two candidates on the identical synthetic context: naming the target files by path
 * ("AGENTS.md and INDEX.md... so a fresh session can pick up from here without you") wrote the two
 * files, in the project directory, with correct content and an honest caveat about what couldn't be
 * verified. The other candidate, built only around the word "memory" with no file named, wrote
 * nothing into the project at all — the model reached for Claude Code's own `--bare` auto-memory
 * mechanism instead, under `~/.claude/projects/.../memory/`, outside the project, invisible to git
 * and to `seeya`. This text follows the measured candidate's shape and extends it to the other
 * three things V2-T29's own spec requires a session be told explicitly: the how-to file's exact
 * name (`context/know-how.md`, fixed by the PO in the task's 2026-09-24 revision, before this file
 * existed), secrets by path never by value, and marking what isn't known instead of guessing it
 * (D-025, stated to the model the same way `GENERATION_SYSTEM_PROMPT`'s own last sentences already
 * do for a different call).
 *
 * **`projectDir` is now spelled out, absolute, for every file named — the maintainer's own
 * acceptance run is what found the gap this fixes (task-23, V2-T29, comment #2).** The original
 * text said "the project directory" and named files by relative path (`AGENTS.md`,
 * `context/know-how.md`) with no path attached at all. `docs/spikes/N-adocao-de-sessao.md`'s own
 * test session always ran FROM INSIDE the project directory, so "the project directory" and "my
 * own directory" were the same thing there — the ambiguity never had a chance to show up. The fork
 * is resumed in its OWN original directory on purpose (D-047, item 5 below) — never the project's
 * — so a session told to write into "the project directory" with nothing naming where that is
 * reads it as its own `cwd`, the exact failure the acceptance run reproduced. This function takes
 * the absolute `projectDir` and folds it into every sentence: the directory is named up front,
 * every file is the absolute path to it (`path.join(projectDir, 'AGENTS.md')`, not a bare
 * `AGENTS.md`), and the closing line repeats the same absolute path as the one place allowed to be
 * written.
 *
 * **Why the fork is resumed in its own directory, not the project's (maintainer's own decision,
 * 2026-09-24) — and item 5: the instruction now says so.** The Claude Code loads, by working
 * directory, that directory's own local `CLAUDE.md`, its auto-memory for that directory,
 * configuration and skills. Opening the fork in the ORIGINAL directory is what gives it all of
 * that; opened in the project instead, it would have only the transcript. The instruction below
 * asks the session to carry over into the project whatever, from what's locally available in its
 * own directory, belongs to THIS work — and leave out anything about other, unrelated work; without
 * this the session tends to summarize only the conversation and skip what its own directory already
 * knew. The day-to-day work in the project itself, afterward, goes through `project open` instead
 * (a separate moment, a separate answer — `application/project-open.ts`'s own docstring).
 * **Not claimed here: any statement about what `--resume` itself can or cannot find outside a
 * session's original directory — never measured (docs/QUESTOES.md Q-090's own scope).**
 *
 * @example
 * buildAdoptionInstruction('C:\\seeya\\workspace\\auth-hardening')
 * // 'The project directory is C:\\seeya\\workspace\\auth-hardening ... Write only inside
 * // C:\\seeya\\workspace\\auth-hardening.'
 */
import path from 'node:path';

export function buildAdoptionInstruction(projectDir: string): string {
  const agentsFile = path.join(projectDir, 'AGENTS.md');
  const indexFile = path.join(projectDir, 'INDEX.md');
  const statusDir = path.join(projectDir, 'status');
  const decisionsDir = path.join(projectDir, 'decisions');
  const knowHowFile = path.join(projectDir, 'context', 'know-how.md');
  return (
    `The project directory is ${projectDir} — it has been released to you for this session ` +
    '(via --add-dir). You were resumed in your own working directory on purpose, so you still ' +
    'have whatever instructions, memory, configuration and skills are local to it — carry over ' +
    'into the project whatever, from what is locally available to you here, belongs to this ' +
    'specific work, and leave out anything about other, unrelated work. Write down what you know ' +
    'about this work into the project directory, so a fresh session can pick up from here ' +
    `without you. Update ${agentsFile} and ${indexFile} with what you now know this project is ` +
    `about; write the current state into ${statusDir}, and any decision that matters going ` +
    `forward into ${decisionsDir}. Write how you actually operate here — which tools and skills ` +
    'you use, how you reach them, any per-environment configuration, and conventions you follow ' +
    `— into ${knowHowFile} specifically; that is the first thing lost when a session gets ` +
    'summarized. For any credential, token or secret, write down where it lives and how to reach ' +
    'it (a skill, a config file, a path) — never its value. Mark anything you are not sure about ' +
    `as uncertain rather than stating it as fact. Write only inside ${projectDir}.`
  );
}
