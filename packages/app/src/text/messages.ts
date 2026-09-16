/**
 * Every string the interface shows a person, concentrated here (D-028: English; AGENTS.md §
 * "Texto voltado ao usuário" — the same discipline `packages/cli/src` already follows for CLI
 * output, applied to the renderer instead of a terminal). No imports on purpose (unlike `state/`,
 * which imports THIS module) — `endDayCostCeiling` below takes a structural shape matching
 * `state/end-day-preview.ts#EndDayCostCeiling` rather than importing that type, so `text/` never
 * depends on `state/`.
 */
export const MESSAGES = {
  windowTitle: 'seeya',
  newTabButton: '+',
  commandBarCommandLabel: 'Command',
  commandBarCommandPlaceholder: 'claude, codex, or leave blank for a shell',
  commandBarCwdLabel: 'Directory',
  commandBarCwdPlaceholder: 'Working directory',
  commandBarSubmit: 'Open',
  commandBarCancel: 'Cancel',
  sidebarHeading: 'Sessions',
  sidebarEmpty: 'No sessions discovered on this machine.',
  statusHeading: 'Status',
  tabExited: (exitCode: number): string => `exited (code ${exitCode})`,

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
    daysAgo === 1 ? `Plan for ${day}` : `Plan for ${day} (${daysAgo} days ago)`,
  todayAlreadyResumed: 'already resumed today',
  todayNoPlanRecorded: 'no plan recorded',
  todayResumeSelected: 'Resume selected',
  todayResumeProgress: (index: number, total: number, name: string): string =>
    `Resuming ${index} of ${total}: ${name}...`,
  todayNothingSelected: 'Nothing selected — nothing resumed.',

  // V2-T4 item 3 — the fallback confirmation dialog (S5-T9's "warn BEFORE, and ask", as a dialog
  // instead of the CLI's readline question). `reasonText` itself comes from
  // `resume/fallback-confirmer.ts` (core/resume-notice.ts#describeFallbackReason, the exact same
  // wording the CLI shows) — never duplicated here.
  fallbackDialogTitle: (sessionName: string): string => `Could not resume "${sessionName}" as-is`,
  fallbackDialogBody:
    'Opening a new session there would start a FRESH conversation: it would not have this ' +
    "session's full history.",
  fallbackDialogOpen: 'Open a fresh session',
  fallbackDialogSkip: 'Skip',

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

  // V2-T5a item 1 — the "End day..." button and its preview-as-confirmation dialog. The report
  // text itself (`endDayReport`, filled in by the renderer) is `formatEndDayReport`'s own literal
  // output (`@seeya-ai/engine/application/format-end-day.js`) — never duplicated here (D-039's
  // "the interface shows the literal text").
  endDayButton: 'End day…',
  endDayDialogTitle: 'End day',
  endDayDialogLoadingPreview: 'Loading preview…',
  endDayCostCeiling: (ceiling: {
    readonly sessionsInScope: number;
    readonly budgetPerSessionUsd: number;
    readonly captureModel: string;
    readonly totalCeilingUsd: number;
  }): string =>
    'This preview cost nothing — it never called the model. If you run it: up ' +
    `to ${ceiling.sessionsInScope} × $${ceiling.budgetPerSessionUsd.toFixed(2)} per session ` +
    `(model: ${ceiling.captureModel}) — at most $${ceiling.totalCeilingUsd.toFixed(2)} total. ` +
    'This is a ceiling the capture itself enforces, never an estimate of what it will spend.',
  endDayRunNow: 'Run end-day now',
  endDayCancel: 'Cancel',

  // V2-T5a item 4 — running and the final result. "capturing N of M: <name>" mirrors
  // todayResumeProgress's own wording for the other daily-cycle progress line.
  endDayRunningNoProgressYet: 'Starting…',
  endDayCaptureProgress: (index: number, total: number, name: string): string =>
    `Capturing ${index} of ${total}: ${name}...`,
  endDayClose: 'Close',
} as const;
