/**
 * Argument arrays for `adapters/resumption` (S3-T2). Every value here is a fixed flag, a short
 * known value (a session UUID, a file path this module itself created), or — only below the
 * measured threshold — the prompt text itself as a positional argument.
 *
 * **The positional prompt is D-015 as corrected, not an exception to it.** Spike H measured that
 * `spawn(bin, [...args, text], { shell: false })` round-trips a multiline/quoted/accented string
 * byte-for-byte: what mangled Spike C's text was the shell re-interpreting it, never the argument
 * slot itself. D-015 now reads "no shell reachable, and small enough" — this file is where "small
 * enough" is decided and enforced, once, so nothing downstream has to re-derive it.
 */

/**
 * Ceiling for the prompt as a positional argument, in UTF-16 code units — the same unit
 * `String.prototype.length` counts in, and the same unit Windows' `CreateProcess` counts its
 * command-line ceiling in (Spike H).
 *
 * **Raised from 4096 to 16384 in S5-T9 (docs/QUESTOES.md Q-069), against two fresh measurements —
 * Spike H's own "not measured" gap, closed here — not a bigger guess:**
 *
 * 1. **The real OS ceiling, on this machine (Windows 11): ~32,612–32,656 UTF-16 units**, found by
 *    binary search spawning `node` itself (not `claude`) with one large argument via
 *    `spawn(bin, [...args], { shell: false })` — the identical argv-passing mechanism this file's
 *    own comment already describes as binary-agnostic. Below the boundary the child starts and
 *    echoes the argument back at full length; above it, `spawn` itself fails with `ENAMETOOLONG`
 *    before any process starts (Node/the OS reject it, `claude` never sees it). This confirms
 *    Spike H's ~32,767-unit estimate instead of just re-citing it.
 * 2. **Content fidelity at the new ceiling, through the exact production shape
 *    (`buildResumeArgs` below, i.e. `claude --resume <id> "<prompt>"`, no `-p`):** a real
 *    16,384-character prompt — hostile content Spike H already exercised (newline, both quote
 *    types, `%`, accented characters, a backtick, a trailing backslash) plus start/end position
 *    markers — round-tripped intact: the reply correctly extracted the start marker, confirmed
 *    every special character present, and reproduced the tail including the end marker. No
 *    truncation or mangling at this size.
 *
 * 16,384 is roughly half the measured hard ceiling — deliberate headroom for `--resume
 * <36-char-uuid>`, the binary's own resolved path, any character needing a surrogate pair, and
 * whatever the OS's own argv quoting adds — and about 4x the real 2026-09-13 case (4,135
 * characters) that this task exists to fix. **What did NOT change:** the branch to the fallback
 * still exists. Q-069 also measured, on the currently installed `claude` (2.1.270), that
 * `--append-system-prompt-file` (D-004's fallback mechanism) does NOT deliver its file's content
 * to an already-`--resume`d session in headless (`-p`) mode — 0/4 trials across two independent
 * marker files and two base sessions, confirmed by a fourth trial asking the model to list
 * everything visible in its system prompt (every OTHER dynamically-injected item appeared; the
 * appended marker never did) — so the positional argument, not the file, remains the only channel
 * proven to carry a plan into a session that is genuinely continuing. That measurement covers `-p`
 * only, never a real interactive TTY (this task's own environment has none to test with) — see
 * Q-069 for what remains unmeasured.
 */
export const RESUME_PROMPT_ARG_LIMIT_CHARS = 16_384;

/** `claude --resume <sessionId> "<prompt>"` — no `-p`: plain interactive mode is what makes the
 * spawned process attach to the inherited terminal instead of degrading into a single
 * non-interactive reply (Spike H). */
export function buildResumeArgs(sessionId: string, prompt: string): string[] {
  return ['--resume', sessionId, prompt];
}

/** `claude --resume <sessionId>` — no prompt argument at all (V2-T7 item 2). The session attaches
 * with its own transcript intact (the real memory, spikes K/L); the plan that didn't fit stays
 * readable in today's briefing instead. Never combined with a prompt — that's `buildResumeArgs`
 * above, for the ordinary case where the plan fits under `RESUME_PROMPT_ARG_LIMIT_CHARS`. */
export function buildResumeWithoutPromptArgs(sessionId: string): string[] {
  return ['--resume', sessionId];
}

/** Fixed, short, English (AGENTS.md § "Idioma": CLI-facing text) — safe as an argument regardless
 * of prompt size, because it never varies. Gives the fallback session an actual first turn instead
 * of opening on a blank prompt the user has to know to fill in themselves. */
export const FALLBACK_KICKOFF_PROMPT =
  "Continue from yesterday's plan (see the note added to this session's context).";

/** The fallback never resumes (D-004's "sessão nova"): the plan travels via
 * `--append-system-prompt-file`, a file path — a short, known-length argument regardless of how
 * long the file's own content is (D-015) — pointing at the file `resumer.ts` wrote through
 * `context-file.ts`. */
export function buildFallbackArgs(contextFilePath: string): string[] {
  return ['--append-system-prompt-file', contextFilePath, FALLBACK_KICKOFF_PROMPT];
}

/**
 * Human-readable form of `buildResumeArgs`'s argv, for `resumer.ts`'s error message when both
 * attempts fail (S3-T7, Q-029). **Shows the flag and the prompt's length, never the prompt
 * itself** — `prompt` can be up to `RESUME_PROMPT_ARG_LIMIT_CHARS` (4096) characters, and dumping
 * yesterday's plan into an exception would trade the original problem (a message pointing at the
 * wrong cause) for a new one (a wall of text hiding it). What identifies "the flag `claude`
 * stopped accepting" is which flags were passed, not what their values were.
 */
export function describeResumeAttempt(
  claudeBinary: string,
  sessionId: string,
  prompt: string,
): string {
  return `${claudeBinary} --resume ${sessionId} <prompt: ${prompt.length} chars>`;
}

/**
 * Human-readable form of `buildFallbackArgs`'s argv, for the same error message. `contextFilePath`
 * and `FALLBACK_KICKOFF_PROMPT` are both short and fixed (never user plan text), so — unlike
 * `describeResumeAttempt` — there is nothing here that needs redacting.
 */
export function describeFallbackAttempt(claudeBinary: string, contextFilePath: string): string {
  return `${claudeBinary} --append-system-prompt-file ${contextFilePath} "${FALLBACK_KICKOFF_PROMPT}"`;
}
