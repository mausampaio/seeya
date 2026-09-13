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
 */

export type FallbackDecision =
  | { readonly kind: 'open' }
  | { readonly kind: 'skip' }
  | { readonly kind: 'invalid'; readonly reason: string };

const OPEN_ANSWERS = new Set(['y', 'yes']);
const SKIP_ANSWERS = new Set(['', 'n', 'no']);

/**
 * @example
 * parseFallbackAnswer('') // { kind: 'skip' } — Enter alone never opens a history-losing session
 * parseFallbackAnswer('y') // { kind: 'open' }
 * parseFallbackAnswer('maybe') // { kind: 'invalid', reason: '...' }
 */
export function parseFallbackAnswer(answer: string): FallbackDecision {
  const normalized = answer.trim().toLowerCase();
  if (OPEN_ANSWERS.has(normalized)) {
    return { kind: 'open' };
  }
  if (SKIP_ANSWERS.has(normalized)) {
    return { kind: 'skip' };
  }
  return {
    kind: 'invalid',
    reason: `"${answer.trim()}" is not a valid answer (expected "y"/"yes" to open, or "n"/"no"/blank to skip)`,
  };
}
