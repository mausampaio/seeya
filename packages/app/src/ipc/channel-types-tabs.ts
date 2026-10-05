/**
 * Payload shapes of the tab/pty, sessions, status, terminal-font, theme and directory-picker channels (V2-T51: split out of `ipc/channels.ts`, which still re-exports every
 * one of them, so no importer changed). Pure types — no `electron` import.
 */
import type { SidebarRow } from '../sidebar/sidebar-data.js';
import type { TerminalFontOptions } from '../state/terminal-font.js';
import type { EffectiveTheme } from '../theme/resolve-theme.js';

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

/** `CHANNELS.getEffectiveTheme`'s response AND `CHANNELS.themeUpdate`'s payload (V2-T62, D-051) —
 * the same shape either way, so the renderer applies the two through one function
 * (`electron/theme-view.ts#applyEffectiveTheme`) regardless of which one delivered it. */
export interface ThemeUpdateEvent {
  readonly effectiveTheme: EffectiveTheme;
}

/** `CHANNELS.pickDirectory`'s response (V2-T64) — a discriminated union (D-024), never a nullable
 * `path`: a cancelled picker and "no directory chosen yet" read the same to a caller that only
 * checks for `null`, but they are different facts (D-025) and this type keeps them that way. */
export type PickDirectoryResponse =
  { readonly canceled: true } | { readonly canceled: false; readonly path: string };
