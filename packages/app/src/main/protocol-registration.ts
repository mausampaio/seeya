/**
 * Single-instance focus and the `seeya://` protocol registration (V2-T5b item 5, V2-T10, V2-T57,
 * V2-T8; V2-T51: moved out of `main/main.ts`).
 */
import path from 'node:path';
import { app, BrowserWindow } from 'electron';
import { type AppContext } from '../composition/index.js';
import { shouldMarkLinuxProtocolRegistered } from '../composition/linux-protocol-marker.js';
import { resolveProtocolScheme, type ProtocolScheme } from '../composition/protocol-scheme.js';
import { shouldRegisterProtocolScheme } from '../composition/protocol-registration-eligibility.js';

/**
 * V2-T5b item 5: focuses whichever window is already open — the `second-instance` handler's own
 * job when a `seeya://` click (or a person just double-clicking the app again) launches a SECOND
 * process while the interface is already running. Never opens a new one (mirrors the `activate`
 * handler below, which only creates a window when NONE exist at all).
 */
export function focusExistingWindow(): void {
  const [window] = BrowserWindow.getAllWindows();
  if (window === undefined) {
    return;
  }
  if (window.isMinimized()) {
    window.restore();
  }
  window.focus();
}

/**
 * V2-T5b item 5, Windows only this task (this file's own "o que não entra" for Linux/macOS — see
 * the module comment on the platform guard around this function's one call site below): registers
 * `scheme` with `app.setAsDefaultProtocolClient`, exactly the way Electron's own documentation
 * describes handling BOTH the packaged and the unpackaged (dev) case — `process.defaultApp` is
 * `true` only when running unpackaged (`npm run app`'s own `electron .` invocation), and that case
 * needs the runtime (`process.execPath`) and the script path passed explicitly, since there is no
 * single packaged `.exe` yet for Windows to associate the protocol with.
 *
 * **V2-T10 item 1: `scheme` is no longer hardcoded to `'seeya'`.** The caller passes
 * `resolveProtocolScheme(app.isPackaged)` — a packaged build still registers plain `seeya`, but a
 * dev launch now registers `seeya-dev` instead, so the two worlds never overwrite each other's
 * registration again (see `composition/protocol-scheme.ts`'s own docstring for the full "achado").
 *
 * Returns whether registration actually succeeded — `false` on a dev launch with no script
 * argument to point at (defensive; `npm run app` always provides one) as well as whatever
 * `app.setAsDefaultProtocolClient` itself reports.
 */
function registerProtocolHandler(scheme: ProtocolScheme): boolean {
  if (process.defaultApp) {
    const scriptPath = process.argv[1];
    if (scriptPath === undefined) {
      return false;
    }
    return app.setAsDefaultProtocolClient(scheme, process.execPath, [path.resolve(scriptPath)]);
  }
  return app.setAsDefaultProtocolClient(scheme);
}

/**
 * Registers this process's protocol scheme (when eligible) and writes the marker the daemon's
 * toast backends read back. Called once from `app.whenReady()`, after the `AppContext` exists.
 */
export async function registerProtocolSchemeAndMarker(
  context: AppContext,
  homeOverride: string | undefined,
): Promise<void> {
  // V2-T10 item 1: the scheme THIS window registers — packaged installs still claim plain
  // `seeya`, a dev launch (`npm run app`) now claims `seeya-dev` instead, so the two worlds
  // never overwrite each other's registration (composition/protocol-scheme.ts's own docstring
  // has the full "achado" this replaces). Computed once, here, and reused by both the Windows
  // registration call below and (once item 2 lands) the marker write.
  const protocolScheme = resolveProtocolScheme(app.isPackaged);

  // V2-T57: a verification window (SEEYA_APP_HOME_OVERRIDE set) never registers the protocol
  // scheme and never writes the marker, on any platform — neither `registerProtocolHandler`
  // (the only thing that touches the Windows registry) nor `saveActiveProtocolScheme` (the only
  // call site of the marker write in this codebase) run below when this is false. Without the
  // variable, behavior is exactly what it was before this task.
  if (shouldRegisterProtocolScheme(homeOverride)) {
    // V2-T5b item 5: Windows — the `seeya://`-shaped handler on Linux comes from the package's
    // own `.desktop` file and on macOS from its `Info.plist`, neither of which exists from a
    // checkout (only the installer task can write them); attempting `setAsDefaultProtocolClient`
    // there today would be a no-op at best (Electron's own docs: "this method is only
    // implemented on macOS and Windows") and a false claim in the marker at worst.
    // `process.platform` read directly here, not in `composition/index.ts`, matches this same
    // file's own pre-existing `window-all-closed` handler below — an Electron-lifecycle branch,
    // not a choice of which adapter to wire (composition/index.ts's own job).
    //
    // V2-T8 item 4: Linux — no equivalent API to call at all (`shouldMarkLinuxProtocolRegistered`'s
    // own docstring: the `.desktop` file's `MimeType` was already written, at INSTALL time, by the
    // `.deb`; this process can only infer that it was, never confirm it the way Windows' own
    // boolean return does). macOS still gets no marker at all this task (`o que não entra`: no
    // click mechanism exists there to gate). Linux never registers `seeya-dev` at all (V2-T10 item
    // 1's own "o que entra": no `.desktop` file exists from a checkout there either), so
    // `shouldMarkLinuxProtocolRegistered` only ever implies the packaged `seeya` scheme.
    const markProtocolRegistered =
      (process.platform === 'win32' && registerProtocolHandler(protocolScheme)) ||
      shouldMarkLinuxProtocolRegistered({
        platform: process.platform,
        isPackaged: app.isPackaged,
        appImageEnv: process.env.APPIMAGE,
      });
    if (markProtocolRegistered) {
      // V2-T10 item 2: the marker now records WHICH scheme this window registered (never just a
      // boolean "registered on this machine") — the toast/click backends read it back through
      // `Storage.readActiveProtocolScheme()` to pick the right URI.
      await context.storage.saveActiveProtocolScheme(protocolScheme).catch(() => {
        // Best-effort: a failed write here just means the daemon's own toast/click keeps omitting
        // `launch`/`--action` until a later run of the interface writes the marker successfully —
        // the same "no marker, toast as before" fallback D-025 already gives a marker that was
        // never written at all.
      });
    }
  }
}
