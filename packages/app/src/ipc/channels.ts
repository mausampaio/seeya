/**
 * IPC channel names and payload shapes shared by `electron/main.ts`, `electron/preload.ts` and
 * `electron/renderer.ts` — pure (no `electron` import, so it's outside `electron/` and reachable
 * from all three without tripping the electron-only-in-electron/ guard). A renamed/misspelled
 * channel string is a classic Electron footgun (main and renderer silently never talking to each
 * other); this module is the one place the string exists.
 */

export const CHANNELS = {
  /** Renderer → main: open a new tab. */
  createTab: 'seeya:create-tab',
  /** Renderer → main: keystrokes/paste for one tab. */
  writeTab: 'seeya:write-tab',
  /** Renderer → main: the terminal element for one tab was resized. */
  resizeTab: 'seeya:resize-tab',
  /** Renderer → main: close one tab (ends its process). */
  closeTab: 'seeya:close-tab',
  /** Main → renderer: output chunk for one tab. */
  tabData: 'seeya:tab-data',
  /** Main → renderer: one tab's process ended. */
  tabExit: 'seeya:tab-exit',
  /** Renderer → main (invoke): the current session listing (same content as `seeya sessions`). */
  listSessions: 'seeya:list-sessions',
  /** Renderer → main (invoke): the current status text (same content as `seeya status`). */
  readStatus: 'seeya:read-status',
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

export interface TabDataEvent {
  readonly id: string;
  readonly data: string;
}

export interface TabExitEvent {
  readonly id: string;
  readonly exitCode: number;
}
