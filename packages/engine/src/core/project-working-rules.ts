/**
 * The working rules a session gets told about the project it just opened (D-047 item 5, V2-T34 item
 * 5). One text, in `core/` so both composition roots reach it without either importing the other
 * (D-043: `cli/` and `app/` never import each other) — `application/project-open.ts` folds this
 * into the SAME `--append-system-prompt` the lock warning already travels on (V2-T35 item 2), never
 * a second flag.
 *
 * **Why this exists even though `AGENTS.md`'s own skeleton (`core/project-skeleton.ts`) already
 * gets a "Working in this project" section with the same summary (item 6).** The maintainer's own
 * test that produced this task found a session that rewrote the project's `AGENTS.md` entirely
 * during an adoption — a file the session itself is free to edit is not somewhere a rule that must
 * "valer sempre" (D-047 item 5) can live alone. Delivered through `--append-system-prompt` instead,
 * this text reaches the session's context on every `open`, independent of whatever the file on disk
 * currently says.
 *
 * **Known limit, not silently absent (item 5's own "Limite conhecido").** `docs/QUESTOES.md`
 * Q-069 measured that `--append-system-prompt` does NOT reach a RESUMED session (`--resume`) — only
 * a fresh one. `seeya project open` always launches fresh (`core/ports.ts#HarnessLauncher.open`'s
 * own docstring: never `--resume`), so this reaches every `open`. The adoption flow
 * (`seeya project adopt`) resumes a FORK instead — it never gets this text; its own instruction
 * (`adapters/harness/adopt-instruction.ts#buildAdoptionInstruction`) already covers what it needs.
 */
import { PROJECT_ID_TRAILER_KEY, SESSION_ID_TRAILER_KEY } from './project-commit.js';

/**
 * @example
 * buildProjectWorkingRulesText('auth-hardening').length < 2000 // true
 */
export function buildProjectWorkingRulesText(projectId: string): string {
  return (
    `You are working inside seeya project "${projectId}". This directory is a git repository ` +
    'that a "seeya project" workflow tracks, not a throwaway workspace.\n\n' +
    'Working rules for this project:\n' +
    '- Commit as you go, without asking — small commits, each with a message that explains why, ' +
    'not just what.\n' +
    `- Every commit here gets two trailers added automatically (${PROJECT_ID_TRAILER_KEY}, ` +
    `${SESSION_ID_TRAILER_KEY}) by a git hook. Do not write them yourself.\n` +
    '- One project per commit — never stage files from another seeya project in the same commit.\n' +
    '- Never commit the ".seeya-lock" file in this directory — it is operational state, not ' +
    'content, and a hook refuses it anyway.\n' +
    '- Edit the canonical files (AGENTS.md, INDEX.md, decisions/, status/) at the moment you ' +
    'decide something, not later from notes. Use journal/ for drafts that have not become a ' +
    'decision yet.\n' +
    '- For any credential, token or secret, write down where it lives (a path), never its value.\n\n' +
    'These rules are enforced where it matters (the commit trailers, one-project-per-commit, and ' +
    'the lock file are all checked by a git hook, not just asked for here) — but a git hook only ' +
    'runs for a normal "git commit"; it does not stop someone from bypassing it on purpose ' +
    '(e.g. "git commit --no-verify"), and it cannot verify who a session really is beyond what its ' +
    'own environment claims.'
  );
}
