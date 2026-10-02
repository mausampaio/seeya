/**
 * The preload script (`contextIsolation: true`, `sandbox: true` — `main.ts`'s own
 * `BrowserWindow` options): the only bridge between the isolated renderer and the main process.
 * Exposes exactly what the renderer needs (docs/PLANO-DE-ENTREGA.md V2-T2, item 1: "o preload
 * expõe só o que o renderer precisa") — never `require`, never raw `ipcRenderer`, never
 * `process` (spike M's own "Correção depois do spike": `process.platform` doesn't exist in the
 * renderer with `contextIsolation` on — this is the fix, not a workaround inside the renderer).
 */
import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';
import { CHANNELS } from '../ipc/channels.js';
import type {
  CreateTabRequest,
  CreateTabResponse,
  ResizeTabRequest,
  CloseTabRequest,
  RemoveTabRequest,
  WriteTabRequest,
  TabDataEvent,
  TabExitEvent,
  SessionsUpdateEvent,
  StatusUpdateEvent,
  TerminalFontConfigResponse,
  FallbackConfirmRequestEvent,
  FallbackConfirmAnswerRequest,
  TodayPanelResponse,
  TodayUpdateEvent,
  ResumeSelectedRequest,
  ResumeSummaryResponse,
  ResumeProgressUpdateEvent,
  ResumeTabOpenedEvent,
  EndDayPreviewResponse,
  EndDayRunResponse,
  EndDayProgressUpdateEvent,
  ScheduleUpdateEvent,
  ScheduleStripResponse,
  SnoozeTodayRequest,
  DaemonAvailabilityUpdateEvent,
  DaemonAvailabilityResponse,
  DaemonControlRequest,
  DaemonControlResponse,
  SettingsPanelResponse,
  SaveSettingRequest,
  SaveSettingResponse,
  AutostartAvailabilityUpdateEvent,
  AutostartAvailabilityResponse,
  AutostartControlRequest,
  AutostartControlResponse,
  DaemonOwnershipTransitionOfferResponse,
  AnswerDaemonOwnershipTransitionRequest,
  ProjectsUpdateEvent,
  ProjectsPanelResponse,
  CreateProjectRequest,
  CreateProjectResponse,
  OpenProjectRequest,
  OpenProjectResponse,
  ResumeProjectSessionRequest,
  ResumeProjectSessionResponse,
  ConfirmProjectLockOpenRequestEvent,
  AnswerProjectLockOpenConfirmRequest,
  ConfirmLeftoverChangesOpenRequestEvent,
  AnswerLeftoverChangesOpenConfirmRequest,
  AdoptSessionRequest,
  AdoptSessionResponse,
  PreviewAdoptionLaunchRequest,
  PreviewAdoptionLaunchResponse,
  ConfirmAdoptionCommitRequestEvent,
  AnswerAdoptionCommitConfirmRequest,
  FindSessionByIdRequest,
  FindSessionByIdResponse,
  ThemeUpdateEvent,
  ToggleFavoriteProjectRequest,
  PickDirectoryResponse,
  ResumeSessionRequest,
  ResumeSessionResponse,
} from '../ipc/channels.js';

