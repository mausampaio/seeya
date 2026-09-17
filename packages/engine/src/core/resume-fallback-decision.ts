/**
 * Pure decision for `seeya start-day`'s "should this fallback session actually open?" question
 * (S5-T9, docs/PLANO-DE-ENTREGA.md § S5-T9 "Parte 2"). Before this task, `ClaudeSessionResumer`
 * decided AND executed the fallback in the same call — the person only learned a fresh session had
 * replaced their history from the summary `start-day` prints at the very end, by which point they
 * were already inside the new, history-less session (the 2026-09-13 case this task exists to
 * close). Now the reason is shown BEFORE any fallback process spawns, and this module is the one
 * place that turns whatever the person typed into a decision — no I/O, no `readline`, testable
 * with plain strings, same reasoning as `cli/start-day-selection.ts#parseInteractiveSelection`
 * (which this mirrors in shape, not by reuse: that one parses a session-number list, this one
 * parses yes/no).
 *
 * **Default is "skip", on purpose, per the maintainer's own words in the task:** the fallback is
 * the path that loses history, so it can never be the answer a distracted Enter produces. Only an
 * explicit "y"/"yes" opens it.
 *
 * **V2-T7 adds a third answer, "resume without the plan" — ONLY for the `promptTooLarge` reason.**
 * The 2026-09-13 finding (docs/PLANO-DE-ENTREGA.md V2-T7's own "achado"): a plan too long to pass
 * as an argument doesn't mean the ORIGINAL session can't be resumed at all — `--resume` without
 * the plan attached still brings back the real transcript, which is the memory that actually
 * matters (spikes K/L). For `resumeFailed`, though, `--resume` itself already failed — asking it
 * to try again without the plan would fail the exact same way, so that reason keeps exactly the
 * two answers S5-T9 gave it. **`parseFallbackAnswer` is parametrized by `reasonKind` (D-024)
 * instead of a loose `if` inside the caller**: the type of valid answer depends on WHICH reason is
 * being asked about, so the function that turns text into a decision is the one place that has to
 * know it. A `resumeWithoutPlan`-shaped answer ("r"/"resume") arriving for a `resumeFailed`
 * question is `invalid`, with a message saying exactly why — never silently reinterpreted as
 * something else.
 *
 * **The default itself also changes, but only for `promptTooLarge`:** blank (Enter alone) now
 * means "resume without the plan" there — unlike opening a fresh session, this costs nothing extra
 * and loses nothing (the plan stays readable in today's briefing either way), so it's safe for a
 * distracted Enter to choose. `resumeFailed` keeps S5-T9's original default, "skip" — that reason
 * has no cost-free option to fall back to.
 */
import type { ResumeFallbackReason } from './types.js';

export type FallbackDecision =
  | { readonly kind: 'open' }
  | { readonly kind: 'resumeWithoutPlan' }
  | { readonly kind: 'skip' }
  | { readonly kind: 'invalid'; readonly reason: string };

const OPEN_ANSWERS = new Set(['y', 'yes']);
const RESUME_WITHOUT_PLAN_ANSWERS = new Set(['r', 'resume']);
const SKIP_ANSWERS = new Set(['n', 'no']);

/** `reasonKind === 'promptTooLarge'`'s own branch — the only one with three live answers and a
 * default other than "skip". */
function parseForPromptTooLarge(normalized: string, original: string): FallbackDecision {
  if (normalized === '' || RESUME_WITHOUT_PLAN_ANSWERS.has(normalized)) {
    return { kind: 'resumeWithoutPlan' };
  }
  if (SKIP_ANSWERS.has(normalized)) {
    return { kind: 'skip' };
  }
  return {
    kind: 'invalid',
    reason:
      `"${original.trim()}" is not a valid answer (expected "y"/"yes" to open a fresh session, ` +
      '"r"/"resume" or blank to resume without the plan, or "n"/"no" to skip)',
  };
}

/** Every other `reasonKind` — `resumeFailed`, and `resumeWithoutPlanFailed` defensively (that one
 * never actually reaches this function in production: `application/start-day.ts` reports it as a
 * skip directly, no second question — see `core/types.ts#PrimaryResumeAttempt`'s own docstring).
 * Same two answers S5-T9 always had; "r"/"resume" is `invalid` here, never silently accepted. */
function parseForNoFreeOption(
  normalized: string,
  original: string,
  reasonKind: ResumeFallbackReason['kind'],
): FallbackDecision {
  if (normalized === '' || SKIP_ANSWERS.has(normalized)) {
    return { kind: 'skip' };
  }
  if (RESUME_WITHOUT_PLAN_ANSWERS.has(normalized)) {
    return {
      kind: 'invalid',
      reason:
        '"resume without the plan" only applies when the plan itself was too large to pass — ' +
        `this session's fallback reason was "${reasonKind}"`,
    };
  }
  return {
    kind: 'invalid',
    reason: `"${original.trim()}" is not a valid answer (expected "y"/"yes" to open, or "n"/"no"/blank to skip)`,
  };
}

/**
 * @example
 * parseFallbackAnswer('', 'promptTooLarge') // { kind: 'resumeWithoutPlan' } — the new default
 * parseFallbackAnswer('r', 'promptTooLarge') // { kind: 'resumeWithoutPlan' }
 * parseFallbackAnswer('', 'resumeFailed') // { kind: 'skip' } — S5-T9's original default, unchanged
 * parseFallbackAnswer('r', 'resumeFailed') // { kind: 'invalid', reason: '...' } — no free option here
 * parseFallbackAnswer('y', 'resumeFailed') // { kind: 'open' }
 */
export function parseFallbackAnswer(
  answer: string,
  reasonKind: ResumeFallbackReason['kind'],
): FallbackDecision {
  const normalized = answer.trim().toLowerCase();
  if (OPEN_ANSWERS.has(normalized)) {
    return { kind: 'open' };
  }
  return reasonKind === 'promptTooLarge'
    ? parseForPromptTooLarge(normalized, answer)
    : parseForNoFreeOption(normalized, answer, reasonKind);
}
