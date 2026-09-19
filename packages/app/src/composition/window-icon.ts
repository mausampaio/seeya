/**
 * V2-T11 item 2: the raster PNG `BrowserWindow`'s own `icon` option loads, sitting next to
 * `main.js` in `dist/electron/` (the same "copy alongside the bundle" pattern the embedded Nerd
 * Font already uses, V2-T3's own comment on `scripts/build.mjs#bundle`). `scripts/build.mjs`
 * copies this exact file from `design/icons/png/` — the single source of icons this task's own
 * spec requires (`design/IDENTIDADE_VISUAL.md` § 2.6) — under this same name, so this module and
 * that copy step can never name two different files without one of them visibly breaking (the
 * window would fail to load a mismatched path, not silently show the wrong icon).
 *
 * **Why 256, not 512 (measured, not guessed).** Electron's own `BrowserWindow` "icon" doc
 * (`node_modules/electron/electron.d.ts`, the `icon?:` property) gives no pixel size at all — only
 * "on Windows it is recommended to use ICO icons". electron-builder's own icon converter
 * (`node_modules/app-builder-lib/out/util/iconConverter.js#doConvertSingleFile`) is the closest
 * thing to an authoritative number: `const recommendedMin = format === "icns" ? 512 : 256` — 512
 * is icns-specific (macOS's own @2x grid), and every other raster icon format's own recommended
 * minimum, including a plain PNG like this one, is 256. `design/icons/png/256x256.png` meets that
 * floor exactly, without shipping a much larger file `BrowserWindow` never benefits from (the
 * window icon is a titlebar/taskbar glyph, not an installer asset).
 *
 * @example
 * resolveWindowIconPath('/path/to/dist/electron') // → '/path/to/dist/electron/256x256.png'
 */
import path from 'node:path';

export const WINDOW_ICON_FILE_NAME = '256x256.png';

export function resolveWindowIconPath(distElectronDir: string): string {
  return path.join(distElectronDir, WINDOW_ICON_FILE_NAME);
}
