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
  // V2-T9 item 4: replaces the old todayAlreadyResumed — the checkbox rule now depends on
  // liveness, not just resumed.json (state/today-panel.ts#TodayResumeStatus).
  todayRunningNow: 'running now',
  todayResumedEarlier: 'resumed earlier, not running now',
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
  todayNothingSelected: 'Nothing selected — nothing resumed.',

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

  // V2-T5b item 1 — the faixa de horário (state/schedule-strip.ts). One string per
  // `ScheduleDecision` variant (D-024, "nada achatado"), computed on every refresh tick from the
  // same `decideSchedule` the daemon itself polls.
  scheduleStripDisabled: 'End of day: not configured.',
  scheduleStripSkipped: 'End of day: skipped today.',
  scheduleStripAlreadyEnded: 'End of day: already ran today.',
  scheduleStripWaiting: (time: string, remaining: string): string =>
    `End of day at ${time} — in ${remaining}`,
  scheduleStripLeadTimeWarning: (remaining: string): string => `End of day in ${remaining}`,
  scheduleStripEndOfDay: 'End of day: due now — the daemon acts on its next poll.',
  scheduleStripSnooze15: 'Snooze +15m',
  scheduleStripSnooze30: 'Snooze +30m',
  scheduleStripSnooze1h: 'Snooze +1h',
  scheduleStripSkipToday: 'Skip today',

  // V2-T5b item 3 — Start/Stop daemon (state/daemon-control-panel.ts). `resultText` is whatever
  // the composition root's own start orchestration or
  // `@seeya-ai/engine/scheduler/daemon-control.js#runDaemonStop` already prints for the CLI's own
  // `seeya daemon`/`seeya daemon --stop` (D-039: literal text, not a second wording).
  daemonControlStart: 'Start daemon',
  daemonControlStop: 'Stop daemon',
  daemonControlUnknown: 'Daemon: cannot verify — see the status panel.',
  daemonControlRunning: 'Working…',

  // V2-T14 — the "Settings" dialog (state/settings-panel.ts). One row per
  // `EDITABLE_CONFIG_KEYS` (@seeya-ai/engine/adapters/storage/config-schema.js), same sixteen keys
  // `seeya config get` already walks. Deliberately NOT typed against `EditableConfigKey` here
  // (this module's own top comment: no imports on purpose) — `state/settings-panel.ts` is what
  // proves every key has an entry, via its own unit test.
  settingsButton: 'Settings…',
  settingsDialogTitle: 'Settings',
  settingsDialogClose: 'Close',
  // Item 3's own "dizer isso na tela, em uma linha": the daemon is a separate process that rereads
  // config.json at the top of every cycle (scheduler/poll.ts) — a save here never needs it (or
  // this window) restarted to take effect there.
  settingsDaemonRereadsNote:
    'The daemon rereads config.json at the top of every cycle — no restart needed for it to pick ' +
    'up a change made here.',
  settingsOriginDefault: 'seeya default',
  settingsOriginChosen: 'set in config.json',
  settingsSaveButton: 'Save',
  settingsSavedNote: (key: string): string => `${key} saved.`,
  // AGENTS.md § "Mensagens de erro": `errorText` already names the value that was rejected and the
  // shape expected (`parseConfigFieldUpdate`'s own message, reused verbatim, D-039 — never a second
  // wording invented in the interface).
  settingsSaveFailedPrefix: 'Not saved — ',
  // V2-T14's own "o que não entra": projectPolicy is read-only here, same content
  // cli/config-command.ts#renderProjectPolicySection already prints for "seeya config get".
  settingsProjectPolicyHeading:
    'Project policy (read-only — edit with "seeya config policy <cwd>")',
  settingsProjectPolicyEmpty: '(none)',
  settingsProjectPolicyLine: (line: {
    readonly cwd: string;
    readonly canTerminate: boolean;
    readonly deepCapture: boolean;
  }): string => `${line.cwd}: canTerminate=${line.canTerminate}, deepCapture=${line.deepCapture}`,

  settingsFieldDescriptions: {
    endOfDayTime:
      'Local time ("HH:MM") the day ends and end-day capture runs; "null" disables the scheduled ' +
      'trigger — capture then only ever runs when you ask for it.',
    leadTimesInMinutes:
      'Minutes before endOfDayTime a "closing soon" notice fires — comma-separated, e.g. "30, 15" ' +
      'for two warnings.',
    relevanceHours:
      'How many hours back a session still counts as relevant enough to show/capture.',
    idleMinutes: 'Minutes without activity before a session is considered idle rather than alive.',
    captureModel: 'The Claude model end-day capture asks to summarize each session.',
    budgetPerSessionUsd: 'The dollar ceiling end-day capture enforces per session.',
    captureConcurrency: 'How many sessions end-day captures at the same time.',
    ignore: 'Comma-separated directory prefixes end-day never captures.',
    forkCleanupDays: 'Days a seeya-created fork is kept on disk before it gets deleted.',
    maxGitRootsToVisit:
      'The ceiling on how many git roots one capture visits looking for evidence.',
    maxCaptureAttemptsPerSessionPerDay:
      'How many times end-day retries capturing the same session in one day.',
    maxBriefingScanDays: 'How many days back "start-day" looks for a pending briefing.',
    overdueFireThresholdMinutes:
      'Minutes past endOfDayTime before an overdue session becomes due for termination.',
    leadTimeHysteresisMinutes:
      'Minimum minutes between two lead-time warnings, so a moved deadline never fires two notices ' +
      'back to back.',
    // Both font fields (V2-T3): the embedded terminal only reads these once, at startup
    // (electron/renderer.ts's own `terminalFontConfig` docstring) — said here so editing one in
    // this dialog doesn't look like it silently failed.
    terminalFontFamily:
      "The embedded terminal's CSS font-family stack — a change here needs seeya relaunched to show.",
    terminalFontSize:
      "The embedded terminal's font size, in pixels — a change here needs seeya relaunched to show.",
  } as Record<string, string>,
} as const;
