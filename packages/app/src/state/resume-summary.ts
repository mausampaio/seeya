/**
 * V2-T4 item 4 — projects `application/start-day.ts#ResumeSessionsResult` into the IPC-safe,
 * per-session shape `ipc/channels.ts#ResumeSummaryResponse` declares, for the "Today" panel to
 * render as DOM sections (resumed/skipped/invalid/remaining) instead of reusing
 * `cli/format-start-day.ts`'s literal text — the same criterion V2-T2 used for the status panel:
 * only the DATA crosses the boundary; the CLI's own plain-text rendering stays in `cli/` (Q-073).
 *
 * `describeFallbackReason` (`@seeya-ai/engine/core/resume-notice.js`) is reused directly for every
 * reason string below — the exact same wording `cli/format-start-day.ts#formatSkippedSection` and
 * `formatResumeNotice` already show, never a second phrasing of the same fact.
 *
 * `resolveLabel` is the SAME function `electron/main.ts` already builds for
 * `TabSessionResumer.resolveLabel` (a `sessionId → handoff.name` lookup over the handoffs a
 * "Resume selected" click was given) — `ResumeOutcome` (the `resumed` array's own element type) is
 * the one shape in `ResumeSessionsResult` that carries no `name` at all, only `sessionId`/`cwd`, so
 * this module needs the same lookup to label it for display.
 */
import { describeFallbackReason } from '@seeya-ai/engine/core/resume-notice.js';
import type { ResumeSessionsResult } from '@seeya-ai/engine/application/start-day.js';
import type {
  ResumeSummaryInvalid,
  ResumeSummaryOutcome,
  ResumeSummaryResponse,
  ResumeSummarySkipped,
} from '../ipc/channels.js';

/**
 * @example
 * const summary = buildResumeSummary(result, resolveLabel);
 * // summary.resumed[0]?.fellBack === false -> attached cleanly
 * // summary.skipped[0]?.reasonText -> the exact CLI-shared "why" text
 */
export function buildResumeSummary(
  result: ResumeSessionsResult,
  resolveLabel: (sessionId: string) => string,
): ResumeSummaryResponse {
  const resumed: readonly ResumeSummaryOutcome[] = result.resumed.map((outcome) => ({
    sessionId: outcome.sessionId,
    name: resolveLabel(outcome.sessionId),
    cwd: outcome.cwd,
    fellBack:
      outcome.fellBack === false ? false : { reasonText: describeFallbackReason(outcome.fellBack) },
  }));

  const skipped: readonly ResumeSummarySkipped[] = result.skipped.map(({ handoff, reason }) => ({
    sessionId: handoff.sessionId,
    name: handoff.name,
    cwd: handoff.cwd,
    reasonText: describeFallbackReason(reason),
  }));

  const invalidFallbackAnswers: readonly ResumeSummaryInvalid[] = result.invalidFallbackAnswers.map(
    ({ handoff, reason }) => ({
      sessionId: handoff.sessionId,
      name: handoff.name,
      cwd: handoff.cwd,
      reason,
    }),
  );

  const remaining = result.remaining.map((handoff) => ({
    sessionId: handoff.sessionId,
    name: handoff.name,
    cwd: handoff.cwd,
  }));

  const stoppedEarly =
    result.stoppedEarly === false
      ? (false as const)
      : {
          session: {
            sessionId: result.stoppedEarly.handoff.sessionId,
            name: result.stoppedEarly.handoff.name,
            cwd: result.stoppedEarly.handoff.cwd,
          },
          message: result.stoppedEarly.error.message,
        };

  return { resumed, skipped, invalidFallbackAnswers, remaining, stoppedEarly };
}
