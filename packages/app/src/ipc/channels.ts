/**
 * IPC channel names and payload shapes shared by `electron/main.ts`, `electron/preload.ts` and
 * `electron/renderer.ts` — pure (no `electron` import, so it's outside `electron/` and reachable
 * from all three without tripping the electron-only-in-electron/ guard). A renamed/misspelled
 * channel string is a classic Electron footgun (main and renderer silently never talking to each
 * other); this module is the one place the string exists.
 */
import type { SidebarRow } from '../sidebar/sidebar-data.js';
import type { TerminalFontOptions } from '../state/terminal-font.js';
import type { TodayPanelData } from '../state/today-panel.js';
import type { ScheduleStripData } from '../state/schedule-strip.js';
import type { DaemonControlAvailability } from '../state/daemon-control-panel.js';
import type { AutostartControlAvailability } from '../state/autostart-control-panel.js';
import type { SettingsRow, ProjectPolicyLine } from '../state/settings-panel.js';

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
  /** Renderer → main: one of the faixa's "Snooze +15m/+30m/+1h" buttons — runs
   * `@seeya-ai/engine/application/schedule-adjustments.js#snoozeToday` and returns the freshly
   * recomputed strip, so the faixa updates immediately rather than waiting for the next ambient
   * tick (V2-T5b item 1). */
  snoozeToday: 'seeya:snooze-today',
  /** Renderer → main: the faixa's "Skip today" button — runs
   * `@seeya-ai/engine/application/schedule-adjustments.js#skipToday`, same immediate-update shape
   * as `snoozeToday` above. */
  skipToday: 'seeya:skip-today',
  /** Main → renderer, pushed on the same refresh tick as `statusUpdate`/`scheduleUpdate`
   * (V2-T5b item 3): the daemon's own liveness, projected by
   * `state/daemon-control-panel.ts#resolveDaemonControlAvailability` from the SAME
   * `checkLiveLock` the status panel's own daemon section already computes. */
  daemonAvailabilityUpdate: 'seeya:daemon-availability-update',
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
  /** Renderer → main: the ownership-transition dialog's own data (V2-T13 item 5, D-045 item 1) —
   * fetched once at startup, same "no polling of its own" shape `getTerminalFontConfig` already
   * has. `shouldOffer: false` means the dialog never opens this run. */
  getDaemonOwnershipTransitionOffer: 'seeya:get-daemon-ownership-transition-offer',
  /** Renderer → main: the person's answer to the ownership-transition dialog (V2-T13 item 5). */
  answerDaemonOwnershipTransition: 'seeya:answer-daemon-ownership-transition',
} as const;

export interface CreateTabRequest {
  readonly id: string;
  /** Empty string means "the default system shell" (`pty/default-shell.ts`). */
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly cols: number;
  readonly rows: number;
}

export interface CreateTabResponse {
  readonly id: string;
  readonly pid: number;
}

export interface WriteTabRequest {
  readonly id: string;
  readonly data: string;
}

export interface ResizeTabRequest {
  readonly id: string;
  readonly cols: number;
  readonly rows: number;
}

export interface CloseTabRequest {
  readonly id: string;
}

export interface RemoveTabRequest {
  readonly id: string;
}

export interface TabDataEvent {
  readonly id: string;
  readonly data: string;
}

export interface TabExitEvent {
  readonly id: string;
  readonly exitCode: number;
}

export interface SessionsUpdateEvent {
  readonly rows: readonly SidebarRow[];
}

export interface StatusUpdateEvent {
  readonly text: string;
}

/** `getTerminalFontConfig`'s response — the exact shape `state/terminal-font.ts` produces. */
export type TerminalFontConfigResponse = TerminalFontOptions;

/** `CHANNELS.confirmFallbackRequest`'s payload — the exact shape
 * `resume/fallback-confirmer.ts#FallbackConfirmRequestPayload` produces (re-declared here rather
 * than imported, same "ipc/channels.ts is pure, no engine-adjacent app module imports it back"
 * shape every other event type in this file already has — `resume/` imports FROM `ipc/`, never
 * the other way). */
