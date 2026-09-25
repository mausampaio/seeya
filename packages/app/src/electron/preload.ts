/**
 * The preload script (`contextIsolation: true`, `sandbox: true` — `main.ts`'s own
 * `BrowserWindow` options): the only bridge between the isolated renderer and the main process.
 * Exposes exactly what the renderer needs (docs/PLANO-DE-ENTREGA.md V2-T2, item 1: "o preload
 * expõe só o que o renderer precisa") — never `require`, never raw `ipcRenderer`, never
 * `process` (spike M's own "Correção depois do spike": `process.platform` doesn't exist in the
 * renderer with `contextIsolation` on — this is the fix, not a workaround inside the renderer).
 */
import { contextBridge, ipcRenderer } from 'electron';
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
  SnoozeTodayRequest,
  DaemonAvailabilityUpdateEvent,
  DaemonControlRequest,
  DaemonControlResponse,
  SettingsPanelResponse,
  SaveSettingRequest,
  SaveSettingResponse,
  AutostartAvailabilityUpdateEvent,
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
  ConfirmProjectLockOpenRequestEvent,
  AnswerProjectLockOpenConfirmRequest,
  AdoptSessionRequest,
  AdoptSessionResponse,
  ConfirmAdoptionLaunchRequestEvent,
  AnswerAdoptionLaunchConfirmRequest,
  ConfirmAdoptionCommitRequestEvent,
  AnswerAdoptionCommitConfirmRequest,
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
   * the panel tracks liveness without a page reload. */
  onTodayUpdate(listener: (event: TodayUpdateEvent) => void): void;
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
   * `onStatusUpdate`. */
  onScheduleUpdate(listener: (event: ScheduleUpdateEvent) => void): void;
  /** V2-T5b item 1: one of "Snooze +15m/+30m/+1h" — resolves with the freshly recomputed strip. */
  snoozeToday(request: SnoozeTodayRequest): Promise<ScheduleUpdateEvent>;
  /** V2-T5b item 1: "Skip today" — resolves with the freshly recomputed strip. */
  skipToday(): Promise<ScheduleUpdateEvent>;
  /** V2-T5b item 3: the daemon's own liveness, pushed on the same refresh tick. */
  onDaemonAvailabilityUpdate(listener: (event: DaemonAvailabilityUpdateEvent) => void): void;
  /** V2-T5b item 3: "Start daemon"/"Stop daemon". */
  daemonControl(request: DaemonControlRequest): Promise<DaemonControlResponse>;
  /** V2-T14 item 1: the Settings dialog's own rows, re-fetched every time it opens. */
  getSettingsPanel(): Promise<SettingsPanelResponse>;
  /** V2-T14 items 2/3: one field's edit — resolves with the updated rows and the freshly
   * recomputed faixa de horário on success, or the refusal message on failure. */
  saveSetting(request: SaveSettingRequest): Promise<SaveSettingResponse>;
  /** V2-T13 item 4: the autostart button's own liveness, pushed on the same refresh tick as
   * `onDaemonAvailabilityUpdate`. */
  onAutostartAvailabilityUpdate(listener: (event: AutostartAvailabilityUpdateEvent) => void): void;
  /** V2-T13 item 4: "Enable autostart"/"Disable autostart". */
  autostartControl(request: AutostartControlRequest): Promise<AutostartControlResponse>;
  /** V2-T13 item 5: the ownership-transition dialog's own data, fetched once at startup. */
  getDaemonOwnershipTransitionOffer(): Promise<DaemonOwnershipTransitionOfferResponse>;
  /** V2-T13 item 5: the person's answer to the ownership-transition dialog. */
  answerDaemonOwnershipTransition(request: AnswerDaemonOwnershipTransitionRequest): Promise<void>;
  /** V2-T30 item 1: the "Projects" section's own data, pushed on the same refresh tick as
   * `onSessionsUpdate` and again right after "New project…"/"Open"/"Adopt…" finish. */
  onProjectsUpdate(listener: (event: ProjectsUpdateEvent) => void): void;
  /** V2-T30 item 1: fetched once, at startup — see `CHANNELS.getProjectsPanel`'s own docstring. */
  getProjectsPanel(): Promise<ProjectsPanelResponse>;
  /** V2-T30 item 4: "New project…". */
  createProject(request: CreateProjectRequest): Promise<CreateProjectResponse>;
  /** V2-T30 item 3: a project's "Open" button — resolves only once the tab closes. */
  openProject(request: OpenProjectRequest): Promise<OpenProjectResponse>;
  /** V2-T30 item 3: the project is locked by another live session — one question at a time. */
  onConfirmProjectLockOpenRequest(
    listener: (event: ConfirmProjectLockOpenRequestEvent) => void,
  ): void;
  answerProjectLockOpenConfirm(request: AnswerProjectLockOpenConfirmRequest): void;
  /** V2-T30 item 5: "Adopt…" on an "Other sessions" row — resolves only once the fork's tab closes
   * and the commit question (if any) has been answered. */
  adoptSession(request: AdoptSessionRequest): Promise<AdoptSessionResponse>;
  onConfirmAdoptionLaunchRequest(
    listener: (event: ConfirmAdoptionLaunchRequestEvent) => void,
  ): void;
  answerAdoptionLaunchConfirm(request: AnswerAdoptionLaunchConfirmRequest): void;
  onConfirmAdoptionCommitRequest(
    listener: (event: ConfirmAdoptionCommitRequestEvent) => void,
  ): void;
  answerAdoptionCommitConfirm(request: AnswerAdoptionCommitConfirmRequest): void;
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
  onTodayUpdate: (listener) => {
    ipcRenderer.on(CHANNELS.todayUpdate, (_event, data: TodayUpdateEvent) => listener(data));
  },
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
  onScheduleUpdate: (listener) => {
    ipcRenderer.on(CHANNELS.scheduleUpdate, (_event, data: ScheduleUpdateEvent) => listener(data));
  },
  snoozeToday: (request) => ipcRenderer.invoke(CHANNELS.snoozeToday, request),
  skipToday: () => ipcRenderer.invoke(CHANNELS.skipToday),
  onDaemonAvailabilityUpdate: (listener) => {
    ipcRenderer.on(
      CHANNELS.daemonAvailabilityUpdate,
      (_event, data: DaemonAvailabilityUpdateEvent) => listener(data),
    );
  },
  daemonControl: (request) => ipcRenderer.invoke(CHANNELS.daemonControl, request),
  getSettingsPanel: () => ipcRenderer.invoke(CHANNELS.getSettingsPanel),
  saveSetting: (request) => ipcRenderer.invoke(CHANNELS.saveSetting, request),
  onAutostartAvailabilityUpdate: (listener) => {
    ipcRenderer.on(
      CHANNELS.autostartAvailabilityUpdate,
      (_event, data: AutostartAvailabilityUpdateEvent) => listener(data),
    );
  },
  autostartControl: (request) => ipcRenderer.invoke(CHANNELS.autostartControl, request),
  getDaemonOwnershipTransitionOffer: () =>
    ipcRenderer.invoke(CHANNELS.getDaemonOwnershipTransitionOffer),
  answerDaemonOwnershipTransition: (request) =>
    ipcRenderer.invoke(CHANNELS.answerDaemonOwnershipTransition, request),
  onProjectsUpdate: (listener) => {
    ipcRenderer.on(CHANNELS.projectsUpdate, (_event, data: ProjectsUpdateEvent) => listener(data));
  },
  getProjectsPanel: () => ipcRenderer.invoke(CHANNELS.getProjectsPanel),
  createProject: (request) => ipcRenderer.invoke(CHANNELS.createProject, request),
  openProject: (request) => ipcRenderer.invoke(CHANNELS.openProject, request),
  onConfirmProjectLockOpenRequest: (listener) => {
    ipcRenderer.on(
      CHANNELS.confirmProjectLockOpenRequest,
      (_event, data: ConfirmProjectLockOpenRequestEvent) => listener(data),
    );
  },
  answerProjectLockOpenConfirm: (request) =>
    ipcRenderer.send(CHANNELS.answerProjectLockOpenConfirm, request),
  adoptSession: (request) => ipcRenderer.invoke(CHANNELS.adoptSession, request),
  onConfirmAdoptionLaunchRequest: (listener) => {
    ipcRenderer.on(
      CHANNELS.confirmAdoptionLaunchRequest,
      (_event, data: ConfirmAdoptionLaunchRequestEvent) => listener(data),
    );
  },
  answerAdoptionLaunchConfirm: (request) =>
    ipcRenderer.send(CHANNELS.answerAdoptionLaunchConfirm, request),
  onConfirmAdoptionCommitRequest: (listener) => {
    ipcRenderer.on(
      CHANNELS.confirmAdoptionCommitRequest,
      (_event, data: ConfirmAdoptionCommitRequestEvent) => listener(data),
    );
  },
  answerAdoptionCommitConfirm: (request) =>
    ipcRenderer.send(CHANNELS.answerAdoptionCommitConfirm, request),
};

contextBridge.exposeInMainWorld('seeya', api);
