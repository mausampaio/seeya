/**
 * The Electron main process entry (D-042: the interface embeds the terminal; D-041: no logic of
 * its own — every decision below delegates to a pure module or to `composition/index.ts`). Wires
 * IPC (`ipc/channels.ts`) to `pty/pty-manager.ts` and the renderer's `BrowserWindow`. Excluded
 * from `packages/app/src`'s coverage floor (`vitest.config.ts`'s `APP_ELECTRON_SOURCE`) — it
 * cannot run without a display; everything it calls is unit-tested on its own.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, ipcMain } from 'electron';
import { CHANNELS } from '../ipc/channels.js';
import type {
  CreateTabRequest,
  CreateTabResponse,
  ResizeTabRequest,
  CloseTabRequest,
  WriteTabRequest,
  TabDataEvent,
  TabExitEvent,
} from '../ipc/channels.js';
import type { Clock } from '@seeya-ai/engine/core/ports.js';
import { buildAppContext } from '../composition/index.js';
import { MESSAGES } from '../text/messages.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * `screenshotPath`/`quitAfterMs` back a single verification hook (undocumented, internal, unset
 * in every normal run): write one real `webContents.capturePage()` PNG shortly after load, then
 * optionally quit — the exact "instrumentação só do spike" pattern
 * docs/spikes/M-terminal-embutido.md used (`SPIKE_SCREENSHOT_PATH`/`SPIKE_QUIT_AFTER_MS`), kept in
 * this file because the same measurement (an agent with no display of its own reading a real
 * screenshot back) is what this task's own aceite keeps asking for after the spike. `clock.sleep`,
 * never a raw `setTimeout` (D-019: forbidden here by eslint.config.js's rule over every package's
 * own src tree, which does not exempt `packages/app/src/electron/` the way it exempts
 * `packages/engine/src/adapters/clock/`).
 */
async function captureVerificationScreenshot(
  window: BrowserWindow,
  clock: Clock,
  screenshotPath: string,
): Promise<void> {
  // Long enough for SEEYA_APP_AUTO_OPEN_SHELL_TAB's own click (registered on the same
  // did-finish-load event, a shorter 300ms delay) to have opened its tab first when both are set
  // together for a verification run.
  await clock.sleep(2500);
  const image = await window.webContents.capturePage();
  const { writeFile } = await import('node:fs/promises');
  await writeFile(screenshotPath, image.toPNG());
  const quitAfterMs = Number(process.env.SEEYA_APP_QUIT_AFTER_MS ?? '');
  if (Number.isFinite(quitAfterMs)) {
    await clock.sleep(quitAfterMs);
    app.quit();
  }
}

function createWindow(clock: Clock): BrowserWindow {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    title: MESSAGES.windowTitle,
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

  const screenshotPath = process.env.SEEYA_APP_SCREENSHOT_PATH;
  if (screenshotPath !== undefined) {
    window.webContents.once('did-finish-load', () => {
      void captureVerificationScreenshot(window, clock, screenshotPath);
    });
  }
  // SEEYA_APP_AUTO_OPEN_SHELL_TAB: same "instrumentação só do spike" class as SEEYA_APP_OFFSCREEN
  // above — clicks the real "+" button (the same DOM element and click handler a person would
  // use), a few seconds after load, so an agent with no keyboard/mouse of its own can prove a
  // shell tab really opens a pty (docs/PLANO-DE-ENTREGA.md V2-T2 aceite: process tree, window
  // count). Never set by `npm run app` or the README.
  if (process.env.SEEYA_APP_AUTO_OPEN_SHELL_TAB === '1') {
    window.webContents.once('did-finish-load', () => {
      void clock.sleep(300).then(() => {
        void window.webContents.executeJavaScript(
          "document.getElementById('new-tab-button').click()",
        );
      });
    });
  }
  return window;
}

/**
 * Wires every IPC channel to `PtyManager` — the only logic here is "which tab does this event
 * belong to", never anything about a pty or a process itself (that's `pty/pty-manager.ts`'s job).
 */
function wireIpc(window: BrowserWindow, context: ReturnType<typeof buildAppContext>): void {
  const ptyManager = context.buildPtyManager({
    onData: (id, data) => {
      const event: TabDataEvent = { id, data };
      window.webContents.send(CHANNELS.tabData, event);
    },
    onExit: (id, exitCode) => {
      const event: TabExitEvent = { id, exitCode };
      window.webContents.send(CHANNELS.tabExit, event);
    },
  });

  ipcMain.handle(CHANNELS.createTab, (_event, request: CreateTabRequest): CreateTabResponse => {
    // Empty command means "the default system shell" (docs/PLANO-DE-ENTREGA.md V2-T2 step (b):
    // "'+' abrindo uma aba com o shell do sistema"). A named harness (`claude`/`codex`, step (d))
    // resolves through the engine's `adapters/process/resolve-command.ts` instead — wired once
    // that module exists (V2-T2 step (c)).
    const resolved =
      request.command === ''
        ? context.defaultShell
        : { command: request.command, args: request.args };
    const pid = ptyManager.create(request.id, {
      command: resolved.command,
      args: resolved.args,
      cwd: request.cwd === '' ? context.homeDir : request.cwd,
      env: context.tabEnv,
      cols: request.cols,
      rows: request.rows,
    });
    return { id: request.id, pid };
  });

  ipcMain.on(CHANNELS.writeTab, (_event, request: WriteTabRequest) => {
    ptyManager.write(request.id, request.data);
  });

  ipcMain.on(CHANNELS.resizeTab, (_event, request: ResizeTabRequest) => {
    ptyManager.resize(request.id, request.cols, request.rows);
  });

  // docs/PLANO-DE-ENTREGA.md V2-T2 item 3: "fechar a aba encerra o processo". The tab's `onExit`
  // (registered above, in `buildPtyManager`) still fires normally and marks it as ended (not
  // removed) — closeTab only asks the process to end, it never removes the tab itself.
  ipcMain.on(CHANNELS.closeTab, (_event, request: CloseTabRequest) => {
    ptyManager.closeTab(request.id);
  });
}

void app.whenReady().then(() => {
  // Built once per process (mirrors `packages/cli/src/composition.ts`'s own "read once" shape).
  // `wireIpc` registers every `ipcMain.handle`/`ipcMain.on` — process-global in Electron, not
  // per-window (`ipcMain.handle` throws "Attempted to register a second handler" on a repeat
  // registration) — so it runs exactly ONCE here, never again from `activate` below.
  const context = buildAppContext();
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
