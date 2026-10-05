/**
 * The `BrowserWindow` (V2-T51: moved out of `main/main.ts`) — creation, the dev-only DevTools
 * shortcut, and the one call that hands the window to the verification instrumentation
 * (`main/verification/index.ts`, a no-op unless a `SEEYA_APP_*` variable is set).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow } from 'electron';
import type { Clock } from '@seeya-ai/engine/core/ports.js';
import { resolveWindowIconPath } from '../composition/window-icon.js';
import { resolveWindowSize } from '../composition/window-size.js';
import { MESSAGES } from '../text/messages.js';
import { registerWindowVerification } from './verification/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * V2-T74: the one shortcut the default menu's own "View > Toggle Developer Tools" used to give
 * for free (`Ctrl+Shift+I`/`F12` on Windows/Linux, `Cmd+Option+I` on macOS) — this task's own
 * aceite names it explicitly ("ferramentas de desenvolvedor só fora do app empacotado, se fizer
 * falta"). `!app.isPackaged` is the same check `composition/protocol-scheme.ts#resolveProtocolScheme`
 * already uses to tell a dev launch (`npm run app`) from an installed build — the packaged app
 * never wires this at all, not even dormant, so there is no DevTools entry point to find in it.
 */
function wireDevToolsShortcut(window: BrowserWindow): void {
  if (app.isPackaged) {
    return;
  }
  window.webContents.on('before-input-event', (_event, input) => {
    const isF12 = input.key === 'F12';
    const isCtrlOrCmdShiftI =
      input.key.toLowerCase() === 'i' && input.shift && (input.control || input.meta);
    if (input.type === 'keyDown' && (isF12 || isCtrlOrCmdShiftI)) {
      window.webContents.toggleDevTools();
    }
  });
}

export function createWindow(clock: Clock): BrowserWindow {
  // SEEYA_APP_WINDOW_WIDTH/SEEYA_APP_WINDOW_HEIGHT: same "instrumentação só do spike" class as
  // every other SEEYA_APP_* flag — a verification screenshot's own requested canvas size (e.g.
  // 1280×800), never read by `npm run app`. Falls back to the real app's own 1200×800 default
  // when unset, which is every normal run. V2-T77: the window also has a floor now
  // (`composition/window-size.ts`) — an override below it is clamped up, never honored.
  const windowSize = resolveWindowSize(
    process.env.SEEYA_APP_WINDOW_WIDTH,
    process.env.SEEYA_APP_WINDOW_HEIGHT,
  );
  const window = new BrowserWindow({
    width: windowSize.width,
    height: windowSize.height,
    minWidth: windowSize.minWidth,
    minHeight: windowSize.minHeight,
    title: MESSAGES.windowTitle,
    // V2-T11 item 2: the taskbar icon in dev (`npm run app`, Windows) and the window icon on
    // Linux, where the packaged executable's own icon resource (electron-builder.yml's own
    // `linux.icon`) doesn't apply the way it does on Windows — `resolveWindowIconPath` points at
    // the PNG `scripts/build.mjs` copies next to this same bundled `main.js`, from
    // `design/icons/png/` (that module's own docstring has the size measurement).
    icon: resolveWindowIconPath(HERE),
    webPreferences: {
      // D-042/V2-T2 item 1: contextIsolation on, nodeIntegration off, sandboxed — the preload
      // (preload.ts) is the only bridge, and it exposes only what the renderer needs.
      // .cjs, not .js: Electron's sandboxed preload loader (`sandbox: true` above) is CommonJS
      // even when the rest of the app is "type": "module" — scripts/build.mjs's own comment on
      // its `preload` esbuild call explains why.
      preload: path.join(HERE, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // SEEYA_APP_OFFSCREEN: undocumented, internal, unset in every normal run — same
      // "instrumentação só do spike" discipline docs/spikes/M-terminal-embutido.md used
      // (SPIKE_AUTO_TABS_FILE etc.), kept here because the measurement it enables
      // (webContents.capturePage() against a real window, with no human eyes on a screen) is
      // exactly what this task's own aceite keeps asking an agent to prove after the spike. Only
      // needed in a sandbox with no interactive desktop attached (Chromium's compositor throws
      // "UnknownVizError" capturing a normally-composited window there, measured against this
      // exact build) — the maintainer's real desktop needs neither this nor
      // SEEYA_APP_SCREENSHOT_PATH below, and `npm run app` never sets either.
      offscreen: process.env.SEEYA_APP_OFFSCREEN === '1',
    },
  });
  void window.loadFile(path.join(HERE, 'index.html'));
  wireDevToolsShortcut(window);
  registerWindowVerification(window, clock);
  return window;
}
