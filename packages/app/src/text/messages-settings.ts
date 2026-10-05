/**
 * The strings of the Settings dialog (V2-T51: split out of `text/messages.ts`, which spreads it into
 * `MESSAGES` — the same pattern `project-details-messages.ts` already uses). No imports on
 * purpose, same as `messages.ts`.
 */
export const SETTINGS_MESSAGES = {
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
} as const;
