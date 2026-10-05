import { formatPlanAge } from './format-plan-age.js';

/**
 * The strings of the Today tab, the lateral Today card and the fallback confirmation (V2-T51: split out of `text/messages.ts`, which spreads it into
 * `MESSAGES` — the same pattern `project-details-messages.ts` already uses). No imports on
 * purpose, same as `messages.ts`.
 */
export const TODAY_MESSAGES = {
  // V2-T4 item 1 — the "Today" panel (state/today-panel.ts). Mirrors the CLI's own vocabulary
  // (cli/format-start-day.ts#formatNoPendingBriefing, D-024/D-025: "no pending briefing" and
  // "everything already resumed" are different facts) rather than inventing a second wording for
  // the same fact.
  todayHeading: 'Today',
  todayNoBriefing: (daysSearched: number): string =>
    `No pending briefing found in the last ${daysSearched} ${daysSearched === 1 ? 'day' : 'days'} ` +
    'scanned. Nothing to resume — either nothing has been captured yet, or everything already ' +
    'resumed.',
  todayPlanTitle: (day: string, daysAgo: number): string =>
    `Plan for ${day} (${formatPlanAge(daysAgo)})`,
  // V2-T66, `docs/INTERFACE.md` § 3's own "uma linha de contexto: quando foi capturado e quantas
  // sessões" — `capturedAt` is `state/today-panel.ts#TodayPanelData`'s own latest-across-the-day
  // instant (`null` only for the empty-batch edge no real lookup produces, D-025).
  todayContextLine: (capturedAt: Date | null, sessionCount: number): string => {
    const sessions = `${sessionCount} ${sessionCount === 1 ? 'session' : 'sessions'}`;
    return capturedAt === null ? sessions : `Captured ${capturedAt.toLocaleString()} · ${sessions}`;
  },
  // V2-T63 — the lateral's own Today card (state/today-panel.ts#buildTodayCardSummary).
  // Correction (real-window screenshot review): two lines now — "Today" + the pill is the first
  // (`todayCardHeading`), "Plan for <day>"/"Nothing to resume" is the second. `dayLabel` already
  // reads "today"/"yesterday"/a weekday-and-date string (`state/today-panel.ts
  // #formatTodayCardDayLabel`) — this function only ever wraps it, never re-derives it.
  todayCardHeading: 'Today',
  todayCardPlanFor: (dayLabel: string): string => `Plan for ${dayLabel}`,
  todayCardNothingToResume: 'Nothing to resume',
  todayCardResumeCount: (count: number): string => `${count} to resume`,
  // V2-T66, `docs/INTERFACE.md` § 3's own exact chip wording for the two non-`neverResumed`
  // states — replaces the old `todayRunningNow`/`todayResumedEarlier` inline-text fragments the
  // DOM-at-hand panel used (`renderer/legacy/today-panel-view.ts`, apagado by this task).
  todayResumedEarlierChip: 'Resumed earlier · closed',
  todayRunningNowChip: 'Running now · open in a tab',
  todayNoPlanRecorded: 'no plan recorded',

  // V2-T9 item 2 — the directory-changed note and the "Resume in" selector
  // (`state/today-panel.ts#TodaySessionRow.cwdHistory`). Structural parameter (not
  // `CwdHistoryEntry` imported from the engine) — this module's own top comment: no imports here
  // on purpose, so `text/` never depends on `application/`.
  todayCwdHistoryNote: (
    history: readonly {
      readonly cwd: string;
      readonly firstDay: string;
      readonly lastDay: string;
      readonly exists: boolean;
    }[],
  ): string =>
    history
      .map((entry, index) => {
        const location = entry.exists ? entry.cwd : `${entry.cwd} (no longer exists)`;
        if (index === history.length - 1) {
          return `in ${location} since ${entry.firstDay}`;
        }
        return `${index === 0 ? 'ran in' : 'in'} ${location} until ${entry.lastDay}`;
      })
      .join('; '),
  todayCwdHistoryExplanation:
    'Claude Code keeps memory and project settings per directory — resuming in a different one ' +
    'starts without what was saved for the directory above.',
  todayResumeInLabel: 'Resume in',
  todayResumeSelected: 'Resume selected',
  todayResumeProgress: (index: number, total: number, name: string): string =>
    `Resuming ${index} of ${total}: ${name}...`,
  // V2-T21 item 2 — shown as `Button.disabledReason` instead of a silently-empty "Resume selected"
  // click when every row in today's plan is already `runningNow`
  // (`state/today-panel.ts#hasResumableSession`). The measured defect: with nothing to check, the
  // button sat there doing nothing, and the mantenedor read that as the app having broken rather
  // than nothing being left to resume.
  todayAllSessionsRunning: "All of today's planned sessions are already open — nothing to resume.",
  // V2-T66, `docs/INTERFACE.md` § 3's own selection footer ("N selected", "Clear selection",
  // "Resume selected (desabilitado sem seleção, com o motivo)").
  todaySelectionCount: (count: number): string => `${count} selected`,
  todayClearSelection: 'Clear selection',
  todaySelectNoneReason: 'Select at least one session to resume.',

  // V2-T4 item 3 — the fallback confirmation dialog (S5-T9's "warn BEFORE, and ask", as a dialog
  // instead of the CLI's readline question). `reasonText` itself comes from
  // `resume/fallback-confirmer.ts` (core/resume-notice.ts#describeFallbackReason, the exact same
  // wording the CLI shows) — never duplicated here.
  fallbackDialogTitle: (sessionName: string): string => `Could not resume "${sessionName}" as-is`,
  // V2-T7 item 4: the body text now depends on whether "Resume without the plan" is offered at all
  // (only for a promptTooLarge reason — `offersResumeWithoutPlan`,
  // `resume/fallback-confirmer.ts`'s own computation). The `resumeFailed` body is the original
  // S5-T9 text, unchanged.
  fallbackDialogBody: (offersResumeWithoutPlan: boolean): string =>
    offersResumeWithoutPlan
      ? "Resuming without the plan keeps this session's real history — the plan stays readable " +
        "in today's briefing either way. Opening a fresh session instead would start a FRESH " +
        'conversation with none of that history.'
      : 'Opening a new session there would start a FRESH conversation: it would not have this ' +
        "session's full history.",
  // V2-T7 item 4: "Resume without the plan" comes first and takes focus when offered (the new
  // default, mirroring the CLI's blank-answer default for the same reason) — `fallbackDialogOpen`
  // moves to second place in that case, and `fallbackDialogSkip` stays last either way.
  fallbackDialogResumeWithoutPlan: 'Resume without the plan',
  fallbackDialogOpen: 'Open a fresh session',
  fallbackDialogSkip: 'Skip',
  // V2-T71 (`docs/INTERFACE.md` § 9's own "as saídas como cartões explicados"): one short
  // sentence per card, in the fixed `docs/INTERFACE.md` § 9 order — "Skip this one, Open a fresh
  // session, Resume without the plan" — never reordered to put the recommended one first; the
  // `recommended` chip is what marks it instead.
  fallbackCardSkipTitle: 'Skip this one',
  fallbackCardSkipExplanation:
    'Leave this session as it is and move on to the next one — nothing resumes right now.',
  fallbackCardOpenTitle: 'Open a fresh session',
  fallbackCardResumeWithoutPlanTitle: 'Resume without the plan',
  fallbackCardRecommended: 'Recommended',

  // V2-T4 item 4 — the resume summary, rendered in the "Today" panel once resumeSessions
  // finishes. Same content as `cli/format-start-day.ts#formatStartDaySummary`'s four sections
  // (Q-073: only the data — `state/resume-summary.ts` — is shared, not this literal text).
  todaySummaryResumedHeading: 'Resumed',
  todaySummarySkippedHeading: 'Skipped at your request',
  todaySummaryInvalidHeading: 'Not resumed — invalid fallback answer',
  todaySummaryRemainingHeading: 'Not resumed',
  todaySummaryStoppedEarly: (name: string, message: string): string =>
    `Stopped after "${name}" failed: ${message}`,
  todaySummaryFallbackNote: (reasonText: string): string =>
    `Opened a new session there instead — ${reasonText}.`,
  // V2-T7: the third `ResumeOutcome` form — resumed WITH the original transcript, but the plan
  // itself didn't travel as an argument (`noteText` is `state/resume-summary.ts`'s own "N
  // characters, over the M-character limit" fragment).
  todaySummaryResumedWithoutPlanNote: (noteText: string): string =>
    `Resumed without yesterday's plan — ${noteText}.`,
} as const;
