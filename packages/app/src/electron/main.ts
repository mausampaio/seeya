/**
 * The Electron main process entry (D-042: the interface embeds the terminal; D-041: no logic of
 * its own — every decision below delegates to a pure module or to `composition/index.ts`). Wires
 * IPC (`ipc/channels.ts`) to `pty/pty-manager.ts`, `state/refresh-loop.ts` and the renderer's
 * `BrowserWindow`. Excluded from `packages/app/src`'s coverage floor (`vitest.config.ts`'s
 * `APP_ELECTRON_SOURCE`) — it cannot run without a display; everything it calls is unit-tested on
 * its own.
 */
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
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
  TodayUpdateEvent,
  ResumeSelectedRequest,
  ResumeSummaryResponse,
  ResumeProgressUpdateEvent,
  ResumeTabOpenedEvent,
  EndDayPreviewResponse,
  EndDayRunResponse,
  ScheduleUpdateEvent,
  SnoozeTodayRequest,
  DaemonAvailabilityUpdateEvent,
  DaemonControlRequest,
  DaemonControlResponse,
  SettingsPanelResponse,
  SaveSettingRequest,
  SaveSettingResponse,
  AutostartAvailabilityUpdateEvent,
  AutostartControlRequest,
  AutostartControlResponse,
  DaemonOwnershipTransitionOfferResponse,
  AnswerDaemonOwnershipTransitionRequest,
} from '../ipc/channels.js';
import type { Clock } from '@seeya-ai/engine/core/ports.js';
import {
  applyConfigFieldUpdate,
  parseConfigFieldUpdate,
} from '@seeya-ai/engine/adapters/storage/config-schema.js';
import { checkLiveLock } from '@seeya-ai/engine/scheduler/daemon-state.js';
import { findPendingBriefing } from '@seeya-ai/engine/application/find-pending-briefing.js';
import { readCwdHistory } from '@seeya-ai/engine/application/cwd-history.js';
import { resumeSessions } from '@seeya-ai/engine/application/start-day.js';
import { endDay } from '@seeya-ai/engine/application/end-day.js';
import { formatEndDayReport } from '@seeya-ai/engine/application/format-end-day.js';
import { buildEndDayNotice } from '@seeya-ai/engine/application/end-day-notice.js';
import { decideSchedule, emptyDayState } from '@seeya-ai/engine/core/schedule.js';
import { localDayString } from '@seeya-ai/engine/core/day.js';
import type { Handoff } from '@seeya-ai/engine/core/types.js';
import { buildAppContext, toEndDayDeps, type AppContext } from '../composition/index.js';
import { shouldMarkLinuxProtocolRegistered } from '../composition/linux-protocol-marker.js';
import { resolveProtocolScheme, type ProtocolScheme } from '../composition/protocol-scheme.js';
import { resolveWindowIconPath } from '../composition/window-icon.js';
import { MESSAGES } from '../text/messages.js';
import { buildEndDayCostCeiling } from '../state/end-day-preview.js';
import { projectEndDayProgressEvent } from '../state/end-day-progress.js';
import { buildScheduleStripData } from '../state/schedule-strip.js';
import { resolveDaemonControlAvailability } from '../state/daemon-control-panel.js';
import { resolveAutostartControlAvailability } from '../state/autostart-control-panel.js';
import { buildSettingsRows, buildProjectPolicyLines } from '../state/settings-panel.js';
import { snoozeTodayNow, skipTodayNow } from '../state/schedule-actions.js';
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
import {
  formatAutostartDisableResult,
  formatAutostartEnableResult,
} from '@seeya-ai/engine/application/autostart-state.js';
import {
  buildSidebarRows,
  buildLiveSessionIndex,
  type SidebarRow,
} from '../sidebar/sidebar-data.js';
import { buildStatusPanelText } from '../state/status-panel.js';
import { runRefreshLoop } from '../state/refresh-loop.js';
import {
  resolveAutostartReport,
  DEFAULT_AUTOSTART_REFRESH_INTERVAL_MS,
  type AutostartCacheEntry,
} from '../state/autostart-cache.js';
import {
  buildTodayPanelData,
  refreshTodayPanelLiveness,
  type TodayPanelInputs,
} from '../state/today-panel.js';
import { buildResumeSummary } from '../state/resume-summary.js';
import { PendingFallbackRequests } from '../resume/pending-fallback-requests.js';
import { buildFallbackConfirmer } from '../resume/fallback-confirmer.js';
import { ExitListenerRegistry } from '../resume/exit-listener-registry.js';
import {
  TabSessionResumer,
  type OpenedResumeTab,
  type TabResumeOpener,
} from '../resume/tab-session-resumer.js';
import { wireProjectIpc } from './project-ipc.js';

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
  // together for a verification run. SEEYA_APP_AUTO_END_DAY needs much longer: its own click
  // sequence (below) waits through TWO real endDay runs (a dry-run preview, then the real one),
  // each spawning a headless `claude -p` per eligible session — 2500ms is nowhere near enough for
  // that to finish before this captures.
  await clock.sleep(process.env.SEEYA_APP_AUTO_END_DAY === '1' ? 8000 : 2500);
  const image = await window.webContents.capturePage();
  const { writeFile } = await import('node:fs/promises');
  await writeFile(screenshotPath, image.toPNG());
  const quitAfterMs = Number(process.env.SEEYA_APP_QUIT_AFTER_MS ?? '');
  if (Number.isFinite(quitAfterMs)) {
    await clock.sleep(quitAfterMs);
    app.quit();
  }
}