export interface FallbackConfirmRequestEvent {
  readonly requestId: string;
  readonly sessionName: string;
  readonly cwd: string;
  readonly reasonText: string;
  /** V2-T7 item 4: whether the dialog should offer "Resume without the plan" at all — `true` only
   * for a `promptTooLarge` reason (`resume/fallback-confirmer.ts#buildFallbackConfirmer`'s own
   * computation, never re-derived in `renderer.ts`, D-041). `false` for `resumeFailed`: that
   * reason has no free option to fall back to (`core/resume-fallback-decision.ts`'s own
   * docstring). */
  readonly offersResumeWithoutPlan: boolean;
}

/** `CHANNELS.confirmFallbackAnswer`'s payload. `'resumeWithoutPlan'` (V2-T7) is only ever sent for
 * a request whose `offersResumeWithoutPlan` was `true` — `renderer.ts#wireFallbackDialog` hides
 * that button otherwise. */
export interface FallbackConfirmAnswerRequest {
  readonly requestId: string;
  readonly decision: 'open' | 'resumeWithoutPlan' | 'skip';
}

/** `CHANNELS.getTodayPanel`'s response — the exact shape `state/today-panel.ts#buildTodayPanelData`
 * produces. */
export type TodayPanelResponse = TodayPanelData;

/** `CHANNELS.todayUpdate`'s payload (V2-T18 item 2) — the exact same shape as
 * `TodayPanelResponse`, just pushed instead of fetched. */
export type TodayUpdateEvent = TodayPanelData;

/** `CHANNELS.resumeSelected`'s payload. `day` is `core/types.ts`'s `Day` (a plain string,
 * `YYYY-MM-DD`) — not imported from the engine here, same "this file only ever imports app-internal
 * state modules" shape every other type above already keeps (`SidebarRow`/`TerminalFontOptions`/
 * `TodayPanelData`). */
export interface ResumeSelectedRequest {
  readonly day: string;
  readonly sessionIds: readonly string[];
  /**
   * V2-T9 item 2 — the directory chosen in the "Resume in" selector, keyed by `sessionId`, for a
   * session whose row offered one (`state/today-panel.ts#TodaySessionRow.cwdHistory`, more than
   * one directory). A `sessionId` with no entry here had no selector to choose from at all (a
   * single-directory history) — `electron/main.ts`'s own handler falls back to the handoff's own
   * `cwd` for those (D-025: never an invented choice where the interface never offered one). The
   * choice only ever affects THIS resume attempt; nothing is rewritten to disk.
   */
  readonly chosenCwdBySessionId: Readonly<Record<string, string>>;
}

/** One session, named for display — the common shape every `ResumeSummaryResponse` list entry
 * below builds on. */
export interface ResumeSummarySession {
  readonly sessionId: string;
  readonly name: string;
  readonly cwd: string;
}

/** The three `ResumeOutcome` forms (V2-T7, `core/types.ts#ResumeOutcome`'s own docstring),
 * projected for display: `'resumed'` needs no extra text; `'resumedWithoutPlan'`/`'freshSession'`
 * carry the same wording `core/resume-notice.ts#formatResumeNotice` gives the CLI's own summary —
 * computed once, in `state/resume-summary.ts`, never re-derived from the raw `ResumeOutcome` in
 * `electron/renderer.ts` (which has no logic of its own, D-041). A discriminated union rather than
 * a boolean-shaped `fellBack` (D-024, mirroring the engine type it projects). */
export type ResumeSummaryOutcome =
  | (ResumeSummarySession & { readonly kind: 'resumed' })
  | (ResumeSummarySession & { readonly kind: 'resumedWithoutPlan'; readonly noteText: string })
  | (ResumeSummarySession & { readonly kind: 'freshSession'; readonly noteText: string });

export interface ResumeSummarySkipped extends ResumeSummarySession {
  /** The exact same wording `core/resume-notice.ts#describeFallbackReason` gives the CLI. */
  readonly reasonText: string;
}

export interface ResumeSummaryInvalid extends ResumeSummarySession {
  readonly reason: string;
}

/** `CHANNELS.resumeSelected`'s response (V2-T4 item 4) — the full per-session breakdown, same
 * content as `cli/format-start-day.ts#formatStartDaySummary` (resumed, skipped, invalid fallback
 * answers, not-yet-attempted, and where the loop stopped early), rendered by the panel as DOM
 * sections instead of reusing the CLI's plain-text rendering (Q-073's own "only the data crosses
 * the boundary" — V2-T2's criterion for the status panel). Built by
 * `state/resume-summary.ts#buildResumeSummary`. */
