/**
 * The Electron main process entry (D-042: the interface embeds the terminal; D-041: no logic of
 * its own — every decision below delegates to a pure module or to `composition/index.ts`). Wires
 * IPC (`ipc/channels.ts`) to `pty/pty-manager.ts`, `state/refresh-loop.ts` and the renderer's
 * `BrowserWindow`. Excluded from `packages/app/src`'s coverage floor (`vitest.config.ts`'s
 * `APP_ELECTRON_SOURCE`) — it cannot run without a display; everything it calls is unit-tested on
 * its own.
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
  RemoveTabRequest,
  WriteTabRequest,
  TabDataEvent,
  TabExitEvent,
  SessionsUpdateEvent,
  StatusUpdateEvent,
  TerminalFontConfigResponse,
  FallbackConfirmAnswerRequest,
  TodayPanelResponse,
  ResumeSelectedRequest,
  ResumeSummaryResponse,
  ResumeProgressUpdateEvent,
  ResumeTabOpenedEvent,
} from '../ipc/channels.js';
import type { Clock } from '@seeya-ai/engine/core/ports.js';
import { findPendingBriefing } from '@seeya-ai/engine/application/find-pending-briefing.js';
import { resumeSessions } from '@seeya-ai/engine/application/start-day.js';
import type { Handoff } from '@seeya-ai/engine/core/types.js';
import { buildAppContext, type AppContext } from '../composition/index.js';
import { MESSAGES } from '../text/messages.js';
import {
  addTab,
  createTab,
  emptyTabs,
  markExited,
  removeTab,
  updateTab,
  withPid,
  type TabCollection,
} from '../tabs/tab-model.js';
import { describeAutostartState } from '@seeya-ai/engine/application/autostart-state.js';
import { buildSidebarRows } from '../sidebar/sidebar-data.js';
import { buildStatusPanelText } from '../state/status-panel.js';
import { runRefreshLoop } from '../state/refresh-loop.js';
import { resolveTerminalFontOptions } from '../state/terminal-font.js';
import {
  resolveAutostartReport,
  DEFAULT_AUTOSTART_REFRESH_INTERVAL_MS,
  type AutostartCacheEntry,
} from '../state/autostart-cache.js';
import { buildTodayPanelData } from '../state/today-panel.js';
import { buildResumeSummary } from '../state/resume-summary.js';
import { PendingFallbackRequests } from '../resume/pending-fallback-requests.js';
import { buildFallbackConfirmer } from '../resume/fallback-confirmer.js';
import { ExitListenerRegistry } from '../resume/exit-listener-registry.js';
import {
  TabSessionResumer,
  type OpenedResumeTab,
  type TabResumeOpener,
} from '../resume/tab-session-resumer.js';

/** `TabSessionResumer`'s `claudeCommand` in production — the same default the CLI's own
 * `ClaudeSessionResumer#resolveClaudeBinary` falls back to when nothing overrides it
 * (`adapters/resumption/resumer.ts`'s own `DEFAULT_CLAUDE_BINARY`, not exported — this is the app's
 * own copy of that one literal, resolved for real here via `context.resolveHarnessCommand`, unlike
 * the CLI which hands the bare string straight to `node:child_process.spawn`). */
