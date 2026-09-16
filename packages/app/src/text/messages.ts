/**
 * Every string the interface shows a person, concentrated here (D-028: English; AGENTS.md §
 * "Texto voltado ao usuário" — the same discipline `packages/cli/src` already follows for CLI
 * output, applied to the renderer instead of a terminal).
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
} as const;
