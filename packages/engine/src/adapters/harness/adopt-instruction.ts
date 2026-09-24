/**
 * The fixed initial message `seeya project adopt` sends the resumed fork (V2-T29 item 3). Short
 * and fixed-length by construction, like `adapters/generation/system-prompt.ts
 * #GENERATION_SYSTEM_PROMPT` — safe as a CLI positional argument under D-015's real ceiling
 * (docs/spikes/H-retomada-interativa.md's own correction: ~19 KB measured fine, Windows cuts a
 * command line near 32,767 characters).
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
 */
export const ADOPTION_INSTRUCTION =
  'Write down what you know about this work into the project directory, so a fresh session can ' +
  'pick up from here without you. Update AGENTS.md and INDEX.md with what you now know this ' +
  'project is about; write the current state into status/, and any decision that matters going ' +
  'forward into decisions/. Write how you actually operate here — which tools and skills you ' +
  'use, how you reach them, any per-environment configuration, and conventions you follow — into ' +
  'context/know-how.md specifically; that is the first thing lost when a session gets summarized. ' +
  'For any credential, token or secret, write down where it lives and how to reach it (a skill, a ' +
  'config file, a path) — never its value. Mark anything you are not sure about as uncertain ' +
  'rather than stating it as fact. Write only inside this project directory.';
