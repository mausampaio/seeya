/**
 * The strings of the End day dialog and its sidebar reopen affordance (V2-T51: split out of `text/messages.ts`, which spreads it into
 * `MESSAGES` — the same pattern `project-details-messages.ts` already uses). No imports on
 * purpose, same as `messages.ts`.
 */
export const END_DAY_MESSAGES = {
  // V2-T5a item 1, reworked by V2-T69 into structured preview/progress/result views
  // (`docs/INTERFACE.md` § 6, principle 5 — "nada de texto da CLI despejado na tela"): the
  // "End day…" button and its preview/progress/result dialog. No more `reportText` here — every
  // list comes from `state/end-day-sessions.ts`'s own structured rows, built from the same
  // `EndDayResult` the CLI's own `formatEndDayReport` reads, never that function's literal text.
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
  endDayWillBeCapturedHeading: (count: number): string => `Will be captured · ${count}`,
  endDayNotCapturedHeading: (count: number): string => `Not captured · ${count}`,
  endDayNothingToShow: 'Nothing to show.',

  // V2-T69 — "em andamento": the headline mirrors todayResumeProgress's own wording for the other
  // daily-cycle progress line. The gap between clicking "Run end-day now" and the first progress
  // event (discovery + eligibility run for real before any session starts, `application/end-day.ts
  // `'s own pipeline — a genuine, sometimes multi-second wait, not a cosmetic delay) is the
  // `starting` phase's own job (`state/end-day-panel.ts`): it shows the frozen preview with this
  // button's own `loading` state, never a "running" view with nothing yet to report.
  endDayCaptureProgress: (index: number, total: number, name: string): string =>
    `Capturing ${index} of ${total}: ${name}...`,
  endDayHide: 'Hide',
  endDayStatusWaiting: 'Waiting',
  endDayStatusCapturing: 'Capturing',
  endDayStatusCaptured: 'Captured',
  endDayStatusIneligible: 'Skipped',
  endDayStatusClosed: 'Closed',
  endDayStatusFailed: 'Failed',

  // V2-T69 — the result view's own three sections and its one action.
  endDayResultCapturedHeading: (count: number): string => `Captured · ${count}`,
  endDayResultFailedHeading: (count: number): string => `Failed · ${count}`,
  endDayResultSkippedHeading: (count: number): string => `Skipped · ${count}`,
  endDayOpenToday: 'Open Today',
  endDayClose: 'Close',

  // V2-T69 — the sidebar footer's own reopen affordance (`docs/INTERFACE.md` § 6: "o rodapé da
  // lateral mostra que há captura em andamento e permite reabrir") once the dialog is hidden while
  // a capture is still running, or finished without anyone watching.
  endDayFooterCapturing: (index: number, total: number): string =>
    `Capturing ${index} of ${total}…`,
  endDayFooterFinishedHidden: 'End day finished — view results',
} as const;
