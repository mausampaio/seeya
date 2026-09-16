/**
 * IPC channel names and payload shapes shared by `electron/main.ts`, `electron/preload.ts` and
 * `electron/renderer.ts` — pure (no `electron` import, so it's outside `electron/` and reachable
 * from all three without tripping the electron-only-in-electron/ guard). A renamed/misspelled
 * channel string is a classic Electron footgun (main and renderer silently never talking to each
 * other); this module is the one place the string exists.
 */
import type { SidebarRow } from '../sidebar/sidebar-data.js';
import type { TerminalFontOptions } from '../state/terminal-font.js';

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
}

/** `CHANNELS.confirmFallbackAnswer`'s payload. */
export interface FallbackConfirmAnswerRequest {
  readonly requestId: string;
  readonly decision: 'open' | 'skip';
}