export interface ResumeSummaryResponse {
  readonly resumed: readonly ResumeSummaryOutcome[];
  readonly skipped: readonly ResumeSummarySkipped[];
  readonly invalidFallbackAnswers: readonly ResumeSummaryInvalid[];
  readonly remaining: readonly ResumeSummarySession[];
  readonly stoppedEarly:
    { readonly session: ResumeSummarySession; readonly message: string } | false;
}

export interface ResumeProgressUpdateEvent {
  readonly index: number;
  readonly total: number;
  readonly name: string;
}

export interface ResumeTabOpenedEvent {
  readonly id: string;
  readonly label: string;
  readonly cwd: string;
  readonly pid: number;
}

/** `CHANNELS.endDayPreview`'s response (V2-T5a item 1). `reportText` is the literal
 * `formatEndDayReport` output for a `dryRun: true` run — same content `seeya end-day --dry-run`
 * prints. `costCeiling` is `state/end-day-preview.ts#EndDayCostCeiling`, re-declared here rather
 * than imported (same "ipc/channels.ts is pure, no engine-adjacent app module imports it back"
 * shape `ResumeSummaryResponse` above already has for its own list entries). */
export interface EndDayPreviewResponse {
  readonly reportText: string;
  readonly costCeiling: {
    readonly sessionsInScope: number;
    readonly budgetPerSessionUsd: number;
    readonly captureModel: string;
    readonly totalCeilingUsd: number;
  };
}

/** `CHANNELS.endDayRun`'s response (V2-T5a item 4) — the literal `formatEndDayReport` output for
 * the real run, same content `seeya end-day` prints. */
export interface EndDayRunResponse {
  readonly reportText: string;
}

/** `CHANNELS.endDayProgress`'s payload — mirrors `ResumeProgressUpdateEvent` above exactly (same
 * "N of M: name" shape), projected from `application/end-day.ts`'s own `CaptureProgressEvent` by
 * `state/end-day-progress.ts#projectEndDayProgressEvent`. */
export interface EndDayProgressUpdateEvent {
  readonly index: number;
  readonly total: number;
  readonly name: string;
}

/** `CHANNELS.scheduleUpdate`'s payload and `CHANNELS.snoozeToday`/`CHANNELS.skipToday`'s response
 * — the exact shape `state/schedule-strip.ts#buildScheduleStripData` produces (V2-T5b item 1). */
export type ScheduleUpdateEvent = ScheduleStripData;

/** `CHANNELS.snoozeToday`'s payload — D-006's three named increments
 * (`@seeya-ai/engine/application/schedule-adjustments.js#SNOOZE_INCREMENTS`'s own values), never a
 * free-form number: the faixa only ever offers these three buttons. */
export interface SnoozeTodayRequest {
  readonly minutes: 15 | 30 | 60;
}

/** `CHANNELS.daemonAvailabilityUpdate`'s payload — the exact shape
 * `state/daemon-control-panel.ts#resolveDaemonControlAvailability` produces. */
export type DaemonAvailabilityUpdateEvent = DaemonControlAvailability;

/** `CHANNELS.daemonControl`'s payload. `action` is `'start'` when the button last showed "Start
 * daemon", `'stop'` otherwise — decided renderer-side from its own `DaemonControlAvailability`
 * (never re-derived by `electron/main.ts`, which has no logic of its own, D-041). */
export interface DaemonControlRequest {
  readonly action: 'start' | 'stop';
}

/** `CHANNELS.daemonControl`'s response — the literal text `AppContext#startDaemon`/`#stopDaemon`
 * already produces (D-039: the same text the CLI would print for the equivalent action).
 *
 * **`availability` (V2-T21 item 1).** The recomputed `DaemonControlAvailability`, from a fresh
 * `checkLiveLock` the handler runs right after the action — never the request's own `action`
 * flipped by hand, and never left for the next ambient tick to supply. Same "the action's own
 * response carries the state that follows from it" rule `snoozeToday`/`skipToday` already follow
 * for the faixa de horário (V2-T5b). */
