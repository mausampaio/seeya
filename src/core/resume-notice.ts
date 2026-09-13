/**
 * Renders the user-facing warning for a `SessionResumer.resume()` fallback (S3-T2, D-004: "avisar
 * o usuário que houve fallback"). Pure formatting, same reasoning as `core/briefing.ts`: no I/O,
 * testable with plain `ResumeOutcome` fixtures. `cli/` (S3-T3, not built yet) is what prints this
 * string — this module only decides what it says.
 *
 * **Why this exists before `seeya start-day` does.** The warning is not a detail to fill in once
 * the command is wired up: a user who asked to resume believes they got yesterday's history back.
 * If `seeya` silently opened a blank session instead, that user is about to talk to a model with
 * no memory of yesterday and no idea why — the exact failure mode D-004 calls out by name. Getting
 * the wording right, and testing it, doesn't need the command to exist yet; it only needs the
 * `ResumeOutcome` shape S3-T2 already produces.
 */
import type { ResumeFallbackReason, ResumeOutcome } from './types.js';

/** D-025: names only what's known. A bare exit code can't say WHICH of D-004's causes (expired
 * session, moved project) explains the failure — this says "could not be resumed", never invents
 * a specific cause the evidence doesn't support. */
function describeResumeFailed(exitCode: number): string {
  return `the original session could not be resumed (claude exited with code ${exitCode})`;
}

function describePromptTooLarge(promptLength: number, limitChars: number): string {
  return (
    `yesterday's plan is too long to pass safely to an interactive session ` +
    `(${promptLength} characters, limit ${limitChars})`
  );
}

/**
 * Shared "why" text for a `ResumeFallbackReason`, used both here (after the fact, in the final
 * summary) and by `cli/format-start-day.ts#renderFallbackQuestion` (S5-T9: BEFORE the fallback
 * runs, as part of the question asking whether to open it at all) — one place decides the wording,
 * so the two never drift into describing the same reason differently.
 */
export function describeFallbackReason(reason: ResumeFallbackReason): string {
  return reason.kind === 'resumeFailed'
    ? describeResumeFailed(reason.exitCode)
    : describePromptTooLarge(reason.promptLength, reason.limitChars);
}

/**
 * Builds the fallback warning for `outcome`, or `null` when `--resume` attached cleanly and there
 * is nothing to warn about.
 *
 * @example
 * const notice = formatResumeNotice(outcome);
 * if (notice !== null) process.stdout.write(`${notice}\n`);
 */
export function formatResumeNotice(outcome: ResumeOutcome): string | null {
  if (outcome.fellBack === false) {
    return null;
  }
  const why = describeFallbackReason(outcome.fellBack);
  return (
    `Could not resume session "${outcome.sessionId}" (${outcome.cwd}) — ${why}. ` +
    `Opened a new session there instead, with yesterday's plan as context. ` +
    `This is a fresh conversation: it does not have yesterday's full history.`
  );
}
