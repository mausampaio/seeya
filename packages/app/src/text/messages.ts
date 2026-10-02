/**
 * Every string the interface shows a person, concentrated here (D-028: English; AGENTS.md §
 * "Texto voltado ao usuário" — the same discipline `packages/cli/src` already follows for CLI
 * output, applied to the renderer instead of a terminal). No imports on purpose (unlike `state/`,
 * which imports THIS module) — `endDayCostCeiling` below takes a structural shape matching
 * `state/end-day-preview.ts#EndDayCostCeiling` rather than importing that type, so `text/` never
 * depends on `state/`.
 */
/**
 * The Today tab's own plan-age suffix (PO review of V2-T66, third round) — "(today)" for same-day,
 * "(1 day ago)" singular, "(N days ago)" plural otherwise. The earlier version
 * (`daysAgo === 1 ? '' : ' (N days ago)'`) read as the literal "(0 days ago)" for a same-day plan
 * — the defect this fixes — and silently dropped the suffix for `daysAgo === 1` instead of saying
 * "(1 day ago)".
 *
 * **Deliberately NOT `core/consolidated-plan.ts#renderRelativeAge`, and not a defect there
 * either.** That function backs `seeya start-day`'s own title (`renderTitle`, Q-026) with a
 * DIFFERENT, already-correct and already-decided wording — no suffix at all for `daysAgo === 1`
 * ("yesterday is the ordinary case", Q-026's own words) and a dash-prefixed "— today"/"— 3 weeks
 * ago" for everything else. The two were never shared code, so fixing this one doesn't touch the
 * CLI, and the CLI never had this defect in the first place.
 *
 * @example
 * formatPlanAge(0) // 'today'
 * formatPlanAge(1) // '1 day ago'
 * formatPlanAge(2) // '2 days ago'
 */
export function formatPlanAge(daysAgo: number): string {
  if (daysAgo === 0) {
    return 'today';
  }
  return `${daysAgo} ${daysAgo === 1 ? 'day' : 'days'} ago`;
}