/**
 * V2-T17 item 4: opt-in instrumentation for the "time until the session list is on screen"
 * measurement (`docs/DESEMPENHO.md`). Writes the wall-clock instant (via the injected `Clock`,
 * D-019 — `process.hrtime`/`Date.now()` are banned outside `adapters/clock/` by
 * `eslint.config.js`'s own rule, which does not exempt this directory) at which the FIRST
 * `sessionsUpdate` reached the renderer, to the file `SEEYA_APP_STARTUP_TIMING_PATH` names.
 *
 * **What this measures, precisely (D-025):** the instant `main.ts` sent the sidebar data over
 * IPC, not the instant Chromium painted it — the two are microseconds apart next to the
 * multi-hundred-millisecond `SessionProvider.list()` call that precedes this send (this file's
 * own `REFRESH_INTERVAL_MS` docstring has the ~0.24s measurement), so this is close enough for a
 * "how long until the list appears" budget without adding a second IPC round trip just to have
 * the renderer confirm its own paint.
 *
 * A measurement script spawns this process, records its own launch instant with the OS clock,
 * and subtracts this file's timestamp from it — both instants come from the same machine's
 * clock, so comparing across the two processes is safe even though neither one reads the other's
 * clock directly. Same "instrumentação só do spike" discipline as every other `SEEYA_APP_*` flag
 * in this file: unset in every normal run, never read by `npm run app`.
 */
async function writeStartupTiming(clock: Clock, timingPath: string): Promise<void> {
  const payload = JSON.stringify({ sessionsListSentAt: clock.now().toISOString() });
  await writeFile(timingPath, payload, 'utf8');
}

