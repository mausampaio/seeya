/**
 * Resolves every option a tab's `@xterm/xterm` `new Terminal({...})` needs, beyond what
 * `@xterm/xterm` defaults on its own: the two appearance config keys (`terminalFontFamily`/
 * `terminalFontSize`, V2-T3, D-035, `AGENTS.md` § "Idioma") and, on Windows, the `windowsPty`
 * compatibility option (V2-T6). Pure — no Electron, no `@xterm/xterm` (AGENTS.md § "Estrutura":
 * "tudo que tiver lógica fica fora de electron/") — `electron/main.ts` calls `resolveTerminalOptions`
 * once, at startup, and hands the result to the renderer over IPC
 * (`ipc/channels.ts#CHANNELS.getTerminalOptions`); the renderer never reads `Config` itself.
 *
 * **Renamed from `terminal-font.ts` (V2-T6, Q-075):** the module now resolves more than the font,
 * and the old name would have undersold what travels through the same IPC round trip.
 */
import type { Config } from '@seeya-ai/engine/core/types.js';

export interface TerminalFontOptions {
  readonly fontFamily: string;
  readonly fontSize: number;
}

/**
 * The shape `@xterm/xterm`'s own `ITerminalOptions.windowsPty` (`IWindowsPty`) expects —
 * re-declared here rather than imported so this module stays free of the `@xterm/xterm` import
 * (this module has no I/O and no DOM; `@xterm/xterm`'s typings pull in `lib: ["dom"]`, which this
 * package's plain `tsconfig.json` program deliberately doesn't carry for non-`electron/` files —
 * see `AGENTS.md`'s V2-T2 Q-071 entry, item 3). A `WindowsPtyOptions` value is structurally
 * assignable to `IWindowsPty` (its fields are optional there; here they're always both present
 * when the value exists at all), so `electron/renderer.ts` can pass it straight into
 * `new Terminal({...})` with no adapter in between.
 */
export interface WindowsPtyOptions {
  readonly backend: 'conpty';
  readonly buildNumber: number;
}

export interface TerminalOptions extends TerminalFontOptions {
  /** `undefined` off Windows, or when `os.release()` didn't parse — see
   * `deriveWindowsPtyOptions`'s own docstring for why "didn't parse" isn't a `0`/a guess. */
  readonly windowsPty: WindowsPtyOptions | undefined;
}

// os.release() on Windows is documented as "MAJOR.MINOR.BUILD" (e.g. "10.0.26200") — nothing
// guarantees that shape forever, so a release string that doesn't match this pattern falls
// through to `undefined` in deriveWindowsPtyOptions below (D-025) instead of a best-effort parse.
const WINDOWS_RELEASE_PATTERN = /^\d+\.\d+\.(\d+)$/;

/**
 * Derives `@xterm/xterm`'s own `windowsPty` option from the composition root's single
 * `process.platform`/`os.release()` read (AGENTS.md: "nada de process.platform/os.release() fora
 * da raiz de composição" — this function never reads either itself, both arrive by parameter).
 *
 * Why this exists at all (V2-T6, the measured defect: orphaned characters at the left edge after
 * resizing and scrolling a Claude Code tab on Windows): `@xterm/xterm`'s own `windowsPty`
 * docstring (`node_modules/@xterm/xterm/typings/xterm.d.ts`) says that without this option, ConPTY
 * doesn't bring scrollback back into the viewport when rows increase — it draws empty rows
 * instead, and can leave the row-wrap bookkeeping between xterm.js and the pty disagreeing about
 * where a line broke, which is what an in-place erase-to-end-of-line sequence (the Claude Code TUI
 * redraws its own block with exactly that sequence) then paints wrong. Below ConPTY build 21376,
 * reflow is disabled outright by the same option.
 *
 * `undefined` off Windows. `undefined` also when `release` doesn't parse to a build number
 * (D-025: no number, no claim) — the caller (`electron/main.ts`, via `resolveTerminalOptions`)
 * passes that `undefined` straight through to `new Terminal({...})`, which is exactly
 * `@xterm/xterm`'s own "not on Windows" behavior (the option is simply omitted).
 *
 * @example
 * deriveWindowsPtyOptions('win32', '10.0.26200') // { backend: 'conpty', buildNumber: 26200 }
 * deriveWindowsPtyOptions('linux', '6.8.0') // undefined — not Windows
 * deriveWindowsPtyOptions('win32', 'unknown') // undefined — release didn't parse
 */
export function deriveWindowsPtyOptions(
  platform: NodeJS.Platform,
  release: string,
): WindowsPtyOptions | undefined {
  if (platform !== 'win32') {
    return undefined;
  }
  const match = WINDOWS_RELEASE_PATTERN.exec(release);
  if (match === null) {
    return undefined;
  }
  return { backend: 'conpty', buildNumber: Number(match[1]) };
}

/**
 * Combines the config-supplied font with the composition root's already-derived `windowsPty`
 * (D-025: "no number, no claim" already happened once, in `deriveWindowsPtyOptions` — this
 * function never re-derives it, only carries the value through) into the one shape
 * `electron/renderer.ts`'s `new Terminal({...})` needs, so `electron/main.ts`'s own IPC handler
 * (excluded from this package's coverage floor) stays a one-line call with no logic of its own —
 * same "the mapping is pulled out so it's the testable part" shape `composition/index.ts#toEndDayDeps`
 * already has.
 *
 * @example
 * resolveTerminalOptions(config, { backend: 'conpty', buildNumber: 26200 })
 * // { fontFamily: "'FiraCode Nerd Font Mono', …", fontSize: 14, windowsPty: { backend: 'conpty', buildNumber: 26200 } }
 */
export function resolveTerminalOptions(
  config: Pick<Config, 'terminalFontFamily' | 'terminalFontSize'>,
  windowsPty: WindowsPtyOptions | undefined,
): TerminalOptions {
  return {
    fontFamily: config.terminalFontFamily,
    fontSize: config.terminalFontSize,
    windowsPty,
  };
}