export interface SeeyaApi {
  readonly platform: NodeJS.Platform;
  createTab(request: CreateTabRequest): Promise<CreateTabResponse>;
  writeTab(request: WriteTabRequest): void;
  resizeTab(request: ResizeTabRequest): void;
  closeTab(request: CloseTabRequest): void;
  /** V2-T3 review: `electron/renderer.ts#removeTabUi` calls this AFTER its own DOM cleanup, for a
   * tab whose process has already exited — see `CHANNELS.removeTab`'s own docstring for why. */
  removeTab(request: RemoveTabRequest): void;
  /** V2-T3: fetched once, at renderer startup, before any tab's `new Terminal({...})` is
   * constructed (`electron/renderer.ts`'s own `main`). */
  getTerminalFontConfig(): Promise<TerminalFontConfigResponse>;
  onTabData(listener: (event: TabDataEvent) => void): void;
  onTabExit(listener: (event: TabExitEvent) => void): void;
  onSessionsUpdate(listener: (event: SessionsUpdateEvent) => void): void;
  onStatusUpdate(listener: (event: StatusUpdateEvent) => void): void;
  /** V2-T4 item 3: one fallback question at a time — `electron/renderer.ts` shows the dialog and
   * answers via `answerFallbackConfirm` below. */
  onConfirmFallbackRequest(listener: (event: FallbackConfirmRequestEvent) => void): void;
  answerFallbackConfirm(request: FallbackConfirmAnswerRequest): void;
  /** V2-T4 item 1: the "Today" panel's own data. */
  getTodayPanel(): Promise<TodayPanelResponse>;
  /** V2-T18 item 2: the panel's own data, pushed on the same refresh tick as `onSessionsUpdate` —
   * the panel tracks liveness without a page reload. D-052 (V2-T75): unsubscribe function, same
   * reasoning as `onProjectsUpdate` above. */
  onTodayUpdate(listener: (event: TodayUpdateEvent) => void): () => void;
  /** V2-T4 items 1/2/3: "Resume selected". */
  resumeSelected(request: ResumeSelectedRequest): Promise<ResumeSummaryResponse>;
  onResumeProgress(listener: (event: ResumeProgressUpdateEvent) => void): void;
  /** V2-T4 item 2: a tab the resumer opened — `electron/renderer.ts` creates the same
   * `@xterm/xterm` instance/tab-strip button `openTab` creates for a command-bar tab, without
   * calling back to spawn anything (the pty already exists). */
  onResumeTabOpened(listener: (event: ResumeTabOpenedEvent) => void): void;
  /** V2-T5a item 1: "End day…" — the dry-run preview, never writes or terminates anything. */
  endDayPreview(): Promise<EndDayPreviewResponse>;
  /** V2-T5a item 4: "Run end-day now" — the real run. */
  endDayRun(): Promise<EndDayRunResponse>;
  onEndDayProgress(listener: (event: EndDayProgressUpdateEvent) => void): void;
  /** V2-T5b item 1: the faixa de horário's own data, pushed on the same refresh tick as
   * `onStatusUpdate`. D-052 (V2-T75): unsubscribe function, same reasoning as `onProjectsUpdate`
   * above. */
  onScheduleUpdate(listener: (event: ScheduleUpdateEvent) => void): () => void;
  /** V2-T75 PO review (round 3): fetched once, at startup — see `CHANNELS.getScheduleStrip`'s own
   * docstring. */
  getScheduleStrip(): Promise<ScheduleStripResponse>;
  /** V2-T5b item 1: one of "Snooze +15m/+30m/+1h" — resolves with the freshly recomputed strip. */
  snoozeToday(request: SnoozeTodayRequest): Promise<ScheduleUpdateEvent>;
  /** V2-T5b item 1: "Skip today" — resolves with the freshly recomputed strip. */
  skipToday(): Promise<ScheduleUpdateEvent>;
  /** V2-T50: "Undo snooze" — resolves with the freshly recomputed strip. */
  undoSnoozeToday(): Promise<ScheduleUpdateEvent>;
  /** V2-T5b item 3: the daemon's own liveness, pushed on the same refresh tick. D-052 (V2-T75):
   * unsubscribe function, same reasoning as `onProjectsUpdate` above. */
  onDaemonAvailabilityUpdate(listener: (event: DaemonAvailabilityUpdateEvent) => void): () => void;
  /** V2-T75 PO review (round 3): fetched once, at startup — see
   * `CHANNELS.getDaemonAvailability`'s own docstring. */
  getDaemonAvailability(): Promise<DaemonAvailabilityResponse>;
  /** V2-T5b item 3: "Start daemon"/"Stop daemon". */
  daemonControl(request: DaemonControlRequest): Promise<DaemonControlResponse>;
  /** V2-T14 item 1: the Settings dialog's own rows, re-fetched every time it opens. */
  getSettingsPanel(): Promise<SettingsPanelResponse>;
  /** V2-T14 items 2/3: one field's edit — resolves with the updated rows and the freshly
   * recomputed faixa de horário on success, or the refusal message on failure. */
  saveSetting(request: SaveSettingRequest): Promise<SaveSettingResponse>;
  /** V2-T13 item 4: the autostart button's own liveness, pushed on the same refresh tick as
   * `onDaemonAvailabilityUpdate`. D-052 (V2-T75): unsubscribe function, same reasoning as
   * `onProjectsUpdate` above. */
  onAutostartAvailabilityUpdate(
    listener: (event: AutostartAvailabilityUpdateEvent) => void,
  ): () => void;
  /** V2-T13 item 4: "Enable autostart"/"Disable autostart". */
  autostartControl(request: AutostartControlRequest): Promise<AutostartControlResponse>;
  /** V2-T65: Settings' own General section — fetched once when it mounts, see
   * `CHANNELS.getAutostartAvailability`'s own docstring. */
  getAutostartAvailability(): Promise<AutostartAvailabilityResponse>;
  /** V2-T13 item 5: the ownership-transition dialog's own data, fetched once at startup. */
  getDaemonOwnershipTransitionOffer(): Promise<DaemonOwnershipTransitionOfferResponse>;
  /** V2-T13 item 5: the person's answer to the ownership-transition dialog. */
  answerDaemonOwnershipTransition(request: AnswerDaemonOwnershipTransitionRequest): Promise<void>;
  /** V2-T30 item 1: the "Projects" section's own data, pushed on the same refresh tick as
   * `onSessionsUpdate` and again right after "New project…"/"Open"/"Adopt…" finish.
   * D-052 (V2-T75): returns an unsubscribe function — `renderer/hooks/useIpcSubscription.ts`'s
   * own contract ("com limpeza no desmonte") needs one; every OTHER `onXUpdate` below still
   * returns `void` (unchanged, still no way to remove that listener) because nothing outside the
   * new Sidebar feature needs to unsubscribe yet — widening this return type is backward
   * compatible (every existing caller already ignores the return value), so only the six
   * channels the Sidebar actually subscribes to changed. */
  onProjectsUpdate(listener: (event: ProjectsUpdateEvent) => void): () => void;
  /** V2-T30 item 1: fetched once, at startup — see `CHANNELS.getProjectsPanel`'s own docstring. */
  getProjectsPanel(): Promise<ProjectsPanelResponse>;
  /** V2-T30 item 4: "New project…". */
  createProject(request: CreateProjectRequest): Promise<CreateProjectResponse>;
  /** V2-T30 item 3: a project's "Open" button — resolves only once the tab closes. */
  openProject(request: OpenProjectRequest): Promise<OpenProjectResponse>;
  /** V2-T77: `Resume` on a project's own session, through the `open` pipeline. */
  resumeProjectSession(request: ResumeProjectSessionRequest): Promise<ResumeProjectSessionResponse>;
  /** V2-T30 item 3: the project is locked by another live session — one question at a time. */
  onConfirmProjectLockOpenRequest(
    listener: (event: ConfirmProjectLockOpenRequestEvent) => void,
  ): void;
  answerProjectLockOpenConfirm(request: AnswerProjectLockOpenConfirmRequest): void;
  /** V2-T34 production defect (PO review, 2026-09-25): a previous session left uncommitted
   * changes, and THIS `open` took the lock — one question at a time, same shape as the lock
   * confirmation above. */
  onConfirmLeftoverChangesOpenRequest(
    listener: (event: ConfirmLeftoverChangesOpenRequestEvent) => void,
  ): void;
  answerLeftoverChangesOpenConfirm(request: AnswerLeftoverChangesOpenConfirmRequest): void;
  /** V2-T30 item 5: "Adopt…" on an "Other sessions" row — resolves only once the fork's tab closes
   * and the commit question (if any) has been answered. */
  adoptSession(request: AdoptSessionRequest): Promise<AdoptSessionResponse>;
  /** V2-T70: the single adoption dialog's own live preview — see `ipc/channels.ts
   * #CHANNELS.previewAdoptionLaunch`'s own docstring for why this replaced a confirmation round
   * trip. */
  previewAdoptionLaunch(
    request: PreviewAdoptionLaunchRequest,
  ): Promise<PreviewAdoptionLaunchResponse>;
  onConfirmAdoptionCommitRequest(
    listener: (event: ConfirmAdoptionCommitRequestEvent) => void,
  ): void;
  answerAdoptionCommitConfirm(request: AnswerAdoptionCommitConfirmRequest): void;
  /** V2-T55 item 4: the id-search field — an id or the start of it, straight to the session, even
   * outside the 12-hour window. */
  findSessionById(request: FindSessionByIdRequest): Promise<FindSessionByIdResponse>;
  /** V2-T62 (D-051): the window's effective theme, fetched once at startup — same "invoke, not
   * send" round trip as `getTerminalFontConfig`. */
  getEffectiveTheme(): Promise<ThemeUpdateEvent>;
  /** V2-T62 (D-051): pushed whenever the OS's own light/dark preference changes (never on a
   * fixed interval — `main/main.ts`'s own `nativeTheme.on('updated', ...)` subscription). D-052
   * (V2-T75): unsubscribe function, same reasoning as `onProjectsUpdate` above. */
  onThemeUpdate(listener: (event: ThemeUpdateEvent) => void): () => void;
  /** V2-T63: the star, from either the lateral or the Projects tab — resolves once saved and
   * pushed. */
  toggleFavoriteProject(request: ToggleFavoriteProjectRequest): Promise<void>;
  /** V2-T64: the New tab popover's "Browse…" button — the native OS folder picker, run in the
   * main process (`main/directory-picker-ipc.ts`). */
  pickDirectory(): Promise<PickDirectoryResponse>;
  /** V2-T65: Settings' own General section — `app.getVersion()`, fetched once when it mounts. */
  getAppVersion(): Promise<string>;
  /** V2-T66 PO review, item 2: this window's own effective home directory (`AppContext.homeDir`),
   * fetched once — used to abbreviate a `cwd` as `~` for display
   * (`sidebar/directory-label.ts#collapseHomeDirectory`), never to resolve a real path. */
  getHomeDir(): Promise<string>;
  /** V2-T68: the Sessions tab's own `Resume` button — a session with no process and no project,
   * resumed in a tab (`docs/INTERFACE.md` § 5). Resolves once the fast-failure race settles, a
   * few seconds at most (`main/session-resume-ipc.ts`'s own docstring). */
  resumeSession(request: ResumeSessionRequest): Promise<ResumeSessionResponse>;
}