const CLAUDE_COMMAND = 'claude';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * How often the sidebar/status panel refresh (docs/PLANO-DE-ENTREGA.md V2-T2: "atualizada em
 * intervalo pelo relógio injetado"). Independent of the daemon's own 30s poll
 * (`scheduler/loop.ts#POLL_INTERVAL_MS`) — this is a read-only UI refresh, not a scheduling
 * decision.
 *
 * **10s, not 5s (PO review of V2-T2).** One cycle does one `SessionProvider.list()` (shared by the
 * sidebar and the status panel — see `sidebar/sidebar-data.ts`'s own docstring) plus
 * `describeDaemonState` every time (~0.24s, measured on the PO's real machine) — cheap enough for
 * 5s, but 10s halves the steady-state cost for a read-only refresh nobody asked to be
 * sub-5-second, and gives `state/autostart-cache.ts`'s own 60s refresh interval a rounder multiple
 * (six ticks) to reason about.
 */
const REFRESH_INTERVAL_MS = 10_000;

/**
 * V2-T3's own aceite: "captura de tela ... com uma linha de glifos Nerd
 * (`  `) numa aba, renderizados e nao como caixas" -- a Powerline
 * separator, a shell icon, and a git-branch icon, three code points spanning the
 * Private Use Area ranges the embedded Nerd Font patches in. Sent through the SAME
 * `CHANNELS.tabData` channel a real pty's output uses
 * (`renderer.ts#wireIncomingEvents`'s own `onTabData`), by
 * `SEEYA_APP_AUTO_OPEN_SHELL_TAB` below -- this exercises the exact rendering path a
 * real prompt line would, without depending on a real shell's own console codepage
 * to transmit these code points back through the pty faithfully.
 */
const NERD_GLYPH_PROOF_LINE = '  \r\n';

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
  // above — clicks the real "+" button and submits the real command bar with both fields left
  // blank (the same elements and handlers a person would use, for the "leave blank for a shell"
  // case), a few seconds after load, so an agent with no keyboard/mouse of its own can prove a
  // shell tab really opens a pty (docs/PLANO-DE-ENTREGA.md V2-T2 aceite: process tree, window
  // count). Never set by `npm run app` or the README. **V2-T3:** also sends
  // `NERD_GLYPH_PROOF_LINE` (this file's own docstring above) through the tab's data channel, so
  // the same screenshot proves the embedded Nerd Font renders real glyphs, not boxes.
  if (process.env.SEEYA_APP_AUTO_OPEN_SHELL_TAB === '1') {
    window.webContents.once('did-finish-load', () => {
      void clock
        .sleep(300)
        .then(() =>
          window.webContents.executeJavaScript(
            "document.getElementById('new-tab-button').click(); " +
              "document.getElementById('command-bar').requestSubmit();",
          ),
        )
        .then(() => clock.sleep(200))
        .then(() => {
          // "tab-1": renderer.ts#newTabId's first id — this branch only ever opens one tab.
          const event: TabDataEvent = { id: 'tab-1', data: NERD_GLYPH_PROOF_LINE };
          window.webContents.send(CHANNELS.tabData, event);
        });
    });
  }
  // SEEYA_APP_AUTO_RESUME_ALL: same "instrumentação só do spike" class as the two above — checks
  // every checkbox the "Today" panel rendered (renderer.ts's own startup `refreshTodayPanel`
  // already populated it by the time `did-finish-load` fires) and clicks "Resume selected", so an
  // agent with no keyboard/mouse of its own can prove V2-T4's own aceite: a tab opens labeled with
  // the handoff's name for a session whose plan fits, and the fallback dialog appears with the
  // right text for one whose plan doesn't (`resume/tab-session-resumer.ts`'s own size check runs
  // before any tab opens, so the dialog can show up well inside this file's screenshot window).
  // Never set by `npm run app` or the README.
  if (process.env.SEEYA_APP_AUTO_RESUME_ALL === '1') {
    window.webContents.once('did-finish-load', () => {
      void clock
        .sleep(500)
        .then(() =>
          window.webContents.executeJavaScript(
            "document.querySelectorAll('.today-session-checkbox').forEach((cb) => { cb.checked = true; }); " +
              "document.querySelector('#today-panel button')?.click();",
          ),
        )
        .then(() => clock.sleep(300))
        .then(() =>
          // If a fallback question came up (a plan over the size ceiling), answer "Skip" — the
          // default a closed dialog would already pick, exercised explicitly here so the summary
          // section actually renders instead of leaving resumeSessions waiting forever on this
          // one automated run. A no-op when no dialog is open (optional chaining).
          window.webContents.executeJavaScript(
            "document.getElementById('fallback-dialog-skip')?.click();",
          ),
        );
    });
  }
  return window;
}

/**
 * Wires every IPC channel to `PtyManager` and starts the sidebar/status refresh loop. The only
 * logic here is "which tab does this event belong to" and "which window does this update go to" —
 * never anything about a pty, a process, or how to compute a session row (that's `pty/`, `state/`
 * and `sidebar/`'s job).
 */
function wireIpc(window: BrowserWindow, context: AppContext): void {
  // Mutated only by the two places below that change a tab's lifecycle (created, exited) — never
  // read by anything outside this function, so a plain closed-over variable is enough; no reason
  // for the heavier ceremony `pty/pty-manager.ts`'s own class gets (that one is exported and
  // tested on its own).
  let tabs: TabCollection = emptyTabs();
  // Same "closed-over, only this function touches it" reasoning as `tabs` above —
  // `state/autostart-cache.ts`'s own docstring has the caching rule and the measurement behind it.
  let autostartCache: AutostartCacheEntry | null = null;
  // V2-T4 item 3: at most one truly pending in production (`resumeSessions`'s own sequential
  // loop), but keyed independently by requestId anyway — `PendingFallbackRequests`'s own docstring.
  const pendingFallbackRequests = new PendingFallbackRequests();
  // V2-T4 item 2: lets the SAME onExit callback below also notify TabSessionResumer's
  // fast-failure race for the specific tabs it opened — ExitListenerRegistry's own docstring.
  const exitListenerRegistry = new ExitListenerRegistry();
  let nextResumeTabId = 0;

  const ptyManager = context.buildPtyManager({
    onData: (id, data) => {
      const event: TabDataEvent = { id, data };
      window.webContents.send(CHANNELS.tabData, event);
    },
    onExit: (id, exitCode) => {
      tabs = updateTab(tabs, id, (tab) => markExited(tab, exitCode));
      const event: TabExitEvent = { id, exitCode };
      window.webContents.send(CHANNELS.tabExit, event);
      exitListenerRegistry.fire(id, exitCode);
    },
  });

  /**
   * The real `TabResumeOpener` (V2-T4 item 2) — glue over this function's own `ptyManager`/`tabs`,
   * the same two things `CHANNELS.createTab`'s handler below already uses, so a resumed session's
   * tab is indistinguishable from a command-bar one once open (same `PtyManager`, same
   * `TabCollection`, same pid the sidebar matches by). The one real difference: the RENDERER never
   * initiates this — `resumeTabOpened` tells it to create the `@xterm/xterm` instance for an `id`
   * whose pty this process already spawned, instead of the renderer asking main to spawn one.
   */
  async function openResumeTab(options: {
    readonly command: string;
    readonly args: readonly string[];
    readonly cwd: string;
    readonly label: string;
  }): Promise<OpenedResumeTab> {
    const resolved = await resolveHarnessOrThrow(context, options.command, options.args);
    nextResumeTabId += 1;
    const id = `resume-${nextResumeTabId}`;
    tabs = addTab(tabs, createTab({ id, command: options.label, args: [], cwd: options.cwd }));
    const pid = ptyManager.create(id, {
      command: resolved.command,
      args: resolved.args,
      cwd: options.cwd,
      env: context.tabEnv,
      // Reasonable initial size — same as any tab: the renderer's own FitAddon corrects it once
      // the tab is actually shown, the same way an ordinary command-bar tab's first size is only
      // ever a starting point (`renderer.ts#openTab`'s own `terminal.cols`/`rows`).
      cols: 80,
      rows: 24,
    });
    tabs = updateTab(tabs, id, (tab) => withPid(tab, pid));
    const event: ResumeTabOpenedEvent = { id, label: options.label, cwd: options.cwd, pid };
    window.webContents.send(CHANNELS.resumeTabOpened, event);
    return { id, pid };
  }

  const tabResumeOpener: TabResumeOpener = {
    openTab: openResumeTab,
    onceExit: (id, listener) => exitListenerRegistry.register(id, listener),
  };

  // V2-T3: fetched once by `renderer.ts#main`, before any `new Terminal({...})` is constructed —
  // the two-way handshake (`invoke`, not `send`) matches `createTab` below, the only other channel
  // the renderer needs a value back from.
  ipcMain.handle(CHANNELS.getTerminalFontConfig, (): TerminalFontConfigResponse =>
    resolveTerminalFontOptions(context.config),
  );

  ipcMain.handle(
    CHANNELS.createTab,
    async (_event, request: CreateTabRequest): Promise<CreateTabResponse> => {
      // Empty command means "the default system shell" (docs/PLANO-DE-ENTREGA.md V2-T2 step (b)):
      // pty/default-shell.ts needs no PATH walk. A named harness (claude/codex, or anything else
      // typed) resolves through the engine's adapters/process/resolve-command.ts instead, exactly
      // the way a real shell would find it (V2-T2 item 4/step (c)).
      const resolved =
        request.command === ''
          ? context.defaultShell
          : await resolveHarnessOrThrow(context, request.command, request.args);
      const cwd = request.cwd === '' ? context.homeDir : request.cwd;
      tabs = addTab(
        tabs,
        createTab({ id: request.id, command: request.command, args: request.args, cwd }),
      );
      const pid = ptyManager.create(request.id, {
        command: resolved.command,
        args: resolved.args,
        cwd,
        env: context.tabEnv,
        cols: request.cols,
        rows: request.rows,
      });
      tabs = updateTab(tabs, request.id, (tab) => withPid(tab, pid));
      return { id: request.id, pid };
    },
  );

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

  // V2-T3 review: the renderer only ever sends this for a tab whose process has already exited
  // (`renderer.ts#removeTabUi`, the same distinction `closeTab` above never needed) — keeps this
  // `TabCollection` from still holding a stale entry, which is what let a NEW session with a
  // reused pid falsely match a removed tab in the sidebar (`CHANNELS.removeTab`'s own docstring).
  // `ptyManager` needs no matching call: `PtyManager` was never asked to track this tab in the
  // first place once its own `onExit` already deleted the entry (`pty-manager.ts`'s own
  // docstring on `handleFor`).
  ipcMain.on(CHANNELS.removeTab, (_event, request: RemoveTabRequest) => {
    tabs = removeTab(tabs, request.id);
  });

  // V2-T4 item 3: the renderer's answer to one confirmFallbackRequest — resolving a stale or
  // unknown requestId is a no-op (PendingFallbackRequests.resolve's own docstring), so a late
  // answer after the window reloaded mid-question never throws here.
  ipcMain.on(CHANNELS.confirmFallbackAnswer, (_event, answer: FallbackConfirmAnswerRequest) => {
    pendingFallbackRequests.resolve(answer.requestId, answer.decision);
  });

  // V2-T4 item 1: the "Today" panel's own data — findPendingBriefing is the exact same lookup
  // `seeya start-day` does (application/find-pending-briefing.js), scanned over
  // config.maxBriefingScanDays like the CLI's own StartDayCommandContext.
  ipcMain.handle(CHANNELS.getTodayPanel, async (): Promise<TodayPanelResponse> => {
    const lookup = await findPendingBriefing(
      context.storage,
      context.clock,
      context.config.maxBriefingScanDays,
    );
    return buildTodayPanelData(lookup);
  });

  // V2-T4 items 1/2/3: "Resume selected" — the same resumeSessions the CLI's start-day-command.ts
  // calls, with a TabSessionResumer instead of ClaudeSessionResumer and a dialog-backed
  // FallbackConfirmer instead of readline (D-039: this NEVER runs on its own, only from this one
  // handler, itself only ever called by the person's own click — renderer.ts's "Resume selected"
  // button).
  ipcMain.handle(
    CHANNELS.resumeSelected,
    async (_event, request: ResumeSelectedRequest): Promise<ResumeSummaryResponse> => {
      const briefing = await context.storage.readBriefing(request.day);
      const wanted = new Set(request.sessionIds);
      const handoffs: readonly Handoff[] =
        briefing?.handoffs.filter((handoff) => wanted.has(handoff.sessionId)) ?? [];

      const resolveLabel = (sessionId: string): string =>
        handoffs.find((handoff) => handoff.sessionId === sessionId)?.name ?? sessionId;
      const sessionResumer = new TabSessionResumer({
        seeyaHome: context.home.seeyaHome,
        claudeCommand: CLAUDE_COMMAND,
        opener: tabResumeOpener,
        clock: context.clock,
        resolveLabel,
      });
      const confirmFallback = buildFallbackConfirmer(pendingFallbackRequests, (confirmRequest) =>
        window.webContents.send(CHANNELS.confirmFallbackRequest, confirmRequest),
      );

      const result = await resumeSessions(
        { storage: context.storage, sessionResumer, confirmFallback },
        { day: request.day, handoffs },
        (progressEvent) => {
          const event: ResumeProgressUpdateEvent = {
            index: progressEvent.index,
            total: progressEvent.total,
            name: progressEvent.handoff.name,
          };
          window.webContents.send(CHANNELS.resumeProgress, event);
        },
      );

      return buildResumeSummary(result, resolveLabel);
    },
  );

  void runRefreshLoop({
    clock: context.clock,
    intervalMs: REFRESH_INTERVAL_MS,
    shouldStop: () => window.isDestroyed(),
    // One discovery per cycle, shared by the sidebar and the status panel (PO review of V2-T2,
    // `docs/QUESTOES.md` Q-071) — the old version called `sessionProvider.list()` twice per tick
    // (once here, once inside `buildStatusPanelText`), doubling a real, measured ~239ms cost for
    // no reason. The autostart line is cached and only re-queried every
    // `DEFAULT_AUTOSTART_REFRESH_INTERVAL_MS` (`state/autostart-cache.ts`'s own docstring has the
    // 6-second-on-first-call measurement that motivates this).
    onTick: async () => {
      const discovery = await context.sessionProvider.list();
      const now = context.clock.now();

      const rows = buildSidebarRows(discovery, context.config, now, tabs);
      const sessionsEvent: SessionsUpdateEvent = { rows };
      window.webContents.send(CHANNELS.sessionsUpdate, sessionsEvent);

      autostartCache = await resolveAutostartReport(
        autostartCache,
        now,
        DEFAULT_AUTOSTART_REFRESH_INTERVAL_MS,
        () => describeAutostartState(context.autostart),
      );

      const text = await buildStatusPanelText({
        discovery,
        config: context.config,
        clock: context.clock,
        storage: context.storage,
        processControl: context.processControl,
        autostartReport: autostartCache.report,
      });
      const statusEvent: StatusUpdateEvent = { text };
      window.webContents.send(CHANNELS.statusUpdate, statusEvent);
    },
  });
}

/** Resolves a named harness command against the real `PATH`, or throws a message naming exactly
 * where it looked (AGENTS.md's error-message rule) — `ipcMain.handle` turns a thrown error into a
 * rejected promise on the renderer side, which `renderer.ts#openTab` shows in the tab itself. */
async function resolveHarnessOrThrow(
  context: AppContext,
  command: string,
  args: readonly string[],
): Promise<{ readonly command: string; readonly args: readonly string[] }> {
  const result = await context.resolveHarnessCommand(command, args);
  if (result.kind === 'resolved') {
    return result.resolved;
  }
  throw new Error(
    `could not find "${command}" — searched: ${result.unresolved.searched.join(', ') || '(PATH is empty)'}`,
  );
}

void app.whenReady().then(async () => {
  // Built once per process (mirrors `packages/cli/src/composition.ts`'s own "read once" shape).
  // `wireIpc` registers every `ipcMain.handle`/`ipcMain.on` — process-global in Electron, not
  // per-window (`ipcMain.handle` throws "Attempted to register a second handler" on a repeat
  // registration) — so it runs exactly ONCE here, never again from `activate` below.
  //
  // SEEYA_APP_HOME_OVERRIDE: same undocumented, internal, verification-only class as
  // SEEYA_APP_OFFSCREEN/SEEYA_APP_SCREENSHOT_PATH above — `buildAppContext` already accepts a home
  // directory as a parameter for exactly this (every test in tests/integration/app/composition.test.ts
  // uses it against a tmpdir fixture, never the real home). Never set by `npm run app`.
  const context = await buildAppContext(process.env.SEEYA_APP_HOME_OVERRIDE);
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