function createWindow(clock: Clock): BrowserWindow {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
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
  // SEEYA_APP_AUTO_END_DAY: same "instrumentação só do spike" class as the three above — clicks
  // the real "End day..." button, waits for the real dry-run preview to arrive (it spawns a real
  // headless `claude -p` per eligible session, so this is not instant), then clicks "Run end-day
  // now" and waits for the real run to finish, so an agent with no keyboard/mouse of its own can
  // prove V2-T5a's own aceite: the preview shows N sessions and the cost ceiling, and the dialog
  // ends up showing the final report — the same literal text `seeya end-day` prints. Never set by
  // `npm run app` or the README.
  if (process.env.SEEYA_APP_AUTO_END_DAY === '1') {
    window.webContents.once('did-finish-load', () => {
      void clock
        .sleep(500)
        .then(() =>
          window.webContents.executeJavaScript(
            "document.getElementById('end-day-button').click();",
          ),
        )
        .then(() => clock.sleep(3000))
        .then(() =>
          window.webContents.executeJavaScript(
            "document.getElementById('end-day-dialog-run')?.click();",
          ),
        );
    });
  }
  // SEEYA_APP_AUTO_SNOOZE_15: same "instrumentação só do spike" class as the four above — clicks
  // the real "Snooze +15m" button in the faixa de horário (V2-T5b item 1), so an agent with no
  // keyboard/mouse of its own can prove the click round trip actually persists: `estado.json`
  // gains `snoozeMinutesTotal: 15` and the faixa's own text updates immediately (not waiting for
  // the next ambient refresh tick). Never set by `npm run app` or the README.
  if (process.env.SEEYA_APP_AUTO_SNOOZE_15 === '1') {
    window.webContents.once('did-finish-load', () => {
      void clock
        .sleep(500)
        .then(() =>
          window.webContents.executeJavaScript(
            "document.getElementById('schedule-strip-snooze-15')?.click();",
          ),
        );
    });
  }
  // SEEYA_APP_AUTO_TOGGLE_SIDEBAR: same "instrumentação só do spike" class as the six above —
  // clicks the real toolbar sidebar-toggle button (maintainer acceptance, 2026-09-25: the original
  // 20px side-strip toggle wasn't discoverable on its own), so an agent with no keyboard/mouse of
  // its own can prove the button is visible in the toolbar and flips the sidebar from open to
  // collapsed in a single real screenshot — the companion run with this flag unset already shows
  // the open state, so the pair covers "both states" without any code here needing to decide
  // which one to show. Never set by `npm run app` or the README.
  if (process.env.SEEYA_APP_AUTO_TOGGLE_SIDEBAR === '1') {
    window.webContents.once('did-finish-load', () => {
      void clock
        .sleep(500)
        .then(() =>
          window.webContents.executeJavaScript(
            "document.getElementById('sidebar-toggle-button')?.click();",
          ),
        );
    });
  }
  // SEEYA_APP_AUTO_EDIT_SETTINGS: same "instrumentação só do spike" class as the five above —
  // opens the real Settings dialog (V2-T14), saves a valid `endOfDayTime` value first (proving
  // items 1 and 3 together: that row's own origin flips from "seeya default" to "set in
  // config.json", and the faixa de horário in the sidebar updates immediately — no restart of the
  // window or the daemon) and only THEN tries an invalid `relevanceHours` value (proving item 2's
  // refusal: the row's own error text stays put, nothing is written). The invalid attempt has to
  // come LAST — a successful save re-renders every row (so no OTHER row's `origin` goes stale next
  // to the one that changed, this file's own `saveSetting` handler docstring), which would wipe an
  // earlier row's error text right back off screen before the screenshot below ever fires. Never
  // set by `npm run app` or the README.
  if (process.env.SEEYA_APP_AUTO_EDIT_SETTINGS === '1') {
    window.webContents.once('did-finish-load', () => {
      void clock
        .sleep(500)
        .then(() =>
          window.webContents.executeJavaScript(
            "document.getElementById('settings-button').click();",
          ),
        )
        .then(() => clock.sleep(500))
        .then(() =>
          window.webContents.executeJavaScript(
            'const validRow = document.querySelector(\'.settings-row[data-key="endOfDayTime"]\'); ' +
              "validRow.querySelector('.settings-row-input').value = '09:15'; " +
              "validRow.querySelector('.settings-row-save').click();",
          ),
        )
        .then(() => clock.sleep(300))
        .then(() =>
          window.webContents.executeJavaScript(
            'const invalidRow = document.querySelector(\'.settings-row[data-key="relevanceHours"]\'); ' +
              "invalidRow.querySelector('.settings-row-input').value = '-5'; " +
              "invalidRow.querySelector('.settings-row-save').click();",
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
  // V2-T9 item 4: the sidebar's own rows from the MOST RECENT refresh tick (below) — "Today"'s
  // own getTodayPanel handler reuses this instead of a second SessionProvider.list() call, per
  // the plan entry's own "a partir da descoberta de sessões que ele já faz a cada ciclo". Empty
  // until the first tick runs, which is fine (D-025): no session is "running now" before this
  // window has ever discovered any.
  let latestSidebarRows: readonly SidebarRow[] = [];
  // V2-T18 item 2: the "Today" panel's own lookup/cwd-history from the last time getTodayPanel
  // below actually built them (window startup, or after resumeSelected/endDayRun refetch it) —
  // the refresh tick reuses these AS-IS, layering in only a fresh liveSessionIds
  // (refreshTodayPanelLiveness's own docstring), instead of repeating findPendingBriefing/
  // readCwdHistory's own storage scans every REFRESH_INTERVAL_MS. `null` until the first
  // getTodayPanel call resolves, which is fine (D-025): the tick below just skips that push.
  let latestTodayPanelInputs: TodayPanelInputs | null = null;
  // V2-T4 item 3: at most one truly pending in production (`resumeSessions`'s own sequential
  // loop), but keyed independently by requestId anyway — `PendingFallbackRequests`'s own docstring.
  const pendingFallbackRequests = new PendingFallbackRequests();
  // V2-T4 item 2: lets the SAME onExit callback below also notify TabSessionResumer's
  // fast-failure race for the specific tabs it opened — ExitListenerRegistry's own docstring.
  const exitListenerRegistry = new ExitListenerRegistry();
  let nextResumeTabId = 0;
  // V2-T5a item 4: "a execução ... uma por vez" — the renderer already disables "Run end-day now"
  // while `running`, but this is the same defense-in-depth `ipcMain.handle(CHANNELS.resumeSelected`
  // above relies on the renderer alone for (no second guard there) — end-day gets one anyway
  // because a REAL run terminates opted-in sessions (D-002), a consequence worth refusing a stray
  // concurrent call over rather than trusting the renderer alone.
  let endDayRunInProgress = false;
  // V2-T17 item 4: set once the first `sessionsUpdate` of this window's lifetime has been sent —
  // `writeStartupTiming`'s own docstring has the reasoning. `SEEYA_APP_STARTUP_TIMING_PATH` unset
  // (every normal run) means this flag is simply never consulted.
  let startupTimingWritten = false;

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

  // V2-T30: the "Projects" section's own IPC (New project/Open/Adopt) — kept in its own module so
  // this file doesn't grow (see project-ipc.ts's own docstring). Reuses the SAME tabResumeOpener
  // above: mounting a tab UI for an already-spawned pty was never resume-specific.
  const projectIpc = wireProjectIpc(window, context, tabResumeOpener, () => latestSidebarRows);

  // V2-T3: fetched once by `renderer.ts#main`, before any `new Terminal({...})` is constructed —
  // the two-way handshake (`invoke`, not `send`) matches `createTab` below, the only other channel
  // the renderer needs a value back from. V2-T16: `AppContext.initialTerminalFontOptions` is
  // already the resolved shape (read once, at startup, on purpose — see that field's own
  // docstring), so this handler needs no `Config` read of its own.
  ipcMain.handle(
    CHANNELS.getTerminalFontConfig,
    (): TerminalFontConfigResponse => context.initialTerminalFontOptions,
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
  //
  // V2-T9 item 1/2: one readCwdHistory per handoff in the found briefing, over the SAME
  // maxBriefingScanDays ceiling — a session's directory history never reaches further back than
  // the scan that found `lookup.briefing.day` in the first place. Skipped entirely when nothing
  // was found (nothing to build a history for).
  //
  // V2-T16: `maxBriefingScanDays` is read fresh from `config.json` every time this panel is
  // opened, never a value cached from window startup — same discipline `getSettingsPanel` below
  // already follows.
  ipcMain.handle(CHANNELS.getTodayPanel, async (): Promise<TodayPanelResponse> => {
    const config = await context.storage.readConfig();
    const lookup = await findPendingBriefing(
      context.storage,
      context.clock,
      config.maxBriefingScanDays,
    );
    if (!lookup.found) {
      latestTodayPanelInputs = { lookup, cwdHistoryBySessionId: new Map() };
      return buildTodayPanelData(lookup);
    }
    const cwdHistoryEntries = await Promise.all(
      lookup.briefing.handoffs.map(async (handoff) => {
        const history = await readCwdHistory(
          {
            storage: context.storage,
            directoryExistence: context.directoryExistence,
            platformHint: context.platformHint,
          },
          handoff.sessionId,
          lookup.briefing.day,
          config.maxBriefingScanDays,
        );
        return [handoff.sessionId, history] as const;
      }),
    );
    // V2-T9 item 4: "running now" from THIS session's own most recent discovery, not from
    // resumed.json — see buildLiveSessionIndex's own docstring for why the two disagree.
    const liveSessionIds = buildLiveSessionIndex(latestSidebarRows);
    const cwdHistoryBySessionId = new Map(cwdHistoryEntries);
    // V2-T18 item 2: cached for the refresh tick below (refreshTodayPanelLiveness) — the lookup
    // and cwd history just built here stay valid until the next getTodayPanel call; only
    // liveness needs to be fresh every tick.
    latestTodayPanelInputs = { lookup, cwdHistoryBySessionId };
    return buildTodayPanelData(lookup, cwdHistoryBySessionId, liveSessionIds);
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
      // V2-T9 item 2: a chosen directory overrides the handoff's own `cwd` for THIS resume
      // attempt only — nothing is rewritten to `~/.seeya/` (the panel's own note, D-039). A
      // sessionId absent from `chosenCwdBySessionId` had no selector to choose from at all (a
      // single-directory history), so the handoff's own `cwd` is used unchanged.
      const handoffs: readonly Handoff[] = (briefing?.handoffs ?? [])
        .filter((handoff) => wanted.has(handoff.sessionId))
        .map((handoff) => {
          const chosenCwd = request.chosenCwdBySessionId[handoff.sessionId];
          return chosenCwd === undefined ? handoff : { ...handoff, cwd: chosenCwd };
        });

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

  // V2-T5a item 1: "End day..." — the dry-run preview shown as the confirmation itself (D-039,
  // D-002: this NEVER writes a handoff or terminates a process — dryRun: true stops every write
  // right before it happens, application/end-day.ts's own top comment). skipGeneration: true
  // (review fix) means this NEVER calls a real generator either — unlike `seeya end-day --dry-run`
  // itself (whose own contract, S2-T5, still calls the real lean generator during a dry run: a
  // command the person already decided to run), a preview the person has NOT confirmed anything
  // for yet must not spend a real, billed model call — see EndDayOptions.skipGeneration's own
  // docstring for the full reasoning. The report text is still formatEndDayReport's own literal
  // rendering (the SAME function `seeya end-day` uses, V2-T5a item 2), just fed a result whose
  // sessions never had the model actually called — so its CONTENT differs from
  // `seeya end-day --dry-run` for lean sessions specifically, honestly (D-025): no "understanding"
  // this preview never produced. The cost ceiling has no CLI equivalent, so it's computed here.
  //
  // V2-T16: `config` is read fresh, right here, for the report/cost-ceiling rendering — `endDay`
  // itself already reads its own fresh copy internally (`application/end-day.ts`'s own
  // `storage.readConfig()` call), so this was never about `endDay`'s behavior; it was `main.ts`
  // formatting the RESULT against a config snapshot taken at window startup.
  ipcMain.handle(CHANNELS.endDayPreview, async (): Promise<EndDayPreviewResponse> => {
    const result = await endDay(toEndDayDeps(context), {
      dryRun: true,
      skipGeneration: true,
      scope: { kind: 'fullDay' },
    });
    const config = await context.storage.readConfig();
    return {
      reportText: formatEndDayReport(result, config),
      costCeiling: buildEndDayCostCeiling(result.sessionsInScope, config),
    };
  });

  // V2-T5a item 4: "Run end-day now" — the real run (dryRun: false), notified through the SAME
  // Notifier/buildEndDayNotice seeya end-day uses (composition/index.ts#buildAppContext wires the
  // real adapter, D-020). The status panel picks up whatever this run wrote/terminated on its own
  // next tick (runRefreshLoop below, at most REFRESH_INTERVAL_MS away — no separate push needed);
  // the "Today" panel is refreshed explicitly by the renderer right after this resolves
  // (renderer.ts#handleEndDayRunClicked), the same "refresh after a write" shape
  // handleResumeSelected already has for the resume flow.
  ipcMain.handle(CHANNELS.endDayRun, async (): Promise<EndDayRunResponse> => {
    if (endDayRunInProgress) {
      throw new Error('an end-day run is already in progress');
    }
    endDayRunInProgress = true;
    try {
      const result = await endDay(toEndDayDeps(context), {
        dryRun: false,
        scope: { kind: 'fullDay' },
        onCaptureProgress: (event) => {
          const projected = projectEndDayProgressEvent(event);
          if (projected !== null) {
            window.webContents.send(CHANNELS.endDayProgress, projected);
          }
        },
      });
      const notice = buildEndDayNotice(result);
      if (notice !== null) {
        try {
          await context.notifier.notify(notice);
        } catch {
          // Same discipline as cli/end-day-command.ts#notifyEndDayResult: a broken notifier must
          // never derail the day's own ending.
        }
      }
      // V2-T16: fresh read, same reasoning as `endDayPreview` above.
      const config = await context.storage.readConfig();
      return { reportText: formatEndDayReport(result, config) };
    } finally {
      endDayRunInProgress = false;
    }
  });

  // V2-T5b item 1: "Snooze +15m/+30m/+1h" / "Skip today" — both run the SAME orchestration
  // `application/schedule-adjustments.js` gives the CLI's own `snooze`/`skip-today` commands
  // (item 2), and return the freshly recomputed strip so the faixa updates immediately instead of
  // waiting for the next ambient `onTick` below (which will also reflect it, harmlessly, at most
  // REFRESH_INTERVAL_MS later).
  //
  // V2-T16: `snoozeTodayNow`/`skipTodayNow` (`state/schedule-actions.ts`) read `config.json`
  // fresh themselves — this used to pass `context.config` (a snapshot from window startup)
  // straight through, which is the bug this task fixes; see that module's own docstring.
  ipcMain.handle(
    CHANNELS.snoozeToday,
    async (_event, request: SnoozeTodayRequest): Promise<ScheduleUpdateEvent> =>
      snoozeTodayNow(context.storage, context.clock, request.minutes),
  );

  ipcMain.handle(CHANNELS.skipToday, async (): Promise<ScheduleUpdateEvent> =>
    skipTodayNow(context.storage, context.clock),
  );

  // V2-T5b item 3: "Start daemon"/"Stop daemon" — the renderer decides WHICH action from its own
  // last-known `DaemonControlAvailability` (never re-derived here, D-041); this handler just runs
  // it and hands back the literal result text.
  //
  // V2-T21 item 1: the response ALSO carries the freshly recomputed availability (a `checkLiveLock`
  // right after the action, same call `buildStatusPanelText`'s own `describeDaemonState` and the
  // ambient tick below already make) — the measured defect was the button staying mislabeled, and
  // a click in that window sending the stale action, for up to `REFRESH_INTERVAL_MS` until the
  // next ambient tick's own `availabilityUpdated` caught up.
  ipcMain.handle(
    CHANNELS.daemonControl,
    async (_event, request: DaemonControlRequest): Promise<DaemonControlResponse> => {
      const resultText =
        request.action === 'start' ? await context.startDaemon() : await context.stopDaemon();
      const liveLockCheck = await checkLiveLock({
        storage: context.storage,
        processControl: context.processControl,
        clock: context.clock,
      });
      return { resultText, availability: resolveDaemonControlAvailability(liveLockCheck) };
    },
  );

  // V2-T14 item 1: the Settings dialog's own rows — re-read from disk on every open (never cached,
  // unlike `getTerminalFontConfig`: `seeya config set` in another terminal, or this same dialog's
  // own previous save, must always be reflected the next time it's opened).
  ipcMain.handle(CHANNELS.getSettingsPanel, async (): Promise<SettingsPanelResponse> => {
    const config = await context.storage.readConfig();
    return { rows: buildSettingsRows(config), projectPolicyLines: buildProjectPolicyLines(config) };
  });

  // V2-T14 items 2/3: "Save" on one Settings row — the SAME validation/write path `seeya config
  // set` uses (`parseConfigFieldUpdate`/`applyConfigFieldUpdate` + `Storage.saveConfig`), never a
  // second validation of its own. On success, the faixa de horário is recomputed right here from
  // the value that was just written — `decideSchedule` needs `dayState` too, read fresh the same
  // way `runRefreshLoop`'s own `onTick` below already does, never a stale one from an earlier tick.
  ipcMain.handle(
    CHANNELS.saveSetting,
    async (_event, request: SaveSettingRequest): Promise<SaveSettingResponse> => {
      const parsed = parseConfigFieldUpdate(request.key, request.rawValue);
      if (!parsed.ok) {
        return { ok: false, error: parsed.error };
      }
      const current = await context.storage.readConfig();
      const updated = applyConfigFieldUpdate(current, parsed.key, parsed.value);
      await context.storage.saveConfig(updated);

      const now = context.clock.now();
      const today = localDayString(now);
      const dayState = (await context.storage.readState()) ?? emptyDayState(today);
      const { decision } = decideSchedule(updated, dayState, now);
      return {
        ok: true,
        rows: buildSettingsRows(updated),
        schedule: buildScheduleStripData(decision, now),
      };
    },
  );

  // V2-T13 item 4: "Enable autostart"/"Disable autostart" — the button only ever shows when
  // `context.daemonOwner.kind === 'app'` (the renderer's own availability decides which action to
  // send, same D-041 discipline `daemonControl` above already follows); `enableAppAutostart`
  // registers the app's own daemon target (Electron's binary + ELECTRON_RUN_AS_NODE=1), never the
  // bare CLI-style `Autostart.enable(binaryPath)` call.
  //
  // V2-T21 item 1: the measured defect. `autostartCache` (`state/autostart-cache.ts`) is only
  // refreshed by the ambient tick below, every `DEFAULT_AUTOSTART_REFRESH_INTERVAL_MS` (60s) — left
  // untouched here, the label stayed wrong for up to a minute AND a click landing in that window
  // sent the STALE action (the mantenedor's own "Autostart was already disabled. Nothing
  // changed."). This handler now forces a fresh `Autostart.status()` right after the action
  // (`resolveAutostartReport` with `entry: null`, the same helper the ambient tick uses, never a
  // second implementation of "when is the cache stale"), so both the cache AND the response's own
  // `availability` reflect what just happened, not what was true before the click.
  ipcMain.handle(
    CHANNELS.autostartControl,
    async (_event, request: AutostartControlRequest): Promise<AutostartControlResponse> => {
      const resultText =
        request.action === 'enable'
          ? formatAutostartEnableResult(await context.enableAppAutostart())
          : formatAutostartDisableResult(await context.autostart.disable());
      autostartCache = await resolveAutostartReport(
        null,
        context.clock.now(),
        DEFAULT_AUTOSTART_REFRESH_INTERVAL_MS,
        () => context.autostart.status(),
      );
      return {
        resultText,
        availability: resolveAutostartControlAvailability(
          context.daemonOwner,
          autostartCache.status,
        ),
      };
    },
  );

  // V2-T13 item 5 (D-045 item 1): fetched once at startup — see `renderer.ts`'s own `main()`.
  ipcMain.handle(
    CHANNELS.getDaemonOwnershipTransitionOffer,
    async (): Promise<DaemonOwnershipTransitionOfferResponse> => {
      const shouldOffer = await context.checkDaemonOwnershipTransitionOffer();
      return {
        shouldOffer,
        launchPath: context.daemonOwner.kind === 'app' ? context.daemonOwner.launchPath : '',
      };
    },
  );

  ipcMain.handle(
    CHANNELS.answerDaemonOwnershipTransition,
    async (_event, request: AnswerDaemonOwnershipTransitionRequest): Promise<void> => {
      await context.applyDaemonOwnershipTransition(request.answer);
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
      // V2-T14 item 3 (V2-T16: `AppContext` no longer even HAS a startup config snapshot to reach
      // for by mistake): read fresh every tick, like `dayState` below already is — a
      // settings-panel save must never show correctly for one tick and then flip back to a stale
      // value on the next ambient refresh (at most REFRESH_INTERVAL_MS later). Reused for the
      // sidebar/status text too, so
      // the whole window agrees with itself about what's currently in config.json, not just the
      // faixa de horário the plan entry calls out by name.
      const liveConfig = await context.storage.readConfig();

      const rows = buildSidebarRows(discovery, liveConfig, now, tabs);
      // V2-T9 item 4: cached for getTodayPanel's own handler above — the same discovery this
      // cycle already did, never a second SessionProvider.list() call just for "Today".
      latestSidebarRows = rows;
      const sessionsEvent: SessionsUpdateEvent = { rows };
      window.webContents.send(CHANNELS.sessionsUpdate, sessionsEvent);

      // V2-T30: the "Projects" section, same tick — reuses `rows` above (no second discovery),
      // plus one small `.seeya-lock` read per project (the task's own declared cost). The FIRST
      // paint doesn't depend on this push arriving in time — see `CHANNELS.getProjectsPanel`'s own
      // docstring.
      await projectIpc.pushProjectsUpdate();

      const startupTimingPath = process.env.SEEYA_APP_STARTUP_TIMING_PATH;
      if (startupTimingPath !== undefined && !startupTimingWritten) {
        startupTimingWritten = true;
        await writeStartupTiming(context.clock, startupTimingPath);
      }

      // V2-T18 item 2: the "Today" panel tracks this same tick's own discovery — a session opened
      // outside the window stops showing "not running now" without a reload (the second achado
      // this task fixes). Reuses `latestTodayPanelInputs` untouched (no second findPendingBriefing/
      // readCwdHistory scan); skipped entirely until the window's own first getTodayPanel call has
      // populated that cache (refreshTodayPanelLiveness's own `null` case, D-025).
      const todayPanelData = refreshTodayPanelLiveness(
        latestTodayPanelInputs,
        buildLiveSessionIndex(rows),
      );
      if (todayPanelData !== null) {
        const todayEvent: TodayUpdateEvent = todayPanelData;
        window.webContents.send(CHANNELS.todayUpdate, todayEvent);
      }

      autostartCache = await resolveAutostartReport(
        autostartCache,
        now,
        DEFAULT_AUTOSTART_REFRESH_INTERVAL_MS,
        () => context.autostart.status(),
      );

      const text = await buildStatusPanelText({
        discovery,
        config: liveConfig,
        clock: context.clock,
        storage: context.storage,
        processControl: context.processControl,
        autostartReport: autostartCache.report,
      });
      const statusEvent: StatusUpdateEvent = { text };
      window.webContents.send(CHANNELS.statusUpdate, statusEvent);

      // V2-T5b item 1: the faixa de horário — same `decideSchedule` the daemon itself polls
      // every 30s, read fresh every tick (never cached: a snooze/skip typed in another terminal,
      // or the daemon's own poll, can change `estado.json` between ticks — D-025, the interface
      // never shows a stale decision on purpose).
      const today = localDayString(now);
      const dayState = (await context.storage.readState()) ?? emptyDayState(today);
      const { decision } = decideSchedule(liveConfig, dayState, now);
      const scheduleEvent: ScheduleUpdateEvent = buildScheduleStripData(decision, now);
      window.webContents.send(CHANNELS.scheduleUpdate, scheduleEvent);

      // V2-T5b item 3: a SECOND checkLiveLock this tick (buildStatusPanelText's own
      // describeDaemonState already did one for the status panel's text) — a deliberate,
      // measured-acceptable cost (the SAME ~0.24-0.88s class this file's own REFRESH_INTERVAL_MS
      // docstring already accepts once per tick for describeDaemonState), not shared: threading a
      // precomputed LiveLockCheck INTO describeDaemonState would mean changing that function's own
      // signature for a caller outside its existing two (seeya status/--status), which is a
      // bigger change than this task's own scope.
      const liveLockCheck = await checkLiveLock({
        storage: context.storage,
        processControl: context.processControl,
        clock: context.clock,
      });
      const daemonAvailabilityEvent: DaemonAvailabilityUpdateEvent =
        resolveDaemonControlAvailability(liveLockCheck);
      window.webContents.send(CHANNELS.daemonAvailabilityUpdate, daemonAvailabilityEvent);

      // V2-T13 item 4: from the SAME cached status `autostartReport` above already reads (never a
      // second Autostart.status() call, Q-071's own measurement).
      const autostartAvailabilityEvent: AutostartAvailabilityUpdateEvent =
        resolveAutostartControlAvailability(context.daemonOwner, autostartCache.status);
      window.webContents.send(CHANNELS.autostartAvailabilityUpdate, autostartAvailabilityEvent);
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

/**
 * V2-T5b item 5: focuses whichever window is already open — the `second-instance` handler's own
 * job when a `seeya://` click (or a person just double-clicking the app again) launches a SECOND
 * process while the interface is already running. Never opens a new one (mirrors the `activate`
 * handler below, which only creates a window when NONE exist at all).
 */
function focusExistingWindow(): void {
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
    // SEEYA_APP_OFFSCREEN/SEEYA_APP_SCREENSHOT_PATH above — `buildAppContext` already accepts a home
    // directory as a parameter for exactly this (every test in tests/integration/app/composition.test.ts
    // uses it against a tmpdir fixture, never the real home). Never set by `npm run app`.
    const context = await buildAppContext(process.env.SEEYA_APP_HOME_OVERRIDE);

    // V2-T10 item 1: the scheme THIS window registers — packaged installs still claim plain
    // `seeya`, a dev launch (`npm run app`) now claims `seeya-dev` instead, so the two worlds
    // never overwrite each other's registration (composition/protocol-scheme.ts's own docstring
    // has the full "achado" this replaces). Computed once, here, and reused by both the Windows
    // registration call below and (once item 2 lands) the marker write.
    const protocolScheme = resolveProtocolScheme(app.isPackaged);

    // V2-T5b item 5: Windows — the `seeya://`-shaped handler on Linux comes from the package's own
    // `.desktop` file and on macOS from its `Info.plist`, neither of which exists from a checkout
    // (only the installer task can write them); attempting `setAsDefaultProtocolClient` there
    // today would be a no-op at best (Electron's own docs: "this method is only implemented on
    // macOS and Windows") and a false claim in the marker at worst. `process.platform` read
    // directly here, not in `composition/index.ts`, matches this same file's own pre-existing
    // `window-all-closed` handler below — an Electron-lifecycle branch, not a choice of which
    // adapter to wire (composition/index.ts's own job).
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
