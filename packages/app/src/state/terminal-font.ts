/**
 * Resolves the two terminal-appearance config keys (`terminalFontFamily`/`terminalFontSize`,
 * V2-T3, D-035, `AGENTS.md` § "Idioma") into the shape `electron/renderer.ts`'s own
 * `new Terminal({...})` needs. Pure — no Electron, no `@xterm/xterm` (AGENTS.md § "Estrutura":
 * "tudo que tiver lógica fica fora de electron/") — `electron/main.ts` calls this once, at
 * startup, and hands the result to the renderer over IPC
 * (`ipc/channels.ts#CHANNELS.getTerminalFontConfig`); the renderer never reads `Config` itself.
 */
import type { Config } from '@seeya-ai/engine/core/types.js';

export interface TerminalFontOptions {
  readonly fontFamily: string;
  readonly fontSize: number;
}

/**
 * @example
 * resolveTerminalFontOptions(config) // { fontFamily: "'FiraCode Nerd Font Mono', …", fontSize: 14 }
 */
export function resolveTerminalFontOptions(
  config: Pick<Config, 'terminalFontFamily' | 'terminalFontSize'>,
): TerminalFontOptions {
  return { fontFamily: config.terminalFontFamily, fontSize: config.terminalFontSize };
}
