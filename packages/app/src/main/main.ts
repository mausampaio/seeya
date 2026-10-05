/**
 * The Electron main process entry (D-042: the interface embeds the terminal; D-041: no logic of
 * its own — every decision below delegates to a pure module or to `composition/index.ts`). Wires
 * the app lifecycle: single instance, the protocol registration, the application menu, the window
 * and its IPC (V2-T51: split by responsibility — `window.ts`, `wire-ipc.ts` and the `*-ipc.ts`
 * modules it composes, `ambient-refresh.ts`, `protocol-registration.ts`, `application-menu.ts`,
 * and `verification/`, where every `SEEYA_APP_*` instrumentation lives behind one entry). Excluded
 * from `packages/app/src`'s coverage floor (`vitest.config.ts`'s `APP_MAIN_AND_LEGACY_SOURCE`) —
 * it cannot run without a display; everything it calls is unit-tested on its own.
 */
import { app, BrowserWindow } from 'electron';
import { buildAppContext } from '../composition/index.js';
import { applyApplicationMenuPolicy } from './application-menu.js';
import { createWindow } from './window.js';
import { wireIpc } from './wire-ipc.js';
import { focusExistingWindow, registerProtocolSchemeAndMarker } from './protocol-registration.js';
import { buildVerificationContextOverrides } from './verification/index.js';

// V2-T5b item 5: `requestSingleInstanceLock` has to run before `app.whenReady()` — Electron's own
// documented ordering, so a duplicate launch (including one caused by a `seeya://` click while the
// interface is already open) quits itself immediately instead of doing any of the work below
// first. A launch that LOSES the race quits outright; the one that keeps it wires `second-instance`
// to focus the real window instead of ever opening a second one.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    focusExistingWindow();
  });

  void app.whenReady().then(async () => {
    // Built once per process (mirrors `packages/cli/src/composition.ts`'s own "read once" shape).
    // `wireIpc` registers every `ipcMain.handle`/`ipcMain.on` — process-global in Electron, not
    // per-window (`ipcMain.handle` throws "Attempted to register a second handler" on a repeat
    // registration) — so it runs exactly ONCE here, never again from `activate` below.
    //
    // SEEYA_APP_HOME_OVERRIDE: same undocumented, internal, verification-only class as
    // SEEYA_APP_OFFSCREEN/SEEYA_APP_SCREENSHOT_PATH (`window.ts`, `verification/`) — `buildAppContext` already accepts a home
    // directory as a parameter for exactly this (every test in tests/integration/app/composition.test.ts
    // uses it against a tmpdir fixture, never the real home). Never set by `npm run app`. Captured
    // once here, and reused below by `shouldRegisterProtocolScheme` (V2-T57) — the OS-level
    // registration and the marker file live outside whatever home this window is pointed at, so
    // redirecting the home alone was never enough to isolate them (see that module's own docstring).
    const homeOverride = process.env.SEEYA_APP_HOME_OVERRIDE;
    const context = await buildAppContext(homeOverride, buildVerificationContextOverrides());

    await registerProtocolSchemeAndMarker(context, homeOverride);

    // V2-T74: process-global (`Menu.setApplicationMenu` is not per-window), so it runs exactly
    // once here, before any `BrowserWindow` exists — never from inside `createWindow`, which can
    // run again from the `activate` handler below on macOS.
    applyApplicationMenuPolicy(process.platform, app.name);

    const window = createWindow(context.clock);
    wireIpc(window, context);

    // macOS convention (re-opening a window when the dock icon is clicked with none left) — this
    // skeleton only ever wires ONE window's worth of IPC (see the comment above); a second window
    // is out of scope for V2-T2 (docs/PLANO-DE-ENTREGA.md's own "o que não entra": no multi-window
    // support is asked for), so this only recreates a window on Windows/Linux never being reached
    // in the first place (`window-all-closed` below already quits there).
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow(context.clock);
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