/**
 * D-052 (V2-T75): the one place that both registers an `ipcRenderer.on` listener and hands back a
 * real remover for it — `ipcRenderer.removeListener` needs the SAME wrapper function reference
 * `.on` was given, so this closes over it instead of every call site re-deriving its own. Used
 * only by the six `onXUpdate` methods `renderer/hooks/useIpcSubscription.ts` subscribes through;
 * every other `on*` method below keeps its own inline `ipcRenderer.on` call, unchanged.
 */
function subscribe<T>(channel: string, listener: (event: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, data: T): void => listener(data);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

const api: SeeyaApi = {
  // spike M's "Correção depois do spike": process.platform doesn't exist in an isolated
  // renderer. process.platform DOES exist here, in the preload's own (Node-enabled) context —
  // reading it once and exposing the value is the fix, not `process.platform` used in the
  // renderer directly.
  platform: process.platform,
  createTab: (request) => ipcRenderer.invoke(CHANNELS.createTab, request),
  writeTab: (request) => ipcRenderer.send(CHANNELS.writeTab, request),
  resizeTab: (request) => ipcRenderer.send(CHANNELS.resizeTab, request),
  closeTab: (request) => ipcRenderer.send(CHANNELS.closeTab, request),
  removeTab: (request) => ipcRenderer.send(CHANNELS.removeTab, request),
  getTerminalFontConfig: () => ipcRenderer.invoke(CHANNELS.getTerminalFontConfig),
  onTabData: (listener) => {
    ipcRenderer.on(CHANNELS.tabData, (_event, data: TabDataEvent) => listener(data));
  },
  onTabExit: (listener) => {
    ipcRenderer.on(CHANNELS.tabExit, (_event, data: TabExitEvent) => listener(data));
  },
  onSessionsUpdate: (listener) => {
    ipcRenderer.on(CHANNELS.sessionsUpdate, (_event, data: SessionsUpdateEvent) => listener(data));
  },
  onStatusUpdate: (listener) => {
    ipcRenderer.on(CHANNELS.statusUpdate, (_event, data: StatusUpdateEvent) => listener(data));
  },
  onConfirmFallbackRequest: (listener) => {
    ipcRenderer.on(CHANNELS.confirmFallbackRequest, (_event, data: FallbackConfirmRequestEvent) =>
      listener(data),
    );
  },
  answerFallbackConfirm: (request) => ipcRenderer.send(CHANNELS.confirmFallbackAnswer, request),
  getTodayPanel: () => ipcRenderer.invoke(CHANNELS.getTodayPanel),
  onTodayUpdate: (listener) => subscribe(CHANNELS.todayUpdate, listener),
  resumeSelected: (request) => ipcRenderer.invoke(CHANNELS.resumeSelected, request),
  onResumeProgress: (listener) => {
    ipcRenderer.on(CHANNELS.resumeProgress, (_event, data: ResumeProgressUpdateEvent) =>
      listener(data),
    );
  },
  onResumeTabOpened: (listener) => {
    ipcRenderer.on(CHANNELS.resumeTabOpened, (_event, data: ResumeTabOpenedEvent) =>
      listener(data),
    );
  },
  endDayPreview: () => ipcRenderer.invoke(CHANNELS.endDayPreview),
  endDayRun: () => ipcRenderer.invoke(CHANNELS.endDayRun),
  onEndDayProgress: (listener) => {
    ipcRenderer.on(CHANNELS.endDayProgress, (_event, data: EndDayProgressUpdateEvent) =>
      listener(data),
    );
  },
  onScheduleUpdate: (listener) => subscribe(CHANNELS.scheduleUpdate, listener),
  getScheduleStrip: () => ipcRenderer.invoke(CHANNELS.getScheduleStrip),
  snoozeToday: (request) => ipcRenderer.invoke(CHANNELS.snoozeToday, request),
  skipToday: () => ipcRenderer.invoke(CHANNELS.skipToday),
  undoSnoozeToday: () => ipcRenderer.invoke(CHANNELS.undoSnoozeToday),
  onDaemonAvailabilityUpdate: (listener) => subscribe(CHANNELS.daemonAvailabilityUpdate, listener),
  getDaemonAvailability: () => ipcRenderer.invoke(CHANNELS.getDaemonAvailability),
  daemonControl: (request) => ipcRenderer.invoke(CHANNELS.daemonControl, request),
  getSettingsPanel: () => ipcRenderer.invoke(CHANNELS.getSettingsPanel),
  saveSetting: (request) => ipcRenderer.invoke(CHANNELS.saveSetting, request),
  onAutostartAvailabilityUpdate: (listener) =>
    subscribe(CHANNELS.autostartAvailabilityUpdate, listener),
  autostartControl: (request) => ipcRenderer.invoke(CHANNELS.autostartControl, request),
  getAutostartAvailability: () => ipcRenderer.invoke(CHANNELS.getAutostartAvailability),
  getDaemonOwnershipTransitionOffer: () =>
    ipcRenderer.invoke(CHANNELS.getDaemonOwnershipTransitionOffer),
  answerDaemonOwnershipTransition: (request) =>
    ipcRenderer.invoke(CHANNELS.answerDaemonOwnershipTransition, request),
  onProjectsUpdate: (listener) => subscribe(CHANNELS.projectsUpdate, listener),
  getProjectsPanel: () => ipcRenderer.invoke(CHANNELS.getProjectsPanel),
  createProject: (request) => ipcRenderer.invoke(CHANNELS.createProject, request),
  openProject: (request) => ipcRenderer.invoke(CHANNELS.openProject, request),
  resumeProjectSession: (request) => ipcRenderer.invoke(CHANNELS.resumeProjectSession, request),
  onConfirmProjectLockOpenRequest: (listener) => {
    ipcRenderer.on(
      CHANNELS.confirmProjectLockOpenRequest,
      (_event, data: ConfirmProjectLockOpenRequestEvent) => listener(data),
    );
  },
  answerProjectLockOpenConfirm: (request) =>
    ipcRenderer.send(CHANNELS.answerProjectLockOpenConfirm, request),
  onConfirmLeftoverChangesOpenRequest: (listener) => {
    ipcRenderer.on(
      CHANNELS.confirmLeftoverChangesOpenRequest,
      (_event, data: ConfirmLeftoverChangesOpenRequestEvent) => listener(data),
    );
  },
  answerLeftoverChangesOpenConfirm: (request) =>
    ipcRenderer.send(CHANNELS.answerLeftoverChangesOpenConfirm, request),
  adoptSession: (request) => ipcRenderer.invoke(CHANNELS.adoptSession, request),
  previewAdoptionLaunch: (request) => ipcRenderer.invoke(CHANNELS.previewAdoptionLaunch, request),
  onConfirmAdoptionCommitRequest: (listener) => {
    ipcRenderer.on(
      CHANNELS.confirmAdoptionCommitRequest,
      (_event, data: ConfirmAdoptionCommitRequestEvent) => listener(data),
    );
  },
  answerAdoptionCommitConfirm: (request) =>
    ipcRenderer.send(CHANNELS.answerAdoptionCommitConfirm, request),
  findSessionById: (request) => ipcRenderer.invoke(CHANNELS.findSessionById, request),
  getEffectiveTheme: () => ipcRenderer.invoke(CHANNELS.getEffectiveTheme),
  onThemeUpdate: (listener) => subscribe(CHANNELS.themeUpdate, listener),
  toggleFavoriteProject: (request) => ipcRenderer.invoke(CHANNELS.toggleFavoriteProject, request),
  pickDirectory: () => ipcRenderer.invoke(CHANNELS.pickDirectory),
  getAppVersion: () => ipcRenderer.invoke(CHANNELS.getAppVersion),
  getHomeDir: () => ipcRenderer.invoke(CHANNELS.getHomeDir),
  resumeSession: (request) => ipcRenderer.invoke(CHANNELS.resumeSession, request),
};

contextBridge.exposeInMainWorld('seeya', api);