export const MESSAGES = {
  windowTitle: 'seeya',
  statusHeading: 'Status',
  // V2-T64 PO review: "exited (N)" — the "code" word dropped, `docs/INTERFACE.md`'s own "· exited"
  // is the exact state text a tab's own exited suffix renders (`state/tab-strip.ts
  // #buildTabStripEntries`'s own `exitedText`, kept apart from `label` so `TabStripItem` can give
  // it its own colour — the "·" separator itself is this component's own markup, not part of this
  // string).
  tabExited: (exitCode: number): string => `exited (${exitCode})`,

  // V2-T64 — the tab strip's own "+" button and its New tab popover (`docs/INTERFACE.md` § 2),
  // replacing the former command bar (`commandBar*`, removed with it).
  newTabButtonLabel: 'New tab',
  newTabPopoverHeading: 'New tab',
  newTabKindGroupLabel: 'Command',
  newTabOtherCommandLabel: 'Command',
  newTabOtherCommandPlaceholder: 'e.g. npx tsx, python -i',
  newTabDirectoryLabel: 'Directory',
  newTabDirectoryPlaceholder: 'Leave blank for the home directory',
  newTabBrowseButton: 'Browse…',
  newTabRecentDirectoriesLabel: 'Recent',
  newTabOpenButton: 'Open',
  newTabCancelButton: 'Cancel',

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

  // V2-T5b item 1 — the faixa de horário (state/schedule-strip.ts). One PAIR of strings per
  // `ScheduleDecision` variant (D-024, "nada achatado") — `primary` (weight 500, left) and
  // `secondary` (tertiary colour, right), the icon+two-text row `docs/INTERFACE.md` § 1 item 7
  // asks for (PO review, 2026-10-01: the earlier single flat `text` string read as loose text with
  // no visual hierarchy between the fact and the detail). Computed on every refresh tick from the
  // same `decideSchedule` the daemon itself polls.
  scheduleStripPrimary: 'End of day',
  scheduleStripWaitingPrimary: (time: string): string => `End of day ${time}`,
  scheduleStripNotConfigured: 'not configured',
  scheduleStripSkippedToday: 'skipped today',
  scheduleStripAlreadyRanToday: 'already ran today',
  scheduleStripRemaining: (remaining: string): string => `in ${remaining}`,
  scheduleStripDueNow: 'due now',
  // V2-T63 (`docs/INTERFACE.md` § 1's own "Snooze ▾ (menu com +15m, +30m, +1h)"): a menu replaces
  // the three always-visible buttons this footer had before. PO review (2026-10-01): the trigger
  // moved from an unstyled native `<select>` to a `Button` with a real `ChevronDownIcon` next to
  // it — the label itself no longer carries the "▾" glyph, the icon draws it now.
  scheduleStripSnoozeMenuLabel: 'Snooze',
  scheduleStripSnooze15: '+15m',
  scheduleStripSnooze30: '+30m',
  scheduleStripSnooze1h: '+1h',
  scheduleStripSkipToday: 'Skip today',
  // V2-T50 (D-006 amendment of 2026-09-24): the item inside the Snooze menu that zeroes today's
  // snooze. `docs/INTERFACE.md` § 1 does not place it; Q-NNN records the choice.
  scheduleStripUndoSnooze: 'Undo snooze',
  scheduleStripUndoSnoozeTooLate: (configuredTime: string): string =>
    `${configuredTime} has already passed`,

  // V2-T5b item 3 — Start/Stop daemon (state/daemon-control-panel.ts). `resultText` is whatever
  // the composition root's own start orchestration or
  // `@seeya-ai/engine/scheduler/daemon-control.js#runDaemonStop` already prints for the CLI's own
  // `seeya daemon`/`seeya daemon --stop` (D-039: literal text, not a second wording).
  // V2-T63 (`docs/INTERFACE.md` § 1's own "pílula do daemon"): the button's own TEXT is now the
  // state ("Daemon running"/"Daemon stopped"), not the action it offers — clicking it still does
  // the opposite of what it says, same as before, just worded as the fact it's reporting.
  daemonPillRunning: 'Daemon running',
  daemonPillStopped: 'Daemon stopped',
  daemonControlUnknown: 'Daemon: cannot verify.',
  daemonControlRunning: 'Working…',
  // Correction (real-window screenshot review): the pill's own icon button needs its own
  // aria-label naming the ACTION it performs (▶/■) — distinct from `daemonPillRunning`/
  // `daemonPillStopped` above, which are the pill's own label text (the fact, not the action).
  daemonControlStartAction: 'Start daemon',
  daemonControlStopAction: 'Stop daemon',

  // V2-T13 item 5 — the ownership-transition dialog (D-045 item 1), shown once per machine.
  daemonOwnershipTransitionTitle:
    'seeya found a daemon or autostart already set up on this machine',
  daemonOwnershipTransitionBody: (launchPath: string): string =>
    `seeya is installed (${launchPath}) and can now own the daemon and autostart on this machine. ` +
    'Accepting stops the daemon that is running (if any), points autostart at this app, and ' +
    'starts its own daemon. Declining changes nothing — whatever runs the daemon and autostart ' +
    // V2-T65: "the button next to Autostart" pointed at the sidebar footer's own autostart button,
    // apagado by this task — the switch now lives in Settings' own General section.
    'today keeps doing it, and you can enable this later from Settings → General → Start with ' +
    'the system. Either way, this is asked only once on this machine.',
  daemonOwnershipTransitionAccept: 'Let seeya take over',
  daemonOwnershipTransitionDecline: 'Leave it as it is',
  daemonOwnershipTransitionApplying: 'Working…',
  // V2-T71 — one line beside each button (`docs/INTERFACE.md` § 9's own "o que cada escolha
  // faz"), on top of the fuller paragraph above.
  daemonOwnershipTransitionAcceptExplanation:
    'Stops the daemon that is running (if any), points autostart at this app, and starts its ' +
    'own daemon.',
  daemonOwnershipTransitionDeclineExplanation:
    'Changes nothing — whatever runs the daemon and autostart today keeps doing it.',

  // V2-T14 — the "Settings" dialog (state/settings-panel.ts). One row per
  // `EDITABLE_CONFIG_KEYS` (@seeya-ai/engine/adapters/storage/config-schema.js), the same keys
  // `seeya config get` already walks. Deliberately NOT typed against `EditableConfigKey` here
  // (this module's own top comment: no imports on purpose) — `state/settings-panel.ts` is what
  // proves every key has an entry, via its own unit test. Redesigned by V2-T65
  // (docs/INTERFACE.md § 8): section navigation, readable labels, and General's own theme/autostart
  // controls, below.
  // V2-T64: moved into the tab strip's own `IconButton` (`docs/INTERFACE.md` § 2) — this is now
  // its `aria-label`, never visible button text, so the ellipsis is dropped (a screen reader would
  // otherwise read it literally as "dot dot dot").
  settingsButton: 'Settings',
  settingsDialogTitle: 'Settings',
  // V2-T65 (docs/INTERFACE.md § 8): the dialog's own footer button — "Done", not "Close", now that
  // every field saves on its own (on blur) rather than needing a final confirming click.
  settingsDialogDoneButton: 'Done',
  // Item 3's own "dizer isso na tela, em uma linha": the daemon is a separate process that rereads
  // config.json at the top of every cycle (scheduler/poll.ts) — a save here never needs it (or
  // this window) restarted to take effect there.
  settingsDaemonRereadsNote:
    'The daemon rereads config.json at the top of every cycle — no restart needed for it to pick ' +
    'up a change made here.',
  // V2-T65: short tag text next to each field (docs/INTERFACE.md § 8's own "etiqueta custom ou
  // default por campo") — distinct from the longer sentence these two keys used to carry for the
  // legacy dialog (`renderer/legacy/settings-dialog-view.ts`, apagado by this task); nothing else
  // read those longer strings (app/ and cli/ never share `text/messages.ts`, D-043).
  settingsOriginDefault: 'default',
  settingsOriginChosen: 'custom',
  // AGENTS.md § "Mensagens de erro": `errorText` already names the value that was rejected and the
  // shape expected (`parseConfigFieldUpdate`'s own message, reused verbatim, D-039 — never a second
  // wording invented in the interface).
  settingsSaveFailedPrefix: 'Not saved — ',
  // V2-T65 — section navigation (docs/INTERFACE.md § 8's own "navegação por seção à esquerda").
  settingsSectionLabels: {
    general: 'General',
    schedule: 'Schedule',
    capture: 'Capture',
    discovery: 'Discovery',
    terminal: 'Terminal',
    projects: 'Projects',
  },
  // V2-T65 — readable labels in place of the raw config key, which now rides along as a mono hint
  // instead (`state/settings-panel.ts#buildSettingsRows`'s own `label` field, docs/INTERFACE.md §
  // 8's own "rótulos legíveis no lugar do nome da chave (o nome da chave fica como dica, em
  // mono)"). One entry per `EDITABLE_CONFIG_KEYS`, same completeness guarantee as
  // `settingsFieldDescriptions` below (a missing entry fails `buildSettingsRows`'s own test).
  settingsFieldLabels: {
    endOfDayTime: 'End-of-day time',
    leadTimesInMinutes: 'Lead times',
    relevanceHours: 'Relevance window',
    idleMinutes: 'Idle after',
    captureModel: 'Capture model',
    budgetPerSessionUsd: 'Budget per session',
    captureConcurrency: 'Capture concurrency',
    ignore: 'Ignored directories',
    forkCleanupDays: 'Fork cleanup',
    maxGitRootsToVisit: 'Git roots per capture',
    maxCaptureAttemptsPerSessionPerDay: 'Capture retries',
    maxBriefingScanDays: 'Briefing scan window',
    overdueFireThresholdMinutes: 'Overdue threshold',
    leadTimeHysteresisMinutes: 'Lead time hysteresis',
    terminalFontFamily: 'Terminal font family',
    terminalFontSize: 'Terminal font size',
    theme: 'Theme',
  } as Record<string, string>,
  // V2-T65 — General section (docs/INTERFACE.md § 8). `theme` itself stays out of the generic
  // field list above — it gets a segmented control, not a text input (`GeneralSection.tsx`).
  settingsThemeOptionSystem: 'System',
  settingsThemeOptionLight: 'Light',
  settingsThemeOptionDark: 'Dark',
  settingsThemeDescription:
    'Applies immediately, across the whole window and the terminal — no restart needed. ' +
    '"System" follows this computer\'s own light/dark switch.',
  settingsAutostartLabel: 'Start with the system',
  // V2-T65 PO review: what starts at login is the DAEMON (end-day's own scheduler), not this
  // window — the earlier wording ("Launches seeya automatically") claimed the window itself.
  settingsAutostartDescription:
    'Starts the daemon at login, so end day happens even with this window closed.',
  // D-025: two different reasons for the same disabled state, never collapsed into one vaguer
  // sentence — `ownerKind` is the actual evidence `resolveAutostartControlAvailability` already
  // tracked (`state/autostart-control-panel.ts`) and used to just discard.
  settingsAutostartNotApplicableCli:
    'Managed by the CLI on this machine — use "seeya autostart enable"/"disable" instead.',
  settingsAutostartNotApplicableUnknown:
    'Could not determine what manages autostart on this machine.',
  settingsAutostartUnknown: 'Could not verify the current autostart state.',
  // `seeya 0.1.0` — `app.getVersion()` (V2-T65, docs/INTERFACE.md § 8's own "a versão instalada
  // ... em texto terciário, selecionável para copiar").
  settingsVersionLabel: (version: string): string => `seeya ${version}`,
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
    // V2-T62 (D-051): unlike the two font fields above, this one takes effect live — "system"
    // follows the OS's own light/dark switch without a relaunch (electron/main.ts's own
    // `nativeTheme` subscription).
    theme: 'Colour theme: "system" follows the OS, or pin "light"/"dark". Applies immediately.',
  } as Record<string, string>,

  // V2-T30 — the "Projects" section, its dialogs, and the sidebar's collapse toggle.
  // V2-T63 correction: the side-strip toggle's own glyph is a static `<ChevronLeftIcon/>` now
  // (`app-shell.tsx`/`ui/icons.tsx`), not a text pair swapped at runtime — see
  // `electron/sidebar-collapse-view.ts#applySidebarCollapsed`'s own docstring for why it never
  // needed a second "reopen" glyph.
  // Maintainer acceptance, 2026-09-25: the side-strip toggle above wasn't discoverable ("um
  // controle que só se acha sabendo que existe é defeito") — this second, obvious button lives in
  // the toolbar next to "+" instead, with a tooltip naming the keyboard shortcut
  // (state/sidebar-toggle-shortcut.ts's own docstring has why it's scoped to "no terminal
  // focused"). V2-T64 PO review: its own icon is a real `ChevronLeftIcon`/`ChevronRightIcon` now
  // (`state/sidebar-collapse.ts#SidebarToggleButtonIcon`), never a text glyph pair — this module
  // keeps only the tooltip text, text being its whole job (this file's own top comment).
  sidebarToggleTooltipShow: 'Show sidebar (Ctrl+B)',
  sidebarToggleTooltipHide: 'Hide sidebar (Ctrl+B)',
  otherSessionsHeading: 'Other sessions',
  otherSessionsEmpty: 'No other sessions.',
  adoptButton: 'Adopt…',
  // V2-T72 item 2 — a project whose `seeya.json` failed to parse/validate no longer just
  // disappears from the window (the maintainer's own "o projeto some"): it shows here, with the
  // same reason the CLI's own "Ignored entries:" already prints, so it's clear what to fix.
  ignoredProjectsHeading: 'Ignored projects',
  ignoredProjectRowLabel: (projectId: string, reason: string): string => `${projectId}: ${reason}`,
  // V2-T55 item 2 — "Other sessions" groups by directory instead of one row per session.
  otherSessionsDirectoryRowLabel: (dir: string, sessionCount: number): string =>
    `${dir} (${sessionCount} session${sessionCount === 1 ? '' : 's'})`,
  // V2-T55 item 3 — the modal a directory row opens: name, short id (copyable), state, last
  // activity, one line each. `stateLabel` is already the formatted V2-T52 word, never the raw enum.
  otherSessionsDirDialogTitle: (dir: string): string => `Sessions in ${dir}`,
  otherSessionsDirDialogClose: 'Close',
  otherSessionsSessionCopyIdTitle: 'Copy id',
  otherSessionsSessionCopyIdCopied: 'Copied!',
  otherSessionsSessionLastActivityLabel: (lastActivityText: string): string =>
    `last activity: ${lastActivityText}`,
  sessionLastActivityUnknown: 'unknown',
  // V2-T55 item 4 — the window's own id-search field, always available regardless of relevanceHours.
  sessionSearchLabel: 'Find session by id',
  sessionSearchPlaceholder: 'Session id or the start of it',
  sessionSearchButton: 'Find',
  sessionSearchNotFound: (query: string): string => `No session matches "${query}".`,
  sessionSearchAmbiguous: (query: string, count: number): string =>
    `"${query}" matches ${count} sessions — type a few more characters.`,
  // Correction (real-window screenshot review): this button is icon-only now (the "+" glyph
  // lives in the JSX/JS directly, `new-project-dialog-view.ts`) — this string is its
  // `aria-label`, so it stays without the ellipsis a text button would carry.
  newProjectButton: 'New project',
  newProjectDialogTitle: 'New project',
  newProjectIdLabel: 'Project id',
  newProjectSubmit: 'Create',
  newProjectCancel: 'Cancel',
  // V2-T67, same "never fails in silence" reasoning the Projects tab's own row actions follow.
  newProjectUnexpectedError: (message: string): string =>
    `seeya: create failed unexpectedly (${message}).`,
  // V2-T71 (`docs/INTERFACE.md` § 9's own "New project: campo Project id com o formato explicado
  // no erro"): shown next to the field the instant the typed id doesn't match `core/
  // project-id.ts#isValidProjectId` — the EXACT wording the task fixed, with the example id it
  // names. The engine's own `invalidId`/`alreadyExists` rejections (a submit the client-side
  // check let through, or a duplicate id — never silent, D-034) still surface through
  // `formatCreateProjectErrorText` below, unchanged.
  newProjectIdFormatError:
    'Use lowercase letters, digits and hyphens — for example payments-webhooks.',
  projectLockConfirmTitle: (projectId: string): string => `Project "${projectId}" is locked`,
  projectLockConfirmProceed: 'Open read-only',
  projectLockConfirmDecline: 'Cancel',
  // V2-T71 — one line beside each button (`docs/INTERFACE.md` § 9's own "o que cada opção faz
  // escrito ao lado dela").
  projectLockConfirmProceedExplanation:
    'You can look around, but nothing you change here will be saved until the other session ' +
    'finishes.',
  projectLockConfirmDeclineExplanation: 'Go back without opening the project.',
  leftoverChangesConfirmTitle: (projectId: string): string =>
    `Project "${projectId}" has uncommitted changes from a previous session`,
  leftoverChangesConfirmContext: (count: number): string =>
    `${count} file${count === 1 ? '' : 's'} changed, left uncommitted by a previous session:`,
  leftoverChangesConfirmCommit: 'Commit now',
  leftoverChangesConfirmProceed: 'Continue without committing',
  // V2-T71 — one line beside each button.
  leftoverChangesConfirmProceedExplanation:
    "Proceed, and the new session will be told what's still pending.",
  leftoverChangesConfirmCommitExplanation:
    'Commit these changes now (attributed to an unidentified session) before continuing.',
  // V2-T70 (`docs/INTERFACE.md` § 7): the single adoption dialog — picker, explanation and
  // review/result, replacing the four separate dialogs V2-T30 item 5 used to show.
  adoptPickTitle: 'Adopt into project',
  adoptPickExistingLabel: 'Existing project',
  adoptPickNewLabel: 'New project',
  adoptPickNewProjectIdLabel: 'Project id',
  adoptPickSubmit: 'Open the copy',
  adoptPickCancel: 'Cancel',
  adoptPickNoProjectChosen: 'Choose an existing project or type a new project id.',
  adoptPickInvalidNewProjectId:
    'Use lowercase letters, digits and hyphens — for example payments-webhooks.',
  adoptPickNoExistingProjects: 'No projects yet — type a new project id below.',
  adoptPickExplanationHeading: 'What happens next',
  adoptReviewTitle: 'Review before committing',
  adoptReviewEmpty: 'Nothing changed inside the project.',
  // PO review round 2 (`docs/INTERFACE.md` § 9's own "uma linha de contexto, o que cada opção
  // faz escrito ao lado dela" — the pattern `leftoverChangesConfirmContext`/
  // `leftoverChangesConfirm{Commit,Proceed}Explanation` above already established): the context
  // line sits in the scrollable body, above the file list; the two explanations sit in the
  // dialog's own fixed footer, above the buttons they describe.
  adoptReviewContext: (count: number, projectId: string): string =>
    `${count} file${count === 1 ? '' : 's'} changed in project "${projectId}":`,
  adoptReviewCommit: 'Commit',
  adoptReviewDiscard: 'Discard',
  adoptReviewDiscardExplanation: "Discard the copy's changes — nothing is recorded in the project.",
  adoptReviewCommitExplanation: 'Commit these changes to the project, attributed to this adoption.',
  adoptResultTitle: 'Adoption result',
  adoptResultOpenProject: 'Open project',
  adoptResultClose: 'Close',
  // V2-T70: the adoption review dialog's own per-file type badge (`state/adoption-review.ts`'s
  // own `AdoptionReviewRow.kind`).
  adoptReviewKindAdded: 'A',
  adoptReviewKindModified: 'M',
  adoptReviewKindDeleted: 'D',

  // V2-T63 — the lateral redesign (docs/INTERFACE.md § 1) and the reusable page-tab mechanism
  // (§ 2's own "abas de página": Today/Projects/Sessions).
  sidebarFavoritesHeading: 'Favorites',
  sidebarFavoriteStarLabel: (favorite: boolean, name: string): string =>
    favorite ? `Unstar ${name}` : `Star ${name}`,
  sidebarFavoriteOpenHere: 'open here',
  sidebarFavoriteLocked: 'locked',
  sidebarFavoritesEmpty: 'No favorites yet — star a project to pin it here.',
  sidebarRecentHeading: 'Recent',
  sidebarRecentEmpty: 'Nothing recent yet.',
  // Correction (real-window screenshot review): "All projects"/"Sessions" are nav rows now —
  // icon + label + a right-aligned count, built as separate DOM pieces
  // (`electron/sidebar-favorites-view.ts`), never one combined string like "All projects (2)".
  sidebarAllProjectsLabel: 'All projects',
  sidebarSessionsLabel: 'Sessions',
  sidebarSessionsCount: (runningCount: number): string => `${runningCount} running`,
  pageTabLabelToday: 'Today',
  pageTabLabelProjects: 'Projects',
  pageTabLabelSessions: 'Sessions',

  // V2-T67 — the Projects tab (`docs/INTERFACE.md` § 4), replacing the imperative
  // `renderer/legacy/projects-list-view.tsx` this task deletes.
  projectsTabTitle: 'Projects',
  projectsTabCount: (count: number): string => `${count} ${count === 1 ? 'project' : 'projects'}`,
  projectsSearchLabel: 'Search projects',
  projectsSearchPlaceholder: 'Search by name',
  projectsFilterGroupLabel: 'Filter projects',
  projectsFilterAll: 'All',
  projectsFilterRunning: 'With a running session',
  projectsFilterLocked: 'Locked',
  projectsTableHeaderName: 'Name',
  projectsTableHeaderLock: 'Lock',
  projectsTableHeaderSessions: 'Sessions',
  projectsTableHeaderRepositories: 'Repositories',
  projectsTableHeaderLastActivity: 'Last activity',
  // `docs/INTERFACE.md` § 4's own three lock texts, verbatim — `ProjectRowLock`
  // (`state/projects-panel.ts`) is the one place that decides WHICH of these a row shows.
  projectsLockOpenHere: 'Open in this window',
  projectsLockUnlocked: 'Unlocked',
  projectsLockLockedBy: (displaySessionId: string): string =>
    `Locked by session ${displaySessionId}`,
  projectsLockLockedByUnknown: 'Locked by an unidentified session',
  projectsActionGoToTab: 'Go to tab',
  projectsActionOpen: 'Open',
  projectsActionReadOnly: 'Read only…',
  projectsEmptyTitle: 'No projects yet',
  projectsEmptyDescription: 'Create a project to get started.',
  projectsNoMatchTitle: 'No projects match',
  projectsNoMatchDescription: 'Try a different search or filter.',
  // PO review round 1: the raw enum-ish "unknown" read as an error, not an absence of data —
  // a dash in secondary tone reads as "nothing recorded" instead, with the `title` saying so
  // explicitly (D-025: never a guessed date, just a clearer way to say there isn't one).
  projectsLastActivityUnknown: '—',
  projectsLastActivityUnknownTitle: 'No activity recorded for this project yet.',

  // V2-T68 — the Sessions tab (`docs/INTERFACE.md` § 5), replacing the directory modal and the
  // id-search field this task deletes (`other-sessions-dir-dialog-view.ts`/`session-search-view.ts`).
  sessionsTabTitle: 'Sessions',
  sessionsTabCount: (count: number): string => `${count} ${count === 1 ? 'session' : 'sessions'}`,
  sessionsTabRunningCount: (count: number): string => `${count} running`,
  sessionsSearchLabel: 'Search by name or id',
  sessionsSearchPlaceholder: 'Name, id, or the start of it',
  sessionsFilterStateGroupLabel: 'Filter by state',
  sessionsFilterStateAll: 'All',
  sessionsFilterStateRunning: 'Running',
  sessionsFilterStateNotRunning: 'Not running',
  sessionsFilterProjectLabel: 'Project',
  sessionsFilterProjectAny: 'Any project',
  sessionsFilterProjectNone: 'No project',
  sessionsFilterDirectoryLabel: 'Directory',
  sessionsFilterDirectoryAny: 'Any directory',
  sessionsTableHeaderName: 'Name',
  sessionsTableHeaderId: 'Id',
  sessionsTableHeaderState: 'State',
  sessionsTableHeaderDirectory: 'Directory',
  sessionsTableHeaderProject: 'Project',
  sessionsTableHeaderLastActivity: 'Last activity',
  sessionsNoProject: 'No project',
  sessionsActionResume: 'Resume',
  sessionsEmptyTitle: 'No sessions yet',
  sessionsEmptyDescription: 'Discovered sessions will show up here.',
  sessionsNoMatchTitle: 'No sessions match',
  sessionsNoMatchDescription: 'Try a different search or filter.',

  // V2-T77 (`docs/INTERFACE.md` § 5a) — a project's own sessions, listed under its row in the
  // Projects tab, each with `Resume` (the project's `open` flow, not the simple resume).
  projectSessionsExpandLabel: (projectName: string, expanded: boolean): string =>
    `${expanded ? 'Hide' : 'Show'} sessions of ${projectName}`,
  projectSessionsListLabel: (projectName: string): string => `Sessions of ${projectName}`,
  projectSessionsNone: 'No sessions yet. Open the project to start one.',
  projectSessionsShowAll: (totalCount: number): string => `Show all ${totalCount} in Sessions`,
  projectSessionsResumeTitle:
    'Resumes this session through the same flow as Open: lock, hooks, CLAUDE.md.',
  projectSessionsDismissResult: 'Dismiss',
} as const;
