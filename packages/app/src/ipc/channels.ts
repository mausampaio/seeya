/**
 * IPC channel names and payload shapes shared by `electron/main.ts`, `electron/preload.ts` and
 * `electron/renderer.ts` — pure (no `electron` import, so it's outside `electron/` and reachable
 * from all three without tripping the electron-only-in-electron/ guard). A renamed/misspelled
 * channel string is a classic Electron footgun (main and renderer silently never talking to each
 * other); this module is the one place the string exists.
 *
 * V2-T51: the payload types live in `ipc/channel-types-*.ts`, one file per domain, re-exported
 * below — a caller still imports every channel name and every payload type from here.
 */
export type * from './channel-types-tabs.js';
export type * from './channel-types-today.js';
export type * from './channel-types-end-day.js';
export type * from './channel-types-schedule-daemon.js';
export type * from './channel-types-projects.js';
export type * from './channel-types-sessions.js';
export type * from './channel-types-project-details.js';

export const CHANNELS = {
  /** Renderer → main: open a new tab. */
  createTab: 'seeya:create-tab',
  /** Renderer → main: fetch the terminal's font config, once at startup
   * (`state/terminal-font.ts`). Config is read once when the interface starts (V2-T2); the
   * renderer never re-fetches this on its own. */
  getTerminalFontConfig: 'seeya:get-terminal-font-config',
  /** Renderer → main: keystrokes/paste for one tab. */
  writeTab: 'seeya:write-tab',
  /** Renderer → main: the terminal element for one tab was resized. */
  resizeTab: 'seeya:resize-tab',
  /** Renderer → main: close one tab (ends its process). */
  closeTab: 'seeya:close-tab',
  /** Renderer → main: forget a tab whose process has already exited (V2-T3 review) — the renderer
   * already removed its own button/pane by the time this fires; this is what keeps `main.ts`'s
   * own `TabCollection` from still holding an entry for it (otherwise `findTabByPid`'s aba↔sessão
   * correspondence — D-025 — could match a NEW session against a stale entry's pid, the concrete
   * risk being OS pid reuse). Never sent for a tab whose process is still running — that case
   * still goes through `closeTab` above, unchanged. */
  removeTab: 'seeya:remove-tab',
  /** Main → renderer: output chunk for one tab. */
  tabData: 'seeya:tab-data',
  /** Main → renderer: one tab's process ended. */
  tabExit: 'seeya:tab-exit',
  /** Main → renderer, pushed on an interval by `state/refresh-loop.ts` (docs/PLANO-DE-ENTREGA.md
   * V2-T2: "atualizada em intervalo pelo relógio injetado"): the sidebar's rows, same content as
   * `seeya sessions` (`sidebar/sidebar-data.ts#buildSidebarRows`). */
  sessionsUpdate: 'seeya:sessions-update',
  /** Main → renderer, pushed on the same interval: the status panel's text, same content as
   * `seeya status` (`state/status-panel.ts#buildStatusPanelText`). */
  statusUpdate: 'seeya:status-update',
  /** Main → renderer: the fallback question (V2-T4 item 3, S5-T9's "warn BEFORE, and ask") — sent
   * once per session whose `attemptResume` reported `needsFallback`,
   * `resume/fallback-confirmer.ts#buildFallbackConfirmer`'s own `send`. */
  confirmFallbackRequest: 'seeya:confirm-fallback-request',
  /** Renderer → main: the person's answer to one `confirmFallbackRequest`, by `requestId` —
   * `resume/pending-fallback-requests.ts#PendingFallbackRequests.resolve`'s own input. */
  confirmFallbackAnswer: 'seeya:confirm-fallback-answer',
  /** Renderer → main: the "Today" panel's own data (V2-T4 item 1, `state/today-panel.ts`) —
   * fetched once at startup and again after `resumeSelected` finishes, same "no polling of its
   * own" shape `getTerminalFontConfig` already has. */
  getTodayPanel: 'seeya:get-today-panel',
  /** Main → renderer, pushed on the same refresh tick as `sessionsUpdate` (V2-T18 item 2): the
   * "Today" panel's own data, recomputed with fresh liveness only
   * (`state/today-panel.ts#refreshTodayPanelLiveness`) — the second achado this task fixes: the
   * panel used to render once at startup and then never again, so a session opened outside the
   * window kept showing "not running now" until the window reloaded. Skipped that tick when
   * nothing has been fetched yet (`refreshTodayPanelLiveness`'s own `null` case). */
  todayUpdate: 'seeya:today-update',
  /** Renderer → main: "Resume selected" — the sessions the person checked, for the day the panel
   * is showing. */
  resumeSelected: 'seeya:resume-selected',
  /** Main → renderer, pushed once per session while `resumeSelected` is running: "resuming N of
   * M: <name>" (`application/start-day.ts#ResumeProgressEvent`, projected to just what the
   * renderer needs to say). */
  resumeProgress: 'seeya:resume-progress',
  /** Main → renderer: a tab the RESUMER opened (not the command bar) — `electron/main.ts`'s own
   * `TabResumeOpener` sends this right after spawning the pty, so the renderer can create the same
   * `@xterm/xterm` instance/tab-strip button `createTab`'s own round trip creates, labeled with the
   * handoff's name instead of the raw `claude` command (V2-T4: "a aba ... rotulada com o nome da
   * sessão"). Unlike `createTab`, the renderer never calls back to spawn anything here — the pty
   * already exists by the time this event arrives. */
  resumeTabOpened: 'seeya:resume-tab-opened',
  /** Renderer → main: "End day…" — runs `endDay(deps, { dryRun: true, scope: { kind: 'fullDay' } })`
   * (V2-T5a item 1) and returns the SAME literal report text `seeya end-day --dry-run` prints,
   * plus the interface's own cost-ceiling line (which has no CLI equivalent). Never writes or
   * terminates anything — D-039, D-002. */
  endDayPreview: 'seeya:end-day-preview',
  /** Renderer → main: "Run end-day now" — runs the real `endDay` (V2-T5a item 4), notifies
   * through the same `Notifier`/`buildEndDayNotice` `seeya end-day` uses, and returns the SAME
   * literal report text `seeya end-day` prints. Rejects if a run is already in progress (defense
   * in depth — the renderer already disables the button while `running`). */
  endDayRun: 'seeya:end-day-run',
  /** Main → renderer, pushed once per session while `endDayRun` is in flight: "capturing N of M:
   * <name>" (`EndDayOptions.onCaptureProgress`, `state/end-day-progress.ts`'s own projection). */
  endDayProgress: 'seeya:end-day-progress',
  /** Main → renderer, pushed on the same refresh tick as `statusUpdate` (V2-T5b item 1): the
   * faixa de horário's own data (`state/schedule-strip.ts#buildScheduleStripData`), computed from
   * the same `decideSchedule` the daemon itself polls. */
  scheduleUpdate: 'seeya:schedule-update',
  /** Renderer → main: the faixa de horário's own data, fetched once at startup (V2-T75 PO review,
   * round 3) — the same "fetch once for first paint, push for every refresh after" shape
   * `getProjectsPanel`/`getTodayPanel` already establish, needed for the identical reason
   * `getProjectsPanel`'s own docstring measured: the ambient refresh loop's first tick can race
   * ahead of the renderer's own `onScheduleUpdate` registration, leaving the footer blank for up
   * to `REFRESH_INTERVAL_MS * 2`. */
  getScheduleStrip: 'seeya:get-schedule-strip',
  /** Renderer → main: one of the faixa's "Snooze +15m/+30m/+1h" buttons — runs
   * `@seeya-ai/engine/application/schedule-adjustments.js#snoozeToday` and returns the freshly
   * recomputed strip, so the faixa updates immediately rather than waiting for the next ambient
   * tick (V2-T5b item 1). */
  snoozeToday: 'seeya:snooze-today',
  /** Renderer → main: the faixa's "Skip today" button — runs
   * `@seeya-ai/engine/application/schedule-adjustments.js#skipToday`, same immediate-update shape
   * as `snoozeToday` above. */
  skipToday: 'seeya:skip-today',
  /** Renderer → main: the Snooze menu's "Undo snooze" (V2-T50) — runs
   * `@seeya-ai/engine/application/schedule-adjustments.js#undoSnoozeToday` and returns the freshly
   * recomputed strip, same immediate-update shape as `snoozeToday` above. */
  undoSnoozeToday: 'seeya:undo-snooze-today',
  /** Main → renderer, pushed on the same refresh tick as `statusUpdate`/`scheduleUpdate`
   * (V2-T5b item 3): the daemon's own liveness, projected by
   * `state/daemon-control-panel.ts#resolveDaemonControlAvailability` from the SAME
   * `checkLiveLock` the status panel's own daemon section already computes. */
  daemonAvailabilityUpdate: 'seeya:daemon-availability-update',
  /** Renderer → main: the daemon pill's own availability, fetched once at startup (V2-T75 PO
   * review, round 3) — same reasoning and same shape as `getScheduleStrip` above. */
  getDaemonAvailability: 'seeya:get-daemon-availability',
  /** Renderer → main: "Start daemon"/"Stop daemon" (V2-T5b item 3) — `action` is decided by the
   * renderer's own `DaemonControlAvailability` at click time (`state/daemon-control-panel.ts`),
   * never re-derived in main.ts. */
  daemonControl: 'seeya:daemon-control',
  /** Renderer → main: the Settings dialog's own data (V2-T14 item 1) — fetched every time the
   * dialog opens (never cached across opens, unlike `getTerminalFontConfig`: another process, e.g.
   * `seeya config set`, could have written `config.json` since the dialog last showed). */
  getSettingsPanel: 'seeya:get-settings-panel',
  /** Renderer → main: one field's edit, from the Settings dialog (V2-T14 item 2) — validated and
   * applied through the SAME `parseConfigFieldUpdate`/`applyConfigFieldUpdate` +
   * `Storage.saveConfig` path `seeya config set` already uses, never a second validation of its
   * own. */
  saveSetting: 'seeya:save-setting',
  /** Main → renderer, pushed on the same refresh tick as `daemonAvailabilityUpdate` (V2-T13 item
   * 4): the autostart button's own availability, from
   * `state/autostart-control-panel.ts#resolveAutostartControlAvailability`. */
  autostartAvailabilityUpdate: 'seeya:autostart-availability-update',
  /** Renderer → main: "Enable autostart"/"Disable autostart" (V2-T13 item 4) — `action` is decided
   * by the renderer's own last-known `AutostartControlAvailability` at click time, never
   * re-derived in `main.ts` (same D-041 discipline `daemonControl` already follows). */
  autostartControl: 'seeya:autostart-control',
  /** Renderer → main: the autostart switch's own availability, fetched once when Settings' own
   * General section first mounts (V2-T65) — same "fetch once for first paint, push for every
   * refresh after" shape `getDaemonAvailability` already established, reusing the SAME
   * `autostartAvailabilityUpdate` push for live updates while the dialog stays open. Answers from
   * the ambient-tick cache only (never a direct `Autostart.status()` call of its own) — that call
   * measured up to ~6s cold (`state/autostart-cache.ts`'s own docstring); a dialog opening would
   * otherwise stall on it. `{ kind: 'unknown' }` before the first tick has ever populated the
   * cache (D-025), corrected by the very next push. */
  getAutostartAvailability: 'seeya:get-autostart-availability',
  /** Renderer → main: the ownership-transition dialog's own data (V2-T13 item 5, D-045 item 1) —
   * fetched once at startup, same "no polling of its own" shape `getTerminalFontConfig` already
   * has. `shouldOffer: false` means the dialog never opens this run. */
  getDaemonOwnershipTransitionOffer: 'seeya:get-daemon-ownership-transition-offer',
  /** Renderer → main: the person's answer to the ownership-transition dialog (V2-T13 item 5). */
  answerDaemonOwnershipTransition: 'seeya:answer-daemon-ownership-transition',
  /** Main → renderer, pushed on the same refresh tick as `sessionsUpdate` and again right after
   * "New project…"/"Open"/"Adopt…" finish (V2-T30 item 1): the "Projects" section's own data
   * (`state/projects-panel.ts#buildProjectsPanelData`) — every project the workspace holds, its
   * lock status, and the sessions grouped under it or left in "Other sessions". */
  projectsUpdate: 'seeya:projects-update',
  /** Renderer → main: the "Projects" section's own data, fetched once at startup
   * (`electron/project-panel-view.ts#wireProjectPanel`) — the same "explicit fetch for the first
   * paint, push for every refresh after" shape `getTodayPanel`/`onTodayUpdate` already establish,
   * needed because the ambient refresh loop's first tick can otherwise race ahead of the
   * renderer's own `onProjectsUpdate` registration (see `electron/project-ipc.ts`'s own
   * docstring). */
  getProjectsPanel: 'seeya:get-projects-panel',
  /** Renderer → main: the "Project details" dialog's own data (V2-T83, `docs/INTERFACE.md` §
   * 4a) — fetched when the dialog opens and again after every action, never pushed on the ambient
   * cycle (a dialog nobody has open costs nothing). */
  getProjectDetails: 'seeya:get-project-details',
  /** Renderer → main: "Add repository…" (V2-T83) — the same `addRepository` `seeya project
   * add-repo` calls, with the path the OS folder picker (`pickDirectory`) returned. */
  addProjectRepository: 'seeya:add-project-repository',
  /** Renderer → main: a repository row's "Remove" (V2-T83) — the same `removeRepository`
   * `seeya project remove-repo` calls. */
  removeProjectRepository: 'seeya:remove-project-repository',
  /** Renderer → main: "Revert…" on an adopted session (V2-T83) — the same `revertAdoption` `seeya
   * project revert-adoption` calls; its two questions travel as the two request/answer pairs
   * below. Resolves once the revert (or the refusal) is decided. */
  revertProjectAdoption: 'seeya:revert-project-adoption',
  /** Renderer → main: "Remove project" (V2-T83) — the same `removeProject` `seeya project remove`
   * calls; its one question is `confirmRemoveProjectRequest` below. */
  removeProject: 'seeya:remove-project',
  /** Renderer → main: "Archive project…" confirmed (V2-T84, `docs/INTERFACE.md` § 4b) — the same
   * `archiveProject` `seeya project archive` calls. The confirmation (with the optional note) is
   * the renderer's own dialog, so no engine question travels back. */
  archiveProject: 'seeya:archive-project',
  /** Renderer → main: "Unarchive" confirmed (V2-T84) — the same `unarchiveProject` `seeya
   * project unarchive` calls. "Unarchive and open" is this call followed by the ordinary
   * `openProject`. */
  unarchiveProject: 'seeya:unarchive-project',
  /** Main → renderer: `revertAdoption`'s own `confirmRevert` (V2-T83, `docs/INTERFACE.md` § 9). */
  confirmRevertAdoptionRequest: 'seeya:confirm-revert-adoption-request',
  answerRevertAdoptionConfirm: 'seeya:answer-revert-adoption-confirm',
  /** Main → renderer: `revertAdoption`'s own `confirmDeleteCopy` — asked only when the adopted
   * copy kept writing after the adoption (or could not be checked). */
  confirmDeleteAdoptedCopyRequest: 'seeya:confirm-delete-adopted-copy-request',
  answerDeleteAdoptedCopyConfirm: 'seeya:answer-delete-adopted-copy-confirm',
  /** Main → renderer: `removeProject`'s own `confirmRemove`. */
  confirmRemoveProjectRequest: 'seeya:confirm-remove-project-request',
  answerRemoveProjectConfirm: 'seeya:answer-remove-project-confirm',
  /** Renderer → main: "New project…" (V2-T30 item 4) — the same `createProject` `seeya project
   * create` calls. */
  createProject: 'seeya:create-project',
  /** Renderer → main: a project's "Open" button (V2-T30 item 3) — the same `openProject` `seeya
   * project open` calls, with a tab-backed `HarnessLauncher` instead of the CLI's inherited
   * terminal. Resolves only once the tab closes (however long that takes) — the window itself
   * never waits on this: the click handler doesn't block on it either, and the tab appears right
   * away via the reused `resumeTabOpened` push (`electron/project-ipc.ts`'s own docstring). */
  openProject: 'seeya:open-project',
  /** Renderer → main: `Resume` on one of a PROJECT's own sessions (V2-T77, `docs/INTERFACE.md`
   * § 5a) — the same `openProject` pipeline as `openProject` above (lock, hooks, `CLAUDE.md`, the
   * same two questions), launching `claude --resume <id>` instead of a new session. Never the
   * simple `resumeSession` below, which skips all of that. Same non-blocking shape as
   * `openProject`: resolves only once the tab closes, or at once on a refusal. */
  resumeProjectSession: 'seeya:resume-project-session',
  /** Main → renderer: the project is locked by another live session and needs a yes/no before
   * opening read-only (V2-T35's own three-answer confirmation, in a dialog instead of `readline`). */
  confirmProjectLockOpenRequest: 'seeya:confirm-project-lock-open-request',
  /** Renderer → main: the person's answer to one `confirmProjectLockOpenRequest`, by `requestId`. */
  answerProjectLockOpenConfirm: 'seeya:answer-project-lock-open-confirm',
  /** Main → renderer: a previous session left uncommitted changes in this project, and THIS `open`
   * took the lock — a real dialog instead of the flat "refusing to open without confirmation"
   * refusal `openProject` used to fall back to every time (V2-T34 production defect, PO review
   * 2026-09-25: the window never wired `confirmLeftoverChanges` at all, so every leftover-changes
   * open from the window hit `leftoverChangesConfirmationUnavailable`, the same three-answer
   * confirmation `seeya project open`'s own `readline` question already gives the CLI). */
  confirmLeftoverChangesOpenRequest: 'seeya:confirm-leftover-changes-open-request',
  /** Renderer → main: the person's answer to one `confirmLeftoverChangesOpenRequest`. */
  answerLeftoverChangesOpenConfirm: 'seeya:answer-leftover-changes-open-confirm',
  /** Renderer → main: "Adopt…" on an "Other sessions" row (V2-T30 item 5) — the same `adoptSession`
   * `seeya project adopt` calls. Same non-blocking shape as `openProject` above. */
  adoptSession: 'seeya:adopt-session',
  /** Renderer → main: V2-T70's own single adoption dialog (`renderer/features/adoption/`) — the
   * live preview of `core/project-adoption-message.ts#renderAdoptionLaunchExplanationLines`'s own
   * three lines, recomputed as the person picks or types a project id, BEFORE `adoptSession` is
   * ever called. Replaces the separate `confirmAdoptionLaunchRequest`/`answerAdoptionLaunchConfirm`
   * round trip this task deleted: the person has already seen this exact explanation and clicked
   * "Open the copy" by the time `adoptSession` runs, so `main/project-ipc.ts`'s own `confirmLaunch`
   * callback now answers `'proceed'` immediately, with no second question
   * ("não pergunte duas vezes", `docs/INTERFACE.md` § 7 item 1). */
  previewAdoptionLaunch: 'seeya:preview-adoption-launch',
  /** Main → renderer: the adoption's own commit question, asked once the fork's tab has closed and
   * something changed inside the project (V2-T29 item 4) — V2-T70's own review dialog shows
   * `ConfirmAdoptionCommitRequestEvent.changedFileEntries`, a type+line-count breakdown
   * (`WorkspaceRepository.listChangedFilesWithStats`), not the plain path lines this channel used
   * to carry. */
  confirmAdoptionCommitRequest: 'seeya:confirm-adoption-commit-request',
  /** Renderer → main: the person's answer to one `confirmAdoptionCommitRequest`. */
  answerAdoptionCommitConfirm: 'seeya:answer-adoption-commit-confirm',
  /** Renderer → main: V2-T55 item 4's own id-search field — "an id or the start of it, straight to
   * the session, even outside the 12-hour window". Never wired into the ambient refresh cycle
   * (`electron/session-search-ipc.ts`'s own docstring); only fires when the person submits the
   * form. */
  findSessionById: 'seeya:find-session-by-id',
  /** Renderer → main: the window's effective theme, fetched once at startup, before the first
   * `new Terminal({...})` is constructed (same "invoke, not send" round trip as
   * `getTerminalFontConfig`, for the identical reason: the renderer needs a value back before it
   * can build anything). Unlike `getTerminalFontConfig`, this one DOES have a live counterpart —
   * `themeUpdate` below — because "system" (V2-T62, D-051) has to react to the OS changing, not
   * just to a relaunch. */
  getEffectiveTheme: 'seeya:get-effective-theme',
  /** Main → renderer, pushed whenever the resolved theme changes (V2-T62, D-051) —
   * `electron/main.ts`'s own `nativeTheme.on('updated', ...)` subscription, re-resolved against
   * `Config.theme` (read fresh each time, never cached — the same "storage.readConfig() at the
   * moment it's needed" precedent `getSettingsPanel` already set) and sent only when the EFFECTIVE
   * theme actually changed, so a pinned `'light'`/`'dark'` preference never triggers a needless
   * repaint just because the OS itself changed. */
  themeUpdate: 'seeya:theme-update',
  /** Renderer → main: the star, clicked from the lateral's own Favorites section or a row in the
   * Projects tab (V2-T63, `docs/INTERFACE.md` § 1 item 3) — `favorite` is the state to set (the
   * renderer already knows what it's toggling FROM, D-041). Resolves once
   * `favorite-projects.json` is saved and `projectsUpdate` has been pushed, so both places that
   * show a star reflect the change without polling for it. */
  toggleFavoriteProject: 'seeya:toggle-favorite-project',
  /** Renderer → main: the New tab popover's own "Browse…" button (V2-T64, `docs/INTERFACE.md` § 2)
   * — opens the native OS folder picker (`dialog.showOpenDialog`, main process only; a renderer
   * with `contextIsolation`/`sandbox` on has no such API of its own). A cancelled picker and an
   * empty `Directory` field are different facts (D-025): `canceled: true` leaves whatever the
   * person had already typed untouched, never clearing it. */
  pickDirectory: 'seeya:pick-directory',
  /** Renderer → main: the installed version, for Settings' own General section (V2-T65,
   * docs/INTERFACE.md § 8's own "a versão instalada... em texto terciário, selecionável") —
   * `app.getVersion()`, fetched once when the section first mounts; no push counterpart, a
   * running window's own version never changes until relaunched. */
  getAppVersion: 'seeya:get-app-version',
  /** Renderer → main: the effective home directory this window resolved at startup — `AppContext`'s
   * own `homeDir` (V2-T66 PO review, item 2), which is `os.homedir()` on a normal run but the
   * `SEEYA_APP_HOME_OVERRIDE` value during verification — never read directly as `os.homedir()` in
   * the renderer, which would disagree with it under that override. Used only to abbreviate a
   * `cwd` as `~` for display (`sidebar/directory-label.ts#collapseHomeDirectory`); fetched once,
   * a running window's own home directory never changes. */
  getHomeDir: 'seeya:get-home-dir',
  /** Renderer → main: the Sessions tab's own `Resume` button (V2-T68, `docs/INTERFACE.md` § 5) —
   * a session with no process and no project, resumed in a tab through the SAME
   * `SessionResumer.resumeWithoutPrompt`/`TabSessionResumer` the fallback-without-plan flow (V2-T7)
   * already uses, `claude --resume <id>` with no prompt argument at all. Resolves once the fast-
   * failure race settles (`raceExitAgainstGrace`, a few seconds at most) — unlike `openProject`,
   * which resolves only when the tab eventually CLOSES, this one is short enough to await directly
   * for the row's own `loading` state. */
  resumeSession: 'seeya:resume-session',
} as const;