export interface DaemonControlResponse {
  readonly resultText: string;
  readonly availability: DaemonControlAvailability;
}

/** `CHANNELS.getSettingsPanel`'s response (V2-T14 item 1) — `rows` is
 * `state/settings-panel.ts#buildSettingsRows`'s own output; `projectPolicyLines` is
 * `buildProjectPolicyLines`'s own output, shown read-only (the plan entry's own "o que não
 * entra": `projectPolicy` isn't scalar, so it never gets an editable row). */
export interface SettingsPanelResponse {
  readonly rows: readonly SettingsRow[];
  readonly projectPolicyLines: readonly ProjectPolicyLine[];
}

/** `CHANNELS.saveSetting`'s payload (V2-T14 item 2). `key`/`rawValue` are untyped strings, not
 * `EditableConfigKey` — the renderer only ever offers one of the sixteen rows it was just handed,
 * but the SAME validation the CLI's `seeya config set` runs
 * (`parseConfigFieldUpdate`/`applyConfigFieldUpdate`) is what decides whether a key/value is
 * accepted, in `electron/main.ts`'s own handler — never a second, renderer-side check of its own. */
export interface SaveSettingRequest {
  readonly key: string;
  readonly rawValue: string;
}

/** `CHANNELS.saveSetting`'s response — a discriminated union (D-024, "nada achatado"): a rejected
 * value carries `error` (`parseConfigFieldUpdate`'s own message, AGENTS.md § "Mensagens de erro" —
 * the raw value and the expected shape) and nothing else, never a half-updated `rows`/`schedule`
 * next to it. A saved value carries the freshly re-read `rows` (so every row's own `origin` stays
 * correct, not just the one that changed) and the freshly recomputed `schedule` (V2-T14 item 3 —
 * the faixa de horário updates immediately, without waiting for the next ambient refresh tick). */
export type SaveSettingResponse =
  | {
      readonly ok: true;
      readonly rows: readonly SettingsRow[];
      readonly schedule: ScheduleStripData;
    }
  | { readonly ok: false; readonly error: string };

/** `CHANNELS.autostartAvailabilityUpdate`'s payload — the exact shape
 * `state/autostart-control-panel.ts#resolveAutostartControlAvailability` produces (V2-T13 item 4). */
export type AutostartAvailabilityUpdateEvent = AutostartControlAvailability;

/** `CHANNELS.autostartControl`'s payload. `action` is `'enable'` when the button last showed
 * "Enable autostart", `'disable'` otherwise — decided renderer-side from its own
 * `AutostartControlAvailability` (never re-derived by `electron/main.ts`, D-041). */
export interface AutostartControlRequest {
  readonly action: 'enable' | 'disable';
}

/** `CHANNELS.autostartControl`'s response — the literal text
 * `cli/autostart-command.ts#runAutostartEnableCommand`/`runAutostartDisableCommand` already
 * produces for the equivalent CLI action (D-039), rendered by `AppContext.enableAppAutostart`/
 * `context.autostart.disable` through the same wording.
 *
 * **`availability` (V2-T21 item 1).** The recomputed `AutostartControlAvailability`, from a fresh
 * `Autostart.status()` the handler forces right after the action (also refreshing
 * `state/autostart-cache.ts`'s own 60s cache — otherwise the next ambient tick would still hand
 * back the pre-click value). The measured defect this fixes: without this, the button stayed
 * mislabeled for up to a minute AND a click in that window sent the stale action ("Autostart was
 * already disabled. Nothing changed."). */
export interface AutostartControlResponse {
  readonly resultText: string;
  readonly availability: AutostartControlAvailability;
}

/** `CHANNELS.getDaemonOwnershipTransitionOffer`'s response (V2-T13 item 5, D-045 item 1).
 * `launchPath` is only meaningful when `shouldOffer` is `true` (the app's own installed path,
 * shown in the dialog's body) — empty string otherwise, never read by the renderer in that case. */
export interface DaemonOwnershipTransitionOfferResponse {
  readonly shouldOffer: boolean;
  readonly launchPath: string;
}

/** `CHANNELS.answerDaemonOwnershipTransition`'s payload (V2-T13 item 5). */
export interface AnswerDaemonOwnershipTransitionRequest {
  readonly answer: 'accepted' | 'declined';
}
