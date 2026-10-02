/**
 * Human-readable text for the reasons a session was NOT captured (V2-T69, `docs/INTERFACE.md` § 6:
 * the "Not captured" list shows "o motivo" — never the raw `IneligibilityReason` token, which reads
 * as an internal identifier, not a sentence). Pure: no I/O.
 *
 * The CLI's own `format-end-day.ts#formatIneligibleSection` joins the raw tokens with `, ` instead
 * — that has always been good enough for a terminal reading someone who already knows this
 * project's vocabulary, but `docs/INTERFACE.md` principle 5 ("nada de texto da CLI despejado na
 * tela") asks the window for real sentences instead of reusing that line.
 */
import type { IneligibilityReason } from '@seeya-ai/engine/core/eligibility.js';

const INELIGIBILITY_REASON_TEXT: Record<IneligibilityReason, string> = {
  noEvidence: 'No evidence source answered for this session.',
  noRecentActivity: 'No activity within the relevance window.',
  ownSeeyaFork: 'This is a copy seeya made for its own capture.',
  ignoredCwd: 'This directory is in the ignore list.',
  duplicateToday: 'Already captured today with unchanged evidence.',
};

/**
 * @example
 * formatIneligibilityReasons(['noRecentActivity']) // 'No activity within the relevance window.'
 * formatIneligibilityReasons(['ignoredCwd', 'duplicateToday'])
 * // 'This directory is in the ignore list. Already captured today with unchanged evidence.'
 */
export function formatIneligibilityReasons(reasons: readonly IneligibilityReason[]): string {
  return reasons.map((reason) => INELIGIBILITY_REASON_TEXT[reason]).join(' ');
}

/** D-031's listing: a session excluded from capture scope before eligibility ever ran — no live
 * registry entry was found for it at all, read as closed gracefully (never "work in progress",
 * `core/types.ts#EndDayResult.listedSessions`'s own docstring). Named plainly here so the same
 * fact the CLI's own "Not captured (closed sessions, D-031)" heading states reads as a sentence in
 * the window instead of a section title.
 *
 * PO review round 1 (V2-T69): no decision id in user-facing text — `D-031` named the mechanism to
 * a reader of THIS comment, never to the person reading the dialog, who has no `docs/DECISOES.md`
 * to look it up in. */
export const CLOSED_SESSION_REASON = 'Session closed — no running process was found.';
