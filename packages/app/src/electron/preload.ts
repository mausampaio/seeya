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
  ResumeSelectedRequest,
  ResumeSummaryResponse,
  ResumeProgressUpdateEvent,
  ResumeTabOpenedEvent,
  EndDayPreviewResponse,
  EndDayRunResponse,
  EndDayProgressUpdateEvent,
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
};

contextBridge.exposeInMainWorld('seeya', api);
