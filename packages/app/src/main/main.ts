/**
 * The Electron main process entry (D-042: the interface embeds the terminal; D-041: no logic of
 * its own — every decision below delegates to a pure module or to `composition/index.ts`). Wires
 * IPC (`ipc/channels.ts`) to `pty/pty-manager.ts`, `state/refresh-loop.ts` and the renderer's
 * `BrowserWindow`. Excluded from `packages/app/src`'s coverage floor (`vitest.config.ts`'s
 * `APP_ELECTRON_SOURCE`) — it cannot run without a display; everything it calls is unit-tested on
 * its own.
 */
import path from 'node:path';
import { appendFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, clipboard, ipcMain, Menu, nativeTheme } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
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
  FallbackConfirmRequestEvent,
  TodayPanelResponse,
  TodayUpdateEvent,
  ResumeSelectedRequest,
  ResumeSummaryResponse,
  ResumeProgressUpdateEvent,
  ResumeTabOpenedEvent,
  EndDayPreviewResponse,
  EndDayRunResponse,
  ScheduleUpdateEvent,
  ScheduleStripResponse,
  SnoozeTodayRequest,
  DaemonAvailabilityUpdateEvent,
  DaemonAvailabilityResponse,
  DaemonControlRequest,
  DaemonControlResponse,
  SettingsPanelResponse,
  SaveSettingRequest,
  SaveSettingResponse,
  AutostartAvailabilityUpdateEvent,
  AutostartAvailabilityResponse,
  AutostartControlRequest,
  AutostartControlResponse,
  DaemonOwnershipTransitionOfferResponse,
  AnswerDaemonOwnershipTransitionRequest,
  ThemeUpdateEvent,
  ResumeTabOpenedKind,
  ConfirmProjectLockOpenRequestEvent,
  ConfirmLeftoverChangesOpenRequestEvent,
  ChangedFileRow,
} from '../ipc/channels.js';
import type { Clock, AppInstallation } from '@seeya-ai/engine/core/ports.js';
import { systemClock } from '@seeya-ai/engine/adapters/clock/index.js';
import {
  applyConfigFieldUpdate,
  parseConfigFieldUpdate,
} from '@seeya-ai/engine/adapters/storage/config-schema.js';
import { saveConfigChange } from '@seeya-ai/engine/application/config-update.js';
import { checkLiveLock } from '@seeya-ai/engine/scheduler/daemon-state.js';
import { findPendingBriefing } from '@seeya-ai/engine/application/find-pending-briefing.js';
import { readCwdHistory } from '@seeya-ai/engine/application/cwd-history.js';
import { resumeSessions } from '@seeya-ai/engine/application/start-day.js';
import { endDay } from '@seeya-ai/engine/application/end-day.js';
import { buildEndDayNotice } from '@seeya-ai/engine/application/end-day-notice.js';
import { decideSchedule, decideUndoSnooze, emptyDayState } from '@seeya-ai/engine/core/schedule.js';
import { localDayString } from '@seeya-ai/engine/core/day.js';
import type { Config, Handoff } from '@seeya-ai/engine/core/types.js';
import {
  buildAppContext,
  toEndDayDeps,
  type AppContext,
  type BuildAppContextOverrides,
} from '../composition/index.js';
import { VerificationFakeHandoffGenerator } from '../composition/verification-fake-generator.js';
import { VerificationFakeAdoptionLauncher } from '../composition/verification-fake-adoption-launcher.js';
import { VerificationFakeHarnessLauncher } from '../composition/verification-fake-harness-launcher.js';
import { wrapWorkspaceWithFailingCommit } from '../composition/verification-fake-failing-commit.js';
import { FsWorkspaceRepository } from '@seeya-ai/engine/adapters/workspace/index.js';
import { shouldMarkLinuxProtocolRegistered } from '../composition/linux-protocol-marker.js';
import { resolveProtocolScheme, type ProtocolScheme } from '../composition/protocol-scheme.js';
import { shouldRegisterProtocolScheme } from '../composition/protocol-registration-eligibility.js';
import { resolveWindowIconPath } from '../composition/window-icon.js';
import { resolveWindowSize } from '../composition/window-size.js';
import { captureProjectResumeVerification } from './verify-project-resume.js';
import { captureWindowMinVerification } from './verify-window-min.js';
import {
  resolveApplicationMenuPolicy,
  type MenuEntry,
  type MenuSection,
} from '../composition/menu-policy.js';
import { MESSAGES } from '../text/messages.js';
import { buildEndDayCostCeiling } from '../state/end-day-preview.js';
import { buildEndDayPreviewRows, buildEndDayResultRows } from '../state/end-day-sessions.js';
import { projectEndDayProgressEvent } from '../state/end-day-progress.js';
import { buildScheduleStripData } from '../state/schedule-strip.js';
import { resolveDaemonControlAvailability } from '../state/daemon-control-panel.js';
import { resolveAutostartControlAvailability } from '../state/autostart-control-panel.js';
import { buildSettingsRows, buildProjectPolicyLines } from '../state/settings-panel.js';
import { snoozeTodayNow, skipTodayNow, undoSnoozeTodayNow } from '../state/schedule-actions.js';
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
import { resolveEffectiveTheme } from '../theme/resolve-theme.js';
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
import { wireProjectDetailsIpc } from './project-details-ipc.js';
import { captureProjectDetailsVerification } from './verification-project-details.js';
import { wireSessionSearchIpc } from './session-search-ipc.js';
import { wireSessionResumeIpc } from './session-resume-ipc.js';
import { wireDirectoryPickerIpc } from './directory-picker-ipc.js';

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

/** `SEEYA_APP_VERIFY_END_DAY_FAKE`'s own per-session artificial delay (V2-T69) — see that flag's
 * own comment, where `contextOverrides` is built, and the click-automation block below for the
 * full timing this buys a mid-flight "progress" screenshot. */
const END_DAY_FAKE_DELAY_MS = 2000;

/** `SEEYA_APP_VERIFY_ADOPTION_FAKE`'s own artificial delay (V2-T70) — long enough for a
 * screenshot taken right after clicking "Open the copy" to still show the dialog closed/the tab
 * in flight, short enough that the automation block driving this doesn't need its own long wait. */
const ADOPTION_FAKE_DELAY_MS = 300;

/**
 * `SEEYA_APP_VERIFY_END_DAY_FAKE`'s own screenshot delay per scenario (V2-T69) — `null` when the
 * flag isn't set at all, so `captureVerificationScreenshot`'s own ternary below falls through to
 * its other buckets unaffected. Timings line up with the click-automation block and
 * `END_DAY_FAKE_DELAY_MS` above, including that block's own 7400ms before the first click (3000ms
 * before even trying to dismiss a stray daemon-ownership dialog — measured empirically: its own
 * decline button stays disabled/"Working…" for a beat after the window loads — + 4400ms more
 * margin for the dialog's own async check, `usesV2T55Instrumentation`'s own measured "~1.3-4s on
 * EVERY call"): `'preview'` only needs the
 * dry-run round trip on top of that (fast — it never calls a generator, real or fake);
 * `'progress'`/`'hidden'` land partway through three sequential fake-delayed sessions (one
 * `captured`, one `capturing`, one `waiting`, `docs/INTERFACE.md` § 6 item 2); `'result'` waits
 * for all three plus the near-instant poisoned session (a pre-corrupted `~/.seeya` handoff, never
 * the generator — `evaluateFullEligibility`'s own documented "corruption is a visible failure"
 * path) to finish. `'result-long'` (PO review round 1, item 4's own 9th screenshot) is the same
 * wait as `'result'` — its extra rows are all cheap-ineligible/closed sessions the fixture adds,
 * none of which ever touch the fake generator's own delay, so the real run finishes no slower.
 */
function resolveEndDayFakeScreenshotDelayMs(scenario: string | undefined): number | null {
  switch (scenario) {
    case 'preview':
      return 9000;
    case 'progress':
      return 11500;
    case 'hidden':
      return 12000;
    case 'result':
    case 'result-long':
      return 21000;
    default:
      return null;
  }
}

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
 * V2-T66 bug fix: every `captureXVerification` function below used to compute
 * `Number(process.env.SEEYA_APP_QUIT_AFTER_MS ?? '')` and check `Number.isFinite(...)` inline —
 * `Number('')` is `0` in JavaScript, not `NaN`, so leaving the variable UNSET (every normal run,
 * and every verification run that only wants a screenshot while the window stays open) was
 * silently read as "quit after 0ms", quitting the app the instant the LAST capture finished
 * regardless of intent. Found while chasing a real defect in this task's own two-screenshot
 * capture (`captureResumeProgressThenResult`): the app quit before its own SECOND capture ever
 * ran. Fixed once, here, shared by every capture function — `undefined`/unset now genuinely means
 * "never quit on its own", matching what every one of these functions' own docstrings already
 * claimed.
 */
async function quitAfterConfiguredDelay(clock: Clock): Promise<void> {
  const raw = process.env.SEEYA_APP_QUIT_AFTER_MS;
  if (raw === undefined) {
    return;
  }
  const quitAfterMs = Number(raw);
  if (Number.isFinite(quitAfterMs)) {
    await clock.sleep(quitAfterMs);
    app.quit();
  }
}

/**
 * SEEYA_APP_VERIFY_HOLD_SKIP_MS (V2-T79): holds the real `CHANNELS.skipToday` IPC response
 * pending for the given number of milliseconds before it resolves — "instrumentação que segura
 * uma ação pendente" (this task's own prescribed technique for proving a `loading` button stays
 * centered), rather than racing a screenshot against `skipTodayNow`'s own near-instant local
 * write (which a fixed sleep before capturing could miss on a slower CI machine, or catch too
 * early on a faster one). `skipTodayNow` itself is unchanged — this only delays HANDING BACK its
 * already-computed result, so the write to the disposable `estado.json` this runs against still
 * happens exactly once, synchronously with the real call, never duplicated or faked. Never read
 * by `npm run app` or the README; absent, this is a no-op (`undefined`/non-finite both pass
 * straight through, same guard shape as `quitAfterConfiguredDelay` above).
 */
async function holdForVerification(clock: Clock): Promise<void> {
  const raw = process.env.SEEYA_APP_VERIFY_HOLD_SKIP_MS;
  if (raw === undefined) {
    return;
  }
  const holdMs = Number(raw);
  if (Number.isFinite(holdMs)) {
    await clock.sleep(holdMs);
  }
}

/**
 * SEEYA_APP_VERIFY_HOLD_DAEMON_OWNERSHIP_ANSWER_MS (V2-T71): same "instrumentação que segura uma
 * ação pendente" technique as `holdForVerification`/`SEEYA_APP_VERIFY_HOLD_SKIP_MS` above, for the
 * daemon-ownership transition dialog's own `Leave it as it is` click — `saveDaemonOwnershipTransitionAnswer('declined')`
 * is a harmless, near-instant write to the FIXTURE's own `daemon-ownership-transition.json`
 * (`composition/daemon-ownership-transition.ts`'s own docstring: `'declined'` never touches a
 * real daemon or autostart), but a screenshot proving the button's own `loading` state needs the
 * response held open long enough to land inside that window, same reasoning as the skip-today
 * case. Never read by `npm run app` or the README; absent, a no-op.
 */
async function holdForDaemonOwnershipVerification(clock: Clock): Promise<void> {
  const raw = process.env.SEEYA_APP_VERIFY_HOLD_DAEMON_OWNERSHIP_ANSWER_MS;
  if (raw === undefined) {
    return;
  }
  const holdMs = Number(raw);
  if (Number.isFinite(holdMs)) {
    await clock.sleep(holdMs);
  }
}

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
  // that to finish before this captures. This category's own flags (`SEEYA_APP_AUTO_DECLINE_
  // DAEMON_OWNERSHIP_TRANSITION`/`SEEYA_APP_AUTO_RESIZE_SIDEBAR`/`SEEYA_APP_AUTO_VERIFY_
  // DIALOG_FOCUS_RETURN_PATH`/`SEEYA_APP_AUTO_OPEN_SESSIONS_TAB`, V2-T55/V2-T68) each start with a
  // defensive dismiss of the (unrelated) daemon-ownership-transition dialog on a machine where
  // `seeya` is already installed — measured on one such machine: that dialog's own decline click
  // stays on an async "Working…" state for up to several seconds (its own check queries the real
  // Windows Task Scheduler, `composition/index.ts#BuildAppContextOverrides`'s own docstring
  // already measured that at "~1.3-4s on EVERY call") before closing, so a verification run using
  // any of these flags gets a longer window too.
  const usesV2T55Instrumentation =
    process.env.SEEYA_APP_AUTO_DECLINE_DAEMON_OWNERSHIP_TRANSITION === '1' ||
    process.env.SEEYA_APP_AUTO_RESIZE_SIDEBAR === '1' ||
    process.env.SEEYA_APP_AUTO_VERIFY_DIALOG_FOCUS_RETURN_PATH !== undefined ||
    process.env.SEEYA_APP_AUTO_OPEN_SESSIONS_TAB === '1';
  // V2-T64: the tab strip demo's own sequence (several tabs opened/closed/fabricated one after
  // another, each step waiting a real IPC round trip or a real exit) runs longer than any single
  // click above but needs none of the "Working…" daemon-ownership delay the V2-T55 category
  // exists for — its own window, not folded into either number above.
  const usesTabStripDemo =
    process.env.SEEYA_APP_AUTO_TAB_STRIP_DEMO === '1' ||
    process.env.SEEYA_APP_AUTO_OPEN_NEW_TAB_POPOVER === '1';
  // SEEYA_APP_VERIFICATION_TAB_PID_PATH (V2-T75 PO review, round 3, item 4): the longest bucket of
  // all — a verification run using this flag needs time for an EXTERNAL process to read the pid
  // this file's own `createTab` handler just wrote, fold it into the fixture's own session file on
  // disk, AND for the ambient refresh loop's next tick (`REFRESH_INTERVAL_MS`, 10s) to re-read that
  // change and push the `openHere` badge it produces — none of which this process controls the
  // timing of.
  const usesTabPidFixture = process.env.SEEYA_APP_VERIFICATION_TAB_PID_PATH !== undefined;
  // SEEYA_APP_AUTO_TERMINAL_RESIZE_REPRO's own click sequence (open tab, wait for the shell's own
  // banner, type, switch to a page tab, collapse, expand, switch back) sums to roughly 5.2s of
  // scheduled sleeps alone, each followed by a real `executeJavaScript` round trip on top.
  const usesTerminalResizeRepro = process.env.SEEYA_APP_AUTO_TERMINAL_RESIZE_REPRO === '1';
  // V2-T50: both flags below wait on a real IPC round trip or two (open menu, click, save) before
  // the strip they exist to show has settled — longer than the default 2500ms, shorter than the
  // daemon-ownership bucket, which they do not need.
  const usesSnoozeUndoInstrumentation =
    process.env.SEEYA_APP_AUTO_UNDO_SNOOZE === '1' ||
    process.env.SEEYA_APP_AUTO_SET_END_OF_DAY !== undefined;
  // PO review (V2-T75, 2026-10-01, round 2): `usesV2T55Instrumentation`'s own bucket was bumped
  // from 7000ms to 22000ms here as a band-aid for a real production defect — `useSidebar.ts`'s own
  // `projects`/`today` state used to be driven ONLY by the `CHANNELS.projectsUpdate`/`todayUpdate`
  // PUSH, with the "first paint" `getProjectsPanel`/`getTodayPanel` invoke's own return value
  // called and thrown away. The ambient loop's FIRST tick (`REFRESH_INTERVAL_MS`, 10s) fires
  // before the renderer's own `<script>` has necessarily registered its `onProjectsUpdate`
  // listener, so the sidebar only got real data on the SECOND tick, up to `REFRESH_INTERVAL_MS * 2`
  // later — hence 22000ms.
  //
  // PO review (round 3): that was the wrong fix — waiting longer hid the defect instead of fixing
  // it (the REAL window showed the same empty state for the same 10-20s on every open, not just
  // this verification script). `useIpcSubscription.ts`'s own `fetchInitial` parameter now seeds
  // `useSidebar.ts`/`useSidebarFooter.ts`'s state from the invoke's answer as soon as it resolves,
  // so the sidebar has real data within one IPC round trip, independent of the ambient tick
  // entirely. Reverted to the original 7000ms bucket, whose reasoning (below) was never about this
  // race in the first place: it covers `SEEYA_APP_AUTO_DECLINE_DAEMON_OWNERSHIP_TRANSITION`'s own
  // measured "~1.3-4s on EVERY call" `checkDaemonOwnershipTransitionOffer` round trip plus a
  // buffer, the one genuinely slow step this category's flags still share.
  await clock.sleep(
    resolveEndDayFakeScreenshotDelayMs(process.env.SEEYA_APP_VERIFY_END_DAY_FAKE) ??
      (process.env.SEEYA_APP_AUTO_END_DAY === '1'
        ? 8000
        : usesTabPidFixture
          ? 35000
          : usesTerminalResizeRepro
            ? 8000
            : usesV2T55Instrumentation
              ? 7000
              : usesSnoozeUndoInstrumentation
                ? 6000
                : usesTabStripDemo
                  ? 4500
                  : 2500),
  );
  const image = await window.webContents.capturePage();
  const { writeFile } = await import('node:fs/promises');
  await writeFile(screenshotPath, image.toPNG());
  await quitAfterConfiguredDelay(clock);
}

/**
 * V2-T65: the one capture this window supports two screenshots from, WITHOUT a restart in
 * between — every other `SEEYA_APP_*` flag that needs a "before"/"after" pair instead launches
 * TWO separate processes (the V2-T75-terminal-resize task's own before/after reproduction).
 * `docs/INTERFACE.md`'s own aceite for this task needs the opposite: Settings' own `Theme`
 * segmented control has to apply LIVE, in the SAME running window — a second process could only
 * ever prove two DIFFERENT windows agree, never that one window changed without reopening.
 *
 * Opens Settings (General is the default section), captures BEFORE, clicks the `Dark` segment
 * (the real `saveSetting` round trip `main/main.ts`'s own handler now pushes `themeUpdate` from,
 * this task's own production fix), waits for the live repaint, captures AFTER — both screenshots
 * show the SAME dialog, same General section, same installed version, proving both "General in
 * each theme" and "the switch applies without a restart" in one pass.
 */
async function captureLiveThemeToggleVerification(
  window: BrowserWindow,
  clock: Clock,
  beforePath: string,
  afterPath: string,
): Promise<void> {
  const { writeFile } = await import('node:fs/promises');
  await clock.sleep(2500);
  await window.webContents.executeJavaScript("document.getElementById('settings-button').click();");
  await clock.sleep(500);
  const before = await window.webContents.capturePage();
  await writeFile(beforePath, before.toPNG());
  await window.webContents.executeJavaScript(
    "document.getElementById('settings-theme-option-dark').click();",
  );
  await clock.sleep(500);
  const after = await window.webContents.capturePage();
  await writeFile(afterPath, after.toPNG());
  await quitAfterConfiguredDelay(clock);
}

/**
 * Maintainer-found defect, V2-T65-estado-na-tela item 1: `SettingsDialog`'s own `<dialog>` used to
 * stay visually painted — and clickable-through — after a real `Done` click, until some UNRELATED
 * state change forced a re-render (`SettingsDialog.module.css`'s own `.dialog` setting `display`
 * unconditionally, which always wins over the UA stylesheet's own `dialog:not([open]) { display:
 * none }` regardless of specificity). Same two-screenshot, same-window shape as
 * `captureLiveThemeToggleVerification` above (its own docstring explains why a before/after pair
 * needs to share one window rather than two separate processes) — here the "after" state is
 * "closed", proven by a screenshot taken the instant after `Done`, with NOTHING else in between.
 */
async function captureSettingsCloseVerification(
  window: BrowserWindow,
  clock: Clock,
  openPath: string,
  closedPath: string,
): Promise<void> {
  const { writeFile } = await import('node:fs/promises');
  await clock.sleep(2500);
  await window.webContents.executeJavaScript("document.getElementById('settings-button').click();");
  await clock.sleep(500);
  const open = await window.webContents.capturePage();
  await writeFile(openPath, open.toPNG());
  await window.webContents.executeJavaScript(
    "document.getElementById('settings-dialog-done').click();",
  );
  const closed = await window.webContents.capturePage();
  await writeFile(closedPath, closed.toPNG());
  await quitAfterConfiguredDelay(clock);
}

/**
 * V2-T66: the Today tab's own resume progress/result, from the SAME `SEEYA_APP_AUTO_RESUME_ALL`
 * click sequence registered elsewhere in `createWindow` — this function only owns the TWO
 * screenshots, same same-window shape as `captureLiveThemeToggleVerification`/
 * `captureSettingsCloseVerification` above (their own docstrings explain why a before/after pair
 * needs one window rather than two separate processes; here it is "mid-resume" vs. "after it
 * finished" instead of a toggle). `progressPath` lands shortly after the click sequence has
 * clicked "Resume selected" and switched back to the Today tab (`ResumeProgress`'s own "Resuming 1
 * of N: ..." line, while the stand-in process is still inside its own fast-failure grace window);
 * `resultPath` lands well after that grace window (`FAST_FAILURE_GRACE_MS`, 5s) has elapsed, once
 * `useToday.ts#resumeSelected`'s own refetch has applied the finished `ResumeResult`.
 */
async function captureResumeProgressThenResult(
  window: BrowserWindow,
  clock: Clock,
  progressPath: string,
  resultPath: string,
): Promise<void> {
  const { writeFile } = await import('node:fs/promises');
  // The click sequence's own last step (switching back to Today) lands at ~2400ms from load
  // (500 + 300 + 300 + 300 + 500 + 500, this file's own `SEEYA_APP_AUTO_RESUME_ALL` block) — this
  // waits a little past that before the first capture.
  await clock.sleep(3000);
  const progress = await window.webContents.capturePage();
  await writeFile(progressPath, progress.toPNG());
  // FAST_FAILURE_GRACE_MS (5s) counted from the resume click (~1100ms from load), plus the
  // `getTodayPanel` refetch `useToday.ts#resumeSelected` awaits once the grace resolves.
  await clock.sleep(5500);
  const result = await window.webContents.capturePage();
  await writeFile(resultPath, result.toPNG());
  await quitAfterConfiguredDelay(clock);
}

/**
 * V2-T67 (`docs/INTERFACE.md` § 4): six screenshots from one window, visiting every state the
 * Projects tab's own aceite needs. Combined with `SEEYA_APP_AUTO_OPEN_SHELL_TAB=1` AND
 * `SEEYA_APP_VERIFICATION_TAB_PID_PATH` (both pre-existing, V2-T75 PO review round 3's own
 * mechanism): the first long sleep below gives an EXTERNAL verification script the SAME window
 * `usesTabPidFixture`'s own 35000ms bucket already budgets for — reading the pid that
 * `CHANNELS.createTab`'s own handler just wrote, folding it into a fixture session file on disk
 * (`cwd` pointed at one project's own directory — `matchingTabId` only ever compares `pid`, so the
 * fixture's own claimed `cwd` never has to be where the real shell's OS cwd actually is), and
 * waiting for the next ambient refresh tick (`REFRESH_INTERVAL_MS`, 10s) to fold that into
 * `ProjectsPanelData` — before this function's own first capture, so that project's own row
 * already reads `openHere` in it. The other two lock states (a project that's simply unlocked, one
 * `.seeya-lock`'d by a real decoy process) are plain, static fixture content, present from launch.
 *
 * `01-table.png`: the full table — three lock states, one favorite, the `Ignored projects` section
 * below it (a `seeya.json` the fixture deliberately fails to validate). `02-search-active.png`: a
 * query that narrows the table to one matching row. `03-no-match.png`: a query matching nothing.
 * `04-filter-running.png`/`05-filter-locked.png`: each named filter selected (`ProjectsFilters.tsx`'s
 * own stable `id`s, added by this task for exactly this). The filter is reset to `all` before the
 * dialog shot so `06-new-project-dialog.png` shows the SAME table underneath it the first shot
 * did, dialog open on top.
 */
async function captureProjectsTabStatesVerification(
  window: BrowserWindow,
  clock: Clock,
  outDir: string,
): Promise<void> {
  const { writeFile } = await import('node:fs/promises');
  async function shoot(name: string): Promise<void> {
    const image = await window.webContents.capturePage();
    await writeFile(path.join(outDir, name), image.toPNG());
  }
  function click(id: string): Promise<unknown> {
    return window.webContents.executeJavaScript(`document.getElementById('${id}')?.click();`);
  }
  function setFieldValue(id: string, value: string): Promise<unknown> {
    return window.webContents.executeJavaScript(`
      (() => {
        const el = document.getElementById('${id}');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, ${JSON.stringify(value)});
        el.dispatchEvent(new Event('input', { bubbles: true }));
      })();
    `);
  }

  await clock.sleep(1500); // after SEEYA_APP_AUTO_OPEN_SHELL_TAB's own tab has opened
  await click('all-projects-link');
  // See this function's own docstring — the same external-fixture-plus-ambient-refresh wait
  // `usesTabPidFixture`'s own bucket already budgets for a single-shot capture.
  await clock.sleep(33000);
  await shoot('01-table.png');

  await setFieldValue('projects-search-input', 'payments');
  await clock.sleep(300);
  await shoot('02-search-active.png');

  await setFieldValue('projects-search-input', 'zzz-no-project-named-this');
  await clock.sleep(300);
  await shoot('03-no-match.png');

  await setFieldValue('projects-search-input', '');
  await clock.sleep(300);
  await click('projects-filter-running');
  await clock.sleep(300);
  await shoot('04-filter-running.png');

  await click('projects-filter-locked');
  await clock.sleep(300);
  await shoot('05-filter-locked.png');

  await click('projects-filter-all');
  await clock.sleep(300);
  await click('new-project-button');
  await clock.sleep(300);
  await shoot('06-new-project-dialog.png');

  await quitAfterConfiguredDelay(clock);
}

/**
 * V2-T79 (`Button.tsx`'s own off-center defect, found in a real installer screenshot): three
 * screenshots proving the fix — Open (Projects tab, one unlocked project), Skip today (sidebar
 * footer, schedule configured so `canSkip` is true) and Create (New project dialog) all centered
 * at rest, plus Skip today again while `loading` is true (the exact shape the defect broke).
 *
 * Far simpler than `captureProjectsTabStatesVerification` above: this task needs only ONE
 * unlocked project (no `openHere`/`lockedByOther` decoys, so none of that function's own pid/decoy
 * fixture machinery applies here) and the sidebar footer, which renders beside every main tab, so
 * the very first screenshot already proves Open AND Skip today at once. `03-loading.png` relies on
 * `SEEYA_APP_VERIFY_HOLD_SKIP_MS` (this file's own `holdForVerification`) being set alongside this
 * directory — a real click on the real button, with the real IPC response held open long enough
 * for the capture below to land inside the loading window instead of racing it.
 */
async function captureButtonCenteringVerification(
  window: BrowserWindow,
  clock: Clock,
  outDir: string,
): Promise<void> {
  const { writeFile } = await import('node:fs/promises');
  async function shoot(name: string): Promise<void> {
    const image = await window.webContents.capturePage();
    await writeFile(path.join(outDir, name), image.toPNG());
  }
  function click(id: string): Promise<unknown> {
    return window.webContents.executeJavaScript(`document.getElementById('${id}')?.click();`);
  }

  await clock.sleep(2000); // initial load + the ambient daemon-ownership-transition dismiss, if any
  await click('all-projects-link');
  await clock.sleep(2500); // the first getProjectsPanel fetch/render
  // Open (the table's lone unlocked project) AND Skip today (the footer, always rendered beside
  // whichever main tab is active) — both at rest, in the same frame.
  await shoot('01-open-and-skip.png');

  await click('new-project-button');
  await clock.sleep(300);
  await shoot('02-create.png');

  await click('new-project-cancel');
  await clock.sleep(300);
  await click('schedule-strip-skip-button');
  // `SEEYA_APP_VERIFY_HOLD_SKIP_MS` keeps the real response pending well past this sleep — see
  // that flag's own docstring for why a fixed delay here never has to race the real write.
  await clock.sleep(300);
  await shoot('03-loading.png');

  await quitAfterConfiguredDelay(clock);
}

/**
 * V2-T68 (`docs/INTERFACE.md` § 5): ten screenshots from one window, visiting every state the
 * Sessions tab's own aceite needs. Combined with `SEEYA_APP_AUTO_OPEN_SHELL_TAB=1` AND
 * `SEEYA_APP_VERIFICATION_TAB_PID_PATH` (both pre-existing, V2-T75 PO review round 3's own
 * mechanism, reused by `captureProjectsTabStatesVerification` above for the identical reason): the
 * first long sleep below gives an EXTERNAL verification script the same window that function's own
 * 33000ms bucket already budgets for — reading the pid `CHANNELS.createTab`'s own handler just
 * wrote, folding it into a REAL, alive session record on disk (same pid, real `procStart` read
 * from the OS — `matchedTabId` only ever compares `pid`, `sidebar/session-match.ts`'s own "só por
 * pid", so this row reads `alive` AND `Go to tab` at once) before this function's own first
 * capture. Every other session in the fixture is static content, present from launch — a `cwd`
 * inside a real project directory (empty action cell), one eligible for `Adopt…`, one already
 * adopted (`adoptions.json`, disabled with the reason), one with a deliberately long name/directory
 * (truncation), and two pairs reachable ONLY by the direct id lookup (V2-T55), outside
 * `relevanceHours`: a single hit and an ambiguous one, sharing the fixed prefixes
 * `'33333333'`/`'44444444'` this function's own search steps type in.
 *
 * `01-table.png`: the full table — `Go to tab`, `Resume`+`Adopt…` enabled, `Resume`+`Adopt…`
 * disabled (reason), the empty project cell, and the long name/directory truncated.
 * `02-filter-running.png`/`03-filter-not-running.png`: the two non-`all` state filters.
 * `04-filter-project.png`/`05-filter-directory.png`: a real project, a real directory.
 * `06-search-name.png`: a name query narrowing the table. `07-search-id-outside-window.png`: an id
 * prefix matching only the direct lookup. `08-search-id-ambiguous.png`: a prefix matching two.
 * `09-search-no-result.png`: a hex-shaped prefix matching nothing anywhere. `10-copy-id.png`: the
 * short id button after a real clipboard copy, showing `Copied!` in place of the id.
 * `11-adopt-tooltip.png`: best-effort — a real, hovered (not clicked) pointer over the disabled
 * `Adopt…`, long enough for Chromium's own tooltip delay; see this function's own body for why
 * this one specific capture isn't guaranteed to show anything on an offscreen window.
 */
async function captureSessionsTabStatesVerification(
  window: BrowserWindow,
  clock: Clock,
  outDir: string,
): Promise<void> {
  const { writeFile } = await import('node:fs/promises');
  async function shoot(name: string): Promise<void> {
    const image = await window.webContents.capturePage();
    await writeFile(path.join(outDir, name), image.toPNG());
  }
  function click(id: string): Promise<unknown> {
    return window.webContents.executeJavaScript(`document.getElementById('${id}')?.click();`);
  }
  function setFieldValue(id: string, value: string): Promise<unknown> {
    return window.webContents.executeJavaScript(`
      (() => {
        const el = document.getElementById('${id}');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, ${JSON.stringify(value)});
        el.dispatchEvent(new Event('input', { bubbles: true }));
      })();
    `);
  }
  function setSelectValue(id: string, value: string): Promise<unknown> {
    return window.webContents.executeJavaScript(`
      (() => {
        // V2-T81: \`Select\` is a trigger button + a listbox of \`role="option"\` items (every item
        // is always in the DOM — the Popover only hides its dialog), not a native <select>: choose
        // an option exactly as a click would, through its own \`data-value\`.
        const trigger = document.getElementById('${id}');
        if (!trigger) { return; }
        const listbox = document.getElementById(trigger.getAttribute('aria-controls') || '');
        const option = [...(listbox ? listbox.querySelectorAll('[role="option"]') : [])]
          .find((o) => o.getAttribute('data-value') === ${JSON.stringify(value)});
        if (option) { option.click(); }
      })();
    `);
  }
  // A plain `el.click()` via `executeJavaScript` carries no real user activation — the Async
  // Clipboard API (`navigator.clipboard.writeText`, `SessionIdCopyButton`'s own call) silently
  // rejects a write triggered that way, same "denied permission" branch a sandboxed/headless
  // context already handles (`SessionIdCopyButton`'s own docstring) — confirmed against a real run
  // of THIS instrumentation: the row stayed `[22222222]`, never `Copied!`. `sendInputEvent` is
  // Electron's own synthetic-but-TRUSTED input path (same mechanism offscreen rendering is driven
  // by in general), which Chromium accepts as real user input for Clipboard API purposes — the
  // same reasoning V2-T74's own `verifyMenuAndClipboard` already uses `webContents.copy()` for
  // instead of a scripted click, just at the DOM-button layer here rather than the menu-role layer.
  async function clickCopyButtonFor(sessionId: string): Promise<void> {
    const rect = (await window.webContents.executeJavaScript(`
      (() => {
        const el = document.querySelector('[data-session-id="${sessionId}"]');
        if (!el) { return null; }
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
      })();
    `)) as { x: number; y: number } | null;
    if (rect === null) {
      return;
    }
    // The Async Clipboard API refuses outright with "Document is not focused" on a window this
    // offscreen/headless (`SEEYA_APP_OFFSCREEN`) run never gave real OS focus to — `window.focus()`
    // sets Chromium's own document-focus state without ever calling `.show()` (this window stays
    // invisible exactly as `SEEYA_APP_OFFSCREEN` intends), confirmed against a real run of this
    // instrumentation: the SAME write rejected with that exact message before this call was added.
    window.focus();
    window.webContents.sendInputEvent({
      type: 'mouseDown',
      x: rect.x,
      y: rect.y,
      button: 'left',
      clickCount: 1,
    });
    window.webContents.sendInputEvent({
      type: 'mouseUp',
      x: rect.x,
      y: rect.y,
      button: 'left',
      clickCount: 1,
    });
  }

  await clock.sleep(1500); // after SEEYA_APP_AUTO_OPEN_SHELL_TAB's own tab has opened
  await click('sessions-link');
  // See this function's own docstring — the same external-fixture-plus-ambient-refresh wait
  // `captureProjectsTabStatesVerification`'s own bucket already budgets for a single-shot capture.
  await clock.sleep(33000);
  await shoot('01-table.png');

  await click('sessions-filter-state-running');
  await clock.sleep(300);
  await shoot('02-filter-running.png');

  await click('sessions-filter-state-not-running');
  await clock.sleep(300);
  await shoot('03-filter-not-running.png');

  await click('sessions-filter-state-all');
  await clock.sleep(300);

  await setSelectValue('sessions-filter-project', 'seeya-verification-project');
  await clock.sleep(300);
  await shoot('04-filter-project.png');
  await setSelectValue('sessions-filter-project', 'any');
  await clock.sleep(300);

  await window.webContents.executeJavaScript(`
    (() => {
      const trigger = document.getElementById('sessions-filter-directory');
      const listbox = trigger ? document.getElementById(trigger.getAttribute('aria-controls') || '') : null;
      const option = listbox ? [...listbox.querySelectorAll('[role="option"]')].find((o) =>
        o.textContent.includes('directory-filter-demo') || (o.title || '').includes('directory-filter-demo')
      ) : undefined;
      if (option) { option.click(); }
    })();
  `);
  await clock.sleep(300);
  await shoot('05-filter-directory.png');
  await setSelectValue('sessions-filter-directory', 'any');
  await clock.sleep(300);

  await setFieldValue('sessions-search-input', 'Payments');
  await clock.sleep(300);
  await shoot('06-search-name.png');

  await setFieldValue('sessions-search-input', '33333333');
  await clock.sleep(1200); // the direct, unwindowed lookup's own round trip
  await shoot('07-search-id-outside-window.png');

  await setFieldValue('sessions-search-input', '44444444');
  await clock.sleep(1200);
  await shoot('08-search-id-ambiguous.png');

  await setFieldValue('sessions-search-input', 'ffffff00');
  await clock.sleep(1200);
  await shoot('09-search-no-result.png');

  await setFieldValue('sessions-search-input', '');
  await clock.sleep(300);
  await clickCopyButtonFor('22222222-2222-4222-8222-222222222222');
  await clock.sleep(300);
  await shoot('10-copy-id.png');

  // PO review round 1: a best-effort attempt at the disabled `Adopt…`'s own native `title`
  // tooltip — `sendInputEvent({ type: 'mouseMove', ... })` is the same trusted-input path
  // `clickCopyButtonFor` above already uses for the Clipboard API, hovered long enough for
  // Chromium's own tooltip delay. Native tooltips are an OS-level overlay outside the page's own
  // compositor surface; whether `capturePage()` (an offscreen window to begin with) ever includes
  // one is unconfirmed as of writing — `11-adopt-tooltip.png` is written either way, and the
  // row/button's own `title` attribute (asserted directly in `SessionsTable.test.tsx`) is the
  // guaranteed proof this capture is only a bonus attempt at.
  const disabledAdoptRect = (await window.webContents.executeJavaScript(`
    (() => {
      const button = [...document.querySelectorAll('button')].find(
        (b) => b.disabled && b.textContent.includes('Adopt')
      );
      if (!button) { return null; }
      const r = button.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })();
  `)) as { x: number; y: number } | null;
  if (disabledAdoptRect !== null) {
    window.webContents.sendInputEvent({
      type: 'mouseMove',
      x: disabledAdoptRect.x,
      y: disabledAdoptRect.y,
    });
    await clock.sleep(1500); // typical native tooltip delay
    await shoot('11-adopt-tooltip.png');
  }

  await quitAfterConfiguredDelay(clock);
}

/**
 * SEEYA_APP_VERIFY_CONFIRMATIONS_DIR (V2-T71, `docs/INTERFACE.md` § 9): a DIRECTORY, not a single
 * file — seven screenshots, one per confirmation state this task redesigned (lock, leftover
 * changes, the two resume-fallback shapes, and the three "New project" states). The lock/
 * leftover-changes/fallback dialogs are driven by sending FAKE
 * `confirmProjectLockOpenRequest`/`confirmLeftoverChangesOpenRequest`/`confirmFallbackRequest`
 * events directly (`window.webContents.send`, the exact channel/shape `main/project-ipc.ts`
 * sends for real) instead of the real `openProject()`/resume-fallback machinery — the real paths
 * would need either a second real `seeya` process genuinely holding a project lock or a real
 * `claude --resume` failure, neither appropriate for a screenshot script. "Instrumentação com
 * dependências fictícias" is this task's own prescribed technique for reaching these dialogs,
 * the same spirit as V2-T69's fake generator. **`heldByPid`/`heldByAcquiredAt` for the lock
 * screenshot are never invented** (the V2-T68 lesson this task's own brief names): they come from
 * `SEEYA_APP_VERIFY_DECOY_PID`/`SEEYA_APP_VERIFY_DECOY_PROC_START`, env vars the driver script
 * sets from a REAL spawned child process's own `adapters/process/proc-start.ts
 * #captureObservedProcStart` reading. Each fake-driven dialog is explicitly `.close()`d (firing
 * its own native `close` event, which the component answers with a `requestId` that
 * `PendingConfirmations`/`PendingFallbackRequests` never registered — a silent no-op by design,
 * both classes' own docstrings) before the next one opens, so only ever one dialog is on screen
 * at a time. "New project" is the one state NOT faked — `CHANNELS.createProject` against the
 * fixture's own disposable workspace has no side effect worth avoiding, so its three states
 * (empty, a local format error, the engine's own "already exists") run for real: created once,
 * then the identical id submitted again for the engine's own rejection. Never set by
 * `npm run app` or the README.
 */
async function captureConfirmationsVerification(
  window: BrowserWindow,
  clock: Clock,
  outDir: string,
): Promise<void> {
  const { writeFile } = await import('node:fs/promises');
  async function shoot(name: string): Promise<void> {
    const image = await window.webContents.capturePage();
    await writeFile(path.join(outDir, name), image.toPNG());
  }
  function closeDialog(id: string): Promise<unknown> {
    return window.webContents.executeJavaScript(`document.getElementById('${id}')?.close();`);
  }
  function click(id: string): Promise<unknown> {
    return window.webContents.executeJavaScript(`document.getElementById('${id}')?.click();`);
  }
  function setFieldValue(id: string, value: string): Promise<unknown> {
    return window.webContents.executeJavaScript(`
      (() => {
        const el = document.getElementById('${id}');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, ${JSON.stringify(value)});
        el.dispatchEvent(new Event('input', { bubbles: true }));
      })();
    `);
  }

  await clock.sleep(2000);
  // Defensive dismiss of a stray real daemon-ownership-transition dialog, same self-contained
  // one-click shape `SEEYA_APP_VERIFY_END_DAY_FAKE` already uses — unrelated to what this flag
  // proves, and harmless here either way (`Leave it as it is` never touches a real daemon).
  await click('daemon-ownership-transition-decline');
  await clock.sleep(500);

  const decoyPid = Number(process.env.SEEYA_APP_VERIFY_DECOY_PID ?? '');
  const decoyProcStart = process.env.SEEYA_APP_VERIFY_DECOY_PROC_START;
  const lockEvent: ConfirmProjectLockOpenRequestEvent = {
    requestId: 'verify-lock',
    projectId: 'payments-webhooks',
    heldBySessionId: '22222222-2222-4222-8222-222222222222',
    heldByPid: Number.isFinite(decoyPid) ? decoyPid : 1,
    heldByAcquiredAt: new Date(clock.now().getTime() - 2 * 60 * 60 * 1000),
  };
  void decoyProcStart; // carried by the fixture's own real `.seeya-lock`, never needed in the event itself
  window.webContents.send(CHANNELS.confirmProjectLockOpenRequest, lockEvent);
  await clock.sleep(500);
  await shoot('01-project-locked.png');
  await closeDialog('project-lock-confirm-dialog');
  await clock.sleep(400);

  const changedFiles: readonly ChangedFileRow[] = [
    { path: 'billing-reconciliation/context/know-how.md', status: 'added' },
    { path: 'billing-reconciliation/status/current.md', status: 'modified' },
    {
      path: 'billing-reconciliation/decisions/2026-10-01-reconciliation-window.md',
      status: 'added',
    },
    { path: 'billing-reconciliation/INDEX.md', status: 'modified' },
    { path: 'billing-reconciliation/AGENTS.md', status: 'modified' },
    { path: 'billing-reconciliation/context/invoices.md', status: 'added' },
    { path: 'billing-reconciliation/context/ledger-notes.md', status: 'added' },
    { path: 'billing-reconciliation/journal/2026-10-01.md', status: 'added' },
    { path: 'billing-reconciliation/journal/2026-09-30.md', status: 'added' },
    { path: 'billing-reconciliation/status/blocked.md', status: 'deleted' },
    { path: 'billing-reconciliation/context/old-notes.md', status: 'deleted' },
    { path: 'billing-reconciliation/decisions/2026-09-29-ledger-format.md', status: 'modified' },
    { path: 'billing-reconciliation/context/reconciliation-steps.md', status: 'added' },
    { path: 'billing-reconciliation/status/next.md', status: 'added' },
    { path: 'billing-reconciliation/context/vendor-mapping.md', status: 'renamed' },
    { path: 'billing-reconciliation/context/retry-policy.md', status: 'added' },
    { path: 'billing-reconciliation/decisions/2026-09-28-retry-budget.md', status: 'added' },
    { path: 'billing-reconciliation/status/archive/2026-09.md', status: 'added' },
  ];
  const leftoverEvent: ConfirmLeftoverChangesOpenRequestEvent = {
    requestId: 'verify-leftover',
    projectId: 'billing-reconciliation',
    changedFiles,
  };
  window.webContents.send(CHANNELS.confirmLeftoverChangesOpenRequest, leftoverEvent);
  await clock.sleep(500);
  await shoot('02-leftover-changes.png');
  await closeDialog('leftover-changes-confirm-dialog');
  await clock.sleep(400);

  const resumeFailedEvent: FallbackConfirmRequestEvent = {
    requestId: 'verify-fallback-resume-failed',
    sessionName: 'payments-webhooks',
    cwd: '~/code/payments-webhooks',
    reasonText: 'Resuming this session failed, and starting fresh is the only option left',
    offersResumeWithoutPlan: false,
  };
  window.webContents.send(CHANNELS.confirmFallbackRequest, resumeFailedEvent);
  await clock.sleep(500);
  await shoot('03-fallback-resume-failed.png');
  await closeDialog('fallback-dialog');
  await clock.sleep(400);

  const promptTooLargeEvent: FallbackConfirmRequestEvent = {
    ...resumeFailedEvent,
    requestId: 'verify-fallback-prompt-too-large',
    reasonText: "Yesterday's plan was too large to pass along when resuming",
    offersResumeWithoutPlan: true,
  };
  window.webContents.send(CHANNELS.confirmFallbackRequest, promptTooLargeEvent);
  await clock.sleep(500);
  // ResumeFallbackDialog.module.css#.cardsScroll (`[class*=]`, never the exact generated name —
  // this file never imports that module, D-041): scrolled to the bottom so the THIRD, recommended
  // card is the one the screenshot actually proves, not just the two that already fit.
  await window.webContents.executeJavaScript(`
    (() => {
      const el = document.querySelector('[class*="cardsScroll"]');
      if (el) { el.scrollTop = el.scrollHeight; }
    })();
  `);
  await clock.sleep(300);
  await shoot('04-fallback-prompt-too-large.png');
  await closeDialog('fallback-dialog');
  await clock.sleep(400);

  // "New project" — fully real, never faked (see this function's own docstring): created once
  // for real, then the SAME id submitted again for the engine's own "already exists" rejection.
  await click('new-project-button');
  await clock.sleep(400);
  await shoot('05-new-project-empty.png');

  // `.blur()` on an element that was never `.focus()`d first is a no-op (nothing to blur FROM) —
  // `setFieldValue` only sets the value and fires `input`, never focus, so this needs its own
  // explicit `.focus()` before the value is even set for the later `.blur()` to fire anything at
  // all (confirmed against a real run of this instrumentation before this fix: the error line
  // never appeared, because `TextField.tsx`'s own `onBlur` handler was simply never called).
  // `window.focus()` (the BrowserWindow itself, same fix `SessionsTable`'s own clipboard
  // instrumentation already needed) — without real OS-level focus, this offscreen window's own
  // blur/focus DOM calls land on `document.activeElement` but apparently never fire the actual
  // `blur` event a real window would.
  window.focus();
  await window.webContents.executeJavaScript(
    "document.getElementById('new-project-id-input')?.focus();",
  );
  await setFieldValue('new-project-id-input', 'Invalid Id!');
  await window.webContents.executeJavaScript(
    "document.getElementById('new-project-id-input')?.blur();",
  );
  await clock.sleep(400);
  await shoot('06-new-project-format-error.png');

  await setFieldValue('new-project-id-input', 'payments-webhooks');
  await window.webContents.executeJavaScript(
    "document.getElementById('new-project-form')?.requestSubmit();",
  );
  await clock.sleep(2000);
  await click('new-project-button');
  await clock.sleep(400);
  await setFieldValue('new-project-id-input', 'payments-webhooks');
  await window.webContents.executeJavaScript(
    "document.getElementById('new-project-form')?.requestSubmit();",
  );
  await clock.sleep(1500);
  await shoot('07-new-project-already-exists.png');

  await quitAfterConfiguredDelay(clock);
}

/**
 * SEEYA_APP_VERIFY_DAEMON_OWNERSHIP_DIR (V2-T71, `docs/INTERFACE.md` § 9): a DIRECTORY, not a
 * single file — two screenshots, "em repouso" and "em `loading`", of the REAL daemon-ownership
 * transition dialog (`getDaemonOwnershipTransitionOffer`/`shouldOfferDaemonOwnershipTransition`,
 * never faked at the IPC layer the way the dialogs above are). Reaching `shouldOffer: true`
 * deterministically needs `BuildAppContextOverrides.appInstallation` (see where
 * `contextOverrides` is built, below) pointed at a fake "installed" status — this never queries
 * the real OS registry/`dpkg`/`/Applications` — PLUS a fixture `daemon.lock` (written by the
 * driver script into `SEEYA_APP_HOME_OVERRIDE`'s own `.seeya/`, never the real `~/.seeya/`) naming
 * a REAL live pid (the same decoy process `SEEYA_APP_VERIFY_CONFIRMATIONS_DIR`'s own lock
 * screenshot uses) with a `launchedBy` different from the fake install path — the two facts
 * `shouldOfferDaemonOwnershipTransition` needs to see a genuinely different executable's daemon
 * running. The loading screenshot clicks the REAL `Leave it as it is` button (never `Let seeya
 * take over` — accepting really would touch autostart/the daemon, this task's own explicit
 * prohibition) with `SEEYA_APP_VERIFY_HOLD_DAEMON_OWNERSHIP_ANSWER_MS` set alongside this
 * directory so the real IPC response lands inside the capture window instead of racing it. Never
 * set by `npm run app` or the README.
 */
async function captureDaemonOwnershipTransitionVerification(
  window: BrowserWindow,
  clock: Clock,
  outDir: string,
): Promise<void> {
  const { writeFile } = await import('node:fs/promises');
  async function shoot(name: string): Promise<void> {
    const image = await window.webContents.capturePage();
    await writeFile(path.join(outDir, name), image.toPNG());
  }
  await clock.sleep(7000); // the dialog's own async getDaemonOwnershipTransitionOffer() round trip (measured: 4s was too early on a loaded machine, the idle capture showed no dialog)
  await shoot('01-idle.png');
  await window.webContents.executeJavaScript(
    "document.getElementById('daemon-ownership-transition-decline')?.click();",
  );
  await clock.sleep(400); // inside SEEYA_APP_VERIFY_HOLD_DAEMON_OWNERSHIP_ANSWER_MS's own hold
  await shoot('02-loading.png');
  await quitAfterConfiguredDelay(clock);
}

/**
 * V2-T70 (`docs/INTERFACE.md` § 7): drives the real single adoption dialog end to end — step 1
 * in `Existing project` mode (a fresh workspace's own empty list, or a pre-seeded project already
 * selected — see the `commitWillFail` branch below), step 1 in `New project` mode with an invalid
 * id typed, step 2 (review, with real type/line-count data from the fake fork's own writes), and
 * the result (success or failure, depending on whether `SEEYA_APP_VERIFY_ADOPTION_FAKE_COMMIT_FAILURE`
 * is ALSO set for this run — in which case the `New project` sub-flow and its own screenshot are
 * skipped, since that mode would fail at project CREATION rather than at the review commit this
 * flag means to prove; the `run.mjs` driver instead points `SEEYA_APP_HOME_OVERRIDE` at a home a
 * prior SUCCESS run already adopted into, so `Existing project` has it pre-selected). Only ever
 * meaningful combined with `SEEYA_APP_VERIFY_ADOPTION_FAKE` (never a real `claude` launch) and a
 * `SEEYA_APP_HOME_OVERRIDE` whose Sessions tab already has exactly one adopt-eligible fixture
 * session — `[data-adopt-session-id]` (`SessionsTable.tsx`) is clicked whichever row it's on, the
 * first (and, in that fixture, only) one found.
 */
async function captureAdoptionFlowVerification(
  window: BrowserWindow,
  clock: Clock,
  outDir: string,
): Promise<void> {
  const { writeFile } = await import('node:fs/promises');
  async function shoot(name: string): Promise<void> {
    const image = await window.webContents.capturePage();
    await writeFile(path.join(outDir, name), image.toPNG());
  }
  // `?` before every DOM read below — a selector this own verification instrumentation expects
  // to exist (the fixture home's own fork launcher/discovery timing) is never guaranteed to be
  // there the instant this script runs; calling a native setter with `this === null` throws
  // "Illegal invocation" (confirmed against a real run of this instrumentation before this
  // guard), crashing the renderer instead of just skipping a step that found nothing.
  function click(id: string): Promise<unknown> {
    return window.webContents.executeJavaScript(`!!document.getElementById('${id}')?.click();`);
  }
  function clickFirst(selector: string): Promise<unknown> {
    return window.webContents.executeJavaScript(
      `!!document.querySelector('${selector}')?.click();`,
    );
  }
  function setFieldValue(id: string, value: string): Promise<unknown> {
    return window.webContents.executeJavaScript(`
      (() => {
        const el = document.getElementById('${id}');
        if (!el) { return false; }
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, ${JSON.stringify(value)});
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      })();
    `);
  }
  // Polls instead of a fixed sleep for the two steps whose timing depends on a REAL round trip
  // (project creation via `git init`+commit, the project lock, the fake launcher's own delay, and
  // the `confirmCommit` IPC event back to the renderer) rather than a fixed animation — a fixed
  // sleep here either wastes time on a fast machine or, under load, shoots before the dialog
  // reaches the state being proven. Deadline math uses the injected `Clock` (D-019), never
  // `Date.now()` directly.
  async function waitForElement(id: string, timeoutMs: number): Promise<boolean> {
    const deadline = clock.now().getTime() + timeoutMs;
    for (;;) {
      const found: unknown = await window.webContents.executeJavaScript(
        `!!document.getElementById('${id}');`,
      );
      if (found === true) {
        return true;
      }
      if (clock.now().getTime() >= deadline) {
        return false;
      }
      await clock.sleep(200);
    }
  }

  // `SEEYA_APP_VERIFY_ADOPTION_FAKE_COMMIT_FAILURE` run: proving the REVIEW step's own commit
  // failing needs `ensureProjectExists` to take its `alreadyExists` branch (never calling
  // `commitAll` itself) — the wrapped workspace fails EVERY `commitAll`, project creation
  // included, so a `New project` pick would fail before ever reaching the review step. The
  // `run.mjs` driver that sets this flag always points `SEEYA_APP_HOME_OVERRIDE` at a home a
  // prior SUCCESS run already adopted into, so `Existing project` (this dialog's own default
  // mode) already has that project pre-selected — no typing needed, just submit.
  const commitWillFail = process.env.SEEYA_APP_VERIFY_ADOPTION_FAKE_COMMIT_FAILURE !== undefined;

  await clock.sleep(1500);
  await click('sessions-link');
  await clock.sleep(800);
  await clickFirst('[data-adopt-session-id] button');
  await clock.sleep(500);
  await shoot('01-pick-existing-project.png');

  if (commitWillFail) {
    await click('adoption-pick-submit-button');
  } else {
    await click('adoption-pick-new-option');
    await clock.sleep(200);
    await setFieldValue('adoption-pick-new-project-id-input', 'Invalid ID!');
    await clock.sleep(300);
    await click('adoption-pick-submit-button'); // triggers the inline validation error
    await clock.sleep(300);
    await shoot('02-pick-new-project-invalid-id.png');

    await setFieldValue('adoption-pick-new-project-id-input', 'adoption-fixture-project');
    await clock.sleep(800); // the live-preview round trip (CHANNELS.previewAdoptionLaunch)
    await click('adoption-pick-submit-button');
  }
  // the fake fork "runs" (ADOPTION_FAKE_DELAY_MS) and writes its files, then `confirmCommit`
  // round-trips to the renderer — real `git init`+commit for project creation included.
  await waitForElement('adoption-review-commit-button', 20000);
  await clock.sleep(300); // let the review list finish painting
  await shoot('03-review-changes.png');

  await click('adoption-review-commit-button');
  // A loaded machine (many concurrent `claude`/build processes — this instrumentation's own real
  // usual environment) occasionally loses this first click before Preact's own listener is fully
  // attached; one retry at the halfway point costs nothing on a fast machine (the element is
  // already gone by then, so the click is a harmless no-op) and recovers the slow one.
  const reachedResultFast = await waitForElement('adoption-result-close-button', 5000);
  if (!reachedResultFast) {
    await click('adoption-review-commit-button');
  }
  await waitForElement('adoption-result-close-button', 15000);
  await clock.sleep(300);
  await shoot(commitWillFail ? '04-result-failure.png' : '04-result.png');

  // SEEYA_APP_VERIFY_ADOPTION_RESULT_BUTTON (V2-T82 item 1): `close` or `open` — clicks that real
  // button of the result step. The proof is NOT in this function: `SEEYA_APP_VERIFY_FAKE_HARNESS_LOG`'s
  // own file gets a line only when the real `openProject` pipeline ran, so the script that launched
  // this process reads that file afterwards (no line = Close never opened anything).
  const resultButton = process.env.SEEYA_APP_VERIFY_ADOPTION_RESULT_BUTTON;
  if (resultButton === 'close') {
    await click('adoption-result-close-button');
    await clock.sleep(8000);
  } else if (resultButton === 'open') {
    await click('adoption-result-open-project-button');
    await clock.sleep(8000);
  }

  await quitAfterConfiguredDelay(clock);
}

/**
 * V2-T81 (`renderer/components/Select/`): captures every place the select and the Snooze menu
 * appear, in whichever theme the fixture home's own `config.json` names, so the two can be
 * compared side by side. Never drives anything with side effects: it only opens/closes lists and
 * moves keyboard focus (real key events through `sendInputEvent`, not synthetic DOM ones), and the
 * adoption dialog is only ever OPENED to its first step (`SEEYA_APP_VERIFY_ADOPTION_FAKE` keeps a
 * real `claude` out of reach regardless). Files, in order: `01-sessions-filters-closed`,
 * `02-project-list-open`, `03-directory-list-open` (long path), `04-directory-keyboard-focus`
 * (ArrowDown/ArrowDown/ArrowDown), `05-today-resume-in-open` (mono), `06-snooze-menu-open`,
 * `07-adoption-project-open` (inside the modal dialog); plus `focus-after-escape.txt`, the id of
 * the element holding focus after Esc closed the project list (the trigger, when it works).
 */
async function captureSelectStatesVerification(
  window: BrowserWindow,
  clock: Clock,
  outDir: string,
): Promise<void> {
  const { writeFile } = await import('node:fs/promises');
  async function shoot(name: string): Promise<void> {
    const image = await window.webContents.capturePage();
    await writeFile(path.join(outDir, name), image.toPNG());
  }
  function run(script: string): Promise<unknown> {
    return window.webContents.executeJavaScript(script);
  }
  function click(selector: string): Promise<unknown> {
    return run(`!!document.querySelector(${JSON.stringify(selector)})?.click();`);
  }
  async function pressKey(keyCode: string): Promise<void> {
    // Same reason as `captureSessionsTabStatesVerification`'s own clipboard click: an offscreen
    // window never got real OS focus, and key events only reach the focused element once the
    // document itself is focused (`window.focus()` never `.show()`s this invisible window).
    window.focus();
    window.webContents.focus();
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode });
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode });
    await clock.sleep(400);
  }

  // No ownership-transition dismiss here: the driver pre-writes the declined answer into the
  // disposable home (`daemon-ownership-transition.json`), so that dialog never appears.
  await clock.sleep(2600);

  await click('#sessions-link');
  await clock.sleep(1200);
  await shoot('01-sessions-filters-closed.png');
  // Real layout numbers (V2-T81 PO review): the rendered width of every header cell, the table
  // against its container, and the horizontal overflow of the page region — read with
  // `getBoundingClientRect()` in the real bundle, never estimated from CSS.
  const tableMetrics = await run(`(() => {
    const table = document.querySelector('#page-sessions table');
    if (!table) { return null; }
    const box = table.getBoundingClientRect();
    const parent = table.parentElement.getBoundingClientRect();
    const scroller = table.closest('[class*="scroll"]') || table.parentElement;
    return {
      windowInnerWidth: window.innerWidth,
      tableWidth: box.width,
      containerWidth: parent.width,
      scrollerScrollWidth: scroller.scrollWidth,
      scrollerClientWidth: scroller.clientWidth,
      headerWidths: [...table.querySelectorAll('th')].map((th) => [th.textContent, Math.round(th.getBoundingClientRect().width * 10) / 10]),
    };
  })()`);
  await writeFile(
    path.join(outDir, 'sessions-table-metrics.json'),
    JSON.stringify(tableMetrics, null, 2),
  );

  await click('#sessions-filter-project');
  await clock.sleep(300);
  await shoot('02-project-list-open.png');
  await pressKey('Escape');
  await clock.sleep(200);
  const focused = await run('document.activeElement && document.activeElement.id');
  await writeFile(path.join(outDir, 'focus-after-escape.txt'), String(focused));

  await click('#sessions-filter-directory');
  await clock.sleep(300);
  await shoot('03-directory-list-open.png');
  await pressKey('Down');
  await pressKey('Down');
  await pressKey('Down');
  // What holds focus after the three real ArrowDown presses (the fourth option's text, when the
  // roving focus works) — written next to the capture so the focus ring can be checked against it.
  const focusedOption = await run(
    "document.activeElement ? document.activeElement.getAttribute('role') + ':' + document.activeElement.textContent : 'none'",
  );
  await writeFile(path.join(outDir, '04-focused-element.txt'), String(focusedOption));
  await shoot('04-directory-keyboard-focus.png');
  await pressKey('Escape');
  await clock.sleep(200);

  await click('#today-card');
  await clock.sleep(600);
  await click('[id^="today-resume-in-"]');
  await clock.sleep(300);
  const resumeInMetrics = await run(`(() => {
    const trigger = document.querySelector('[id^="today-resume-in-"]');
    const card = trigger.closest('li, section, article, div[class*="card"]');
    return {
      triggerWidth: trigger.getBoundingClientRect().width,
      notice: trigger.parentElement.parentElement.getBoundingClientRect().width,
      triggerText: trigger.textContent,
    };
  })()`);
  await writeFile(
    path.join(outDir, 'resume-in-metrics.json'),
    JSON.stringify(resumeInMetrics, null, 2),
  );
  await shoot('05-today-resume-in-open.png');
  await pressKey('Escape');
  await clock.sleep(200);

  await click('#schedule-strip-snooze-button');
  await clock.sleep(300);
  await shoot('06-snooze-menu-open.png');
  await pressKey('Escape');
  await clock.sleep(200);

  await click('#sessions-link');
  await clock.sleep(500);
  await click('[data-adopt-session-id] button');
  await clock.sleep(600);
  await click('#adoption-pick-existing-select');
  await clock.sleep(300);
  await shoot('07-adoption-project-open.png');

  await quitAfterConfiguredDelay(clock);
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

/**
 * V2-T74: the fiação half of `composition/menu-policy.ts#resolveApplicationMenuPolicy` — that
 * module only produces data (`ApplicationMenuPolicy`), this function is the one place that calls
 * the real Electron `Menu` API with it. `Menu.setApplicationMenu` is process-global, not
 * per-window (Electron's own docs: "the menu will be set as each window's top menu"), so this
 * runs exactly ONCE, in `app.whenReady()` below, before any `BrowserWindow` is created — never
 * from `createWindow` itself, which can run again on macOS's own `activate` (no second
 * application menu to apply there).
 *
 * `Menu.setApplicationMenu(null)` (the `'none'` branch) removes the menu bar on Windows/Linux
 * entirely, rather than just hiding it behind Alt the way the `BrowserWindow` option
 * `autoHideMenuBar` would — this task's own aceite asks for the bar to be gone, not hidden.
 */
function applyApplicationMenuPolicy(platform: NodeJS.Platform, appName: string): void {
  const policy = resolveApplicationMenuPolicy(platform, appName);
  if (policy.kind === 'none') {
    Menu.setApplicationMenu(null);
    return;
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate(toElectronMenuTemplate(policy.template)));
}

/** `composition/menu-policy.ts`'s own `MenuSection[]` → Electron's real
 * `MenuItemConstructorOptions[]` — the one place this mapping happens, since that module cannot
 * import Electron's type at all (see its own docstring on the `electron`-stays-in-main/ boundary,
 * D-052). */
function toElectronMenuTemplate(sections: readonly MenuSection[]): MenuItemConstructorOptions[] {
  return sections.map((section) => ({
    label: section.label,
    submenu: section.submenu.map(toElectronMenuItem),
  }));
}

/** `MenuItemConstructorOptions['role']` is `(... literal roles) | undefined` (the property is
 * optional) — `NonNullable` here is what lets `toElectronMenuItem` assign a definite role value
 * under this package's own `exactOptionalPropertyTypes: true` (an explicit `role: undefined`
 * would otherwise be a different, rejected assignment from simply omitting the key). */
type ElectronMenuRole = NonNullable<MenuItemConstructorOptions['role']>;

function toElectronMenuItem(entry: MenuEntry): MenuItemConstructorOptions {
  if (entry.kind === 'separator') {
    return { type: 'separator' };
  }
  // `MenuRoleEntry.role` is a plain `string` in `composition/menu-policy.ts` (that module cannot
  // import Electron's own role union either) — every value `buildMacMenuTemplate` actually
  // produces ('about', 'quit', 'undo', 'redo', 'cut', 'copy', 'paste', 'selectAll') is one of
  // Electron's own documented `MenuItem` roles, asserted here once, at the only call site.
  return { role: entry.role as ElectronMenuRole };
}

/** The exact string `verifyMenuAndClipboard`'s text-field round trip types into
 * `#new-project-id-input`, copies out, clears, and expects back after a `webContents.paste()` —
 * distinctive enough that it can never collide with a real project id a person typed. */
const CLIPBOARD_TEXT_FIELD_MARKER = 'seeya-v2t74-field-marker';

/** The exact string `verifyMenuAndClipboard`'s terminal check writes to the OS clipboard and
 * expects to see echoed back into the pty's own visible output after a `webContents.paste()` —
 * distinctive enough to never appear in a shell's own banner by coincidence. */
const CLIPBOARD_TERMINAL_MARKER = 'seeya-v2t74-terminal-marker';

/**
 * V2-T74: round-trips `CLIPBOARD_TEXT_FIELD_MARKER` through a REAL text field
 * (`#new-project-id-input`, opened by `#new-project-button`) using the same `webContents.copy()`
 * `webContents.paste()` Electron calls a menu's Cut/Copy/Paste role would otherwise trigger — the
 * one proof this task's own aceite needs that survives even with the application menu removed
 * entirely (`applyApplicationMenuPolicy`'s own `'none'` branch, Windows/Linux). Closes the dialog
 * again with `#new-project-cancel`, leaving no trace in `~/.seeya/`.
 */
async function verifyTextFieldClipboardRoundTrip(
  window: BrowserWindow,
  clock: Clock,
): Promise<{ copiedText: string; pastedBack: string }> {
  await window.webContents.executeJavaScript(`
    (() => {
      document.getElementById('new-project-button').click();
      const input = document.getElementById('new-project-id-input');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, ${JSON.stringify(CLIPBOARD_TEXT_FIELD_MARKER)});
      input.select();
    })();
  `);
  window.webContents.copy();
  // Electron 44's own `clipboard` module is promise-based (`electron.d.ts`'s own
  // `readText(): Promise<string>`, checked against the installed package before writing this —
  // older Electron versions documented this synchronously, and assuming that from memory would
  // have been exactly the "erro clássico" AGENTS.md warns against). Measured: reading back
  // IMMEDIATELY after `.copy()` sometimes raced ahead of the main process actually receiving the
  // OS clipboard write (`copiedText` came back empty once, even though the later `.paste()` below
  // proved the real clipboard DID hold the marker) — this short wait is what fixed it.
  await clock.sleep(100);
  const copiedText = await clipboard.readText();
  await window.webContents.executeJavaScript(`
    (() => {
      const input = document.getElementById('new-project-id-input');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, '');
      input.focus();
    })();
  `);
  window.webContents.paste();
  const pastedBack = (await window.webContents.executeJavaScript(
    "document.getElementById('new-project-id-input').value",
  )) as string;
  await window.webContents.executeJavaScript(
    "document.getElementById('new-project-cancel').click();",
  );
  return { copiedText, pastedBack };
}

/**
 * V2-T74: proves a paste into the real embedded terminal (`@xterm/xterm`, opened by
 * `SEEYA_APP_AUTO_OPEN_SHELL_TAB`) still works with no application menu present at all.
 *
 * **Why `webContents.paste()` targeting `.xterm-helper-textarea` is the real mechanism, not a
 * shortcut around it.** Read from the installed package before writing this function
 * (`node_modules/@xterm/xterm/lib/xterm.js`): `@xterm/xterm` registers its own `'paste'` listener
 * on both its hidden textarea and its outer element (`handlePasteEvent`), and its own `'copy'`
 * listener on the terminal element when a selection exists (`copyHandler`) — the exact standard
 * DOM `ClipboardEvent`s `webContents.paste()`/`.copy()` dispatch, independent of whether any
 * `Menu` exists. A real `Ctrl+V` keypress or a macOS menu's Paste role ends up triggering the same
 * event this function triggers directly.
 *
 * Reads the pasted marker back from `.xterm-rows` — the DOM renderer's own row container
 * (`@xterm/xterm` ships no WebGL/canvas addon here, `packages/app/package.json`, so the default
 * DOM renderer is what's mounted, and its rendered text is readable `textContent`, never a canvas
 * pixel this function would have no way to read). `helperTextareaFound`/`activeElementDebug`/
 * `terminalTextSnapshot` ride along in the result — this IS the verification report, so a run
 * that comes back `false` should say why (no textarea mounted yet? focus landed somewhere else?)
 * rather than a bare boolean someone has to re-run with print statements to explain.
 */
async function verifyTerminalPaste(
  window: BrowserWindow,
  clock: Clock,
): Promise<{
  markerVisibleInTerminal: boolean;
  helperTextareaFound: boolean;
  activeElementDebug: string;
  terminalTextSnapshot: string;
}> {
  await clipboard.writeText(CLIPBOARD_TERMINAL_MARKER);
  const helperTextareaFound = (await window.webContents.executeJavaScript(
    "document.querySelector('.xterm-helper-textarea') !== null",
  )) as boolean;
  await window.webContents.executeJavaScript(
    "document.querySelector('.xterm-helper-textarea')?.focus();",
  );
  const activeElementDebug = (await window.webContents.executeJavaScript(
    "document.activeElement ? document.activeElement.tagName + '.' + document.activeElement.className : 'null'",
  )) as string;
  window.webContents.paste();
  await clock.sleep(1500);
  const terminalText = (await window.webContents.executeJavaScript(
    "document.querySelector('.xterm-rows')?.textContent ?? '<no .xterm-rows>'",
  )) as string;
  return {
    markerVisibleInTerminal: terminalText.includes(CLIPBOARD_TERMINAL_MARKER),
    helperTextareaFound,
    activeElementDebug,
    terminalTextSnapshot: terminalText.slice(0, 400),
  };
}

/**
 * V2-T74: verification-only instrumentation proving two facts a `capturePage()` screenshot cannot
 * show at all — `webContents.capturePage()` only ever captures the web contents (the HTML the
 * renderer paints), never the native window chrome a menu bar is part of, on an offscreen window
 * or not (this task's own aceite names exactly this limitation). Reads `Menu.getApplicationMenu()`
 * and `window.isMenuBarVisible()` straight from Electron, and — only when
 * `SEEYA_APP_AUTO_OPEN_SHELL_TAB` is ALSO set, so a real pty already exists to paste into — proves
 * copy/paste still works via `verifyTextFieldClipboardRoundTrip`/`verifyTerminalPaste` above.
 *
 * Writes one JSON file to `outputPath`; never read by `npm run app`, same "instrumentação só do
 * spike" discipline as every other `SEEYA_APP_*` flag in this file.
 */
async function verifyMenuAndClipboard(
  window: BrowserWindow,
  clock: Clock,
  outputPath: string,
): Promise<void> {
  const applicationMenu = Menu.getApplicationMenu();
  const menuState = {
    platform: process.platform,
    applicationMenuIsNull: applicationMenu === null,
    menuItemLabels: applicationMenu?.items.map((item) => item.label) ?? null,
    isMenuBarVisible: window.isMenuBarVisible(),
  };

  if (process.env.SEEYA_APP_AUTO_OPEN_SHELL_TAB !== '1') {
    const payload = { menuState, clipboard: { skipped: 'SEEYA_APP_AUTO_OPEN_SHELL_TAB not set' } };
    await writeFile(outputPath, JSON.stringify(payload, null, 2), 'utf8');
    return;
  }

  // Long enough after load for SEEYA_APP_AUTO_OPEN_SHELL_TAB's own three-step sequence (~900ms
  // total, this file's own comment on that flag) to have opened the shell tab and for its prompt
  // to have printed.
  await clock.sleep(3000);
  const textField = await verifyTextFieldClipboardRoundTrip(window, clock);
  const terminal = await verifyTerminalPaste(window, clock);
  const payload = { menuState, clipboard: { textField, terminal } };
  await writeFile(outputPath, JSON.stringify(payload, null, 2), 'utf8');
}

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

function createWindow(clock: Clock): BrowserWindow {
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
  // SEEYA_APP_DEBUG_CONSOLE (V2-T66): same "instrumentação só do spike" class as every other
  // `SEEYA_APP_*` flag in this file — forwards the renderer's own `console.*`/an uncaught
  // exception/a failed navigation to THIS process's stdout, for an agent with no DevTools window
  // to open reading a real error back. Found two real production defects with this during V2-T66's
  // own verification (a CSS module missing a class `EmptyState.tsx` referenced; the renderer-side
  // half of the `app.quit()` race `quitAfterConfiguredDelay`'s own docstring explains) — neither
  // printed anything without it, since a renderer-side uncaught exception otherwise only ever
  // reaches an open DevTools console this process never has. Never set by `npm run app` or the
  // README.
  if (process.env.SEEYA_APP_DEBUG_CONSOLE === '1') {
    window.webContents.on('console-message', (_event, _level, message, line, sourceId) => {
      console.log('[renderer]', message, sourceId, line);
    });
    window.webContents.on('render-process-gone', (_event, details) => {
      console.log('[renderer-gone]', JSON.stringify(details));
    });
    window.webContents.on('did-fail-load', (_event, code, desc) => {
      console.log('[did-fail-load]', code, desc);
    });
  }
  void window.loadFile(path.join(HERE, 'index.html'));
  wireDevToolsShortcut(window);

  const screenshotPath = process.env.SEEYA_APP_SCREENSHOT_PATH;
  // SEEYA_APP_THEME_TOGGLE_AFTER_SCREENSHOT_PATH (V2-T65): when set ALONGSIDE
  // SEEYA_APP_SCREENSHOT_PATH, replaces the one-shot capture above with
  // `captureLiveThemeToggleVerification`'s own two-screenshot flow — see that function's own
  // docstring for why this is the one capture that needs a second path at all.
  const themeToggleAfterPath = process.env.SEEYA_APP_THEME_TOGGLE_AFTER_SCREENSHOT_PATH;
  // SEEYA_APP_RESUME_RESULT_SCREENSHOT_PATH (V2-T66): combined with `SEEYA_APP_SCREENSHOT_PATH`
  // AND `SEEYA_APP_AUTO_RESUME_ALL`, replaces the plain one-shot capture below with
  // `captureResumeProgressThenResult`'s own two-screenshot flow (that function's own docstring has
  // the timing). Checked in THIS same `if`/`else if` chain, not a separate standalone
  // registration — a bug found during this task's own verification: a second, independent
  // `did-finish-load` listener calling the plain `captureVerificationScreenshot` (this function's
  // own `else if` below) fired ALONGSIDE a standalone one for this flag, racing to write the SAME
  // `screenshotPath` and, once `quitAfterConfiguredDelay`'s own bug was fixed, still redundantly
  // re-quitting the app after its own unrelated capture.
  const resumeResultPath = process.env.SEEYA_APP_RESUME_RESULT_SCREENSHOT_PATH;
  if (screenshotPath !== undefined && themeToggleAfterPath !== undefined) {
    window.webContents.once('did-finish-load', () => {
      void captureLiveThemeToggleVerification(window, clock, screenshotPath, themeToggleAfterPath);
    });
  } else if (screenshotPath !== undefined && resumeResultPath !== undefined) {
    window.webContents.once('did-finish-load', () => {
      void captureResumeProgressThenResult(window, clock, screenshotPath, resumeResultPath);
    });
  } else if (screenshotPath !== undefined) {
    window.webContents.once('did-finish-load', () => {
      void captureVerificationScreenshot(window, clock, screenshotPath);
    });
  }
  // SEEYA_APP_VERIFY_PROJECTS_TAB_STATES_DIR (V2-T67): a DIRECTORY, not a single file — the one
  // capture in this file that writes more than two screenshots, so it gets its own flag rather
  // than overloading `screenshotPath`. See `captureProjectsTabStatesVerification`'s own docstring
  // for the full sequence and why it's combined with `SEEYA_APP_AUTO_OPEN_SHELL_TAB=1`/
  // `SEEYA_APP_VERIFICATION_TAB_PID_PATH`. Never set by `npm run app` or the README.
  const projectsTabStatesDir = process.env.SEEYA_APP_VERIFY_PROJECTS_TAB_STATES_DIR;
  if (projectsTabStatesDir !== undefined) {
    window.webContents.once('did-finish-load', () => {
      void captureProjectsTabStatesVerification(window, clock, projectsTabStatesDir);
    });
  }
  // SEEYA_APP_VERIFY_BUTTON_CENTERING_DIR (V2-T79): same "a DIRECTORY, not a single file" shape as
  // the flag right above — see `captureButtonCenteringVerification`'s own docstring for the
  // sequence. Combine with `SEEYA_APP_VERIFY_HOLD_SKIP_MS` for the loading screenshot. Never set
  // by `npm run app` or the README.
  const buttonCenteringDir = process.env.SEEYA_APP_VERIFY_BUTTON_CENTERING_DIR;
  if (buttonCenteringDir !== undefined) {
    window.webContents.once('did-finish-load', () => {
      void captureButtonCenteringVerification(window, clock, buttonCenteringDir);
    });
  }
  // SEEYA_APP_VERIFY_SESSIONS_TAB_STATES_DIR (V2-T68): same "a DIRECTORY, not a single file" shape
  // as the Projects flag above — see `captureSessionsTabStatesVerification`'s own docstring for the
  // full sequence. Never set by `npm run app` or the README.
  const sessionsTabStatesDir = process.env.SEEYA_APP_VERIFY_SESSIONS_TAB_STATES_DIR;
  if (sessionsTabStatesDir !== undefined) {
    window.webContents.once('did-finish-load', () => {
      void captureSessionsTabStatesVerification(window, clock, sessionsTabStatesDir);
    });
  }
  // SEEYA_APP_VERIFY_PROJECT_RESUME_DIR (V2-T77): same "a DIRECTORY, not a single file" shape — see
  // `main/verify-project-resume.ts`'s own docstring. `SEEYA_APP_VERIFY_PROJECT_RESUME_SESSION_IDS`
  // is `<id>,<id>`. Never set by `npm run app` or the README.
  const projectResumeDir = process.env.SEEYA_APP_VERIFY_PROJECT_RESUME_DIR;
  const projectResumeSessionIds = process.env.SEEYA_APP_VERIFY_PROJECT_RESUME_SESSION_IDS;
  if (projectResumeDir !== undefined && projectResumeSessionIds !== undefined) {
    window.webContents.once('did-finish-load', () => {
      void captureProjectResumeVerification(
        window,
        clock,
        projectResumeDir,
        projectResumeSessionIds,
        () => quitAfterConfiguredDelay(clock),
      );
    });
  }
  // SEEYA_APP_VERIFY_WINDOW_MIN_DIR (V2-T77): proof of the window's floor — see
  // `main/verify-window-min.ts`'s own docstring. Never set by `npm run app` or the README.
  const windowMinDir = process.env.SEEYA_APP_VERIFY_WINDOW_MIN_DIR;
  if (windowMinDir !== undefined) {
    window.webContents.once('did-finish-load', () => {
      void captureWindowMinVerification(window, clock, windowMinDir, () =>
        quitAfterConfiguredDelay(clock),
      );
    });
  }
  // SEEYA_APP_VERIFY_CONFIRMATIONS_DIR (V2-T71): same "a DIRECTORY, not a single file" shape as
  // the two flags above — see `captureConfirmationsVerification`'s own docstring for the full
  // sequence. Never set by `npm run app` or the README.
  const confirmationsDir = process.env.SEEYA_APP_VERIFY_CONFIRMATIONS_DIR;
  if (confirmationsDir !== undefined) {
    window.webContents.once('did-finish-load', () => {
      void captureConfirmationsVerification(window, clock, confirmationsDir);
    });
  }
  // SEEYA_APP_VERIFY_DAEMON_OWNERSHIP_DIR (V2-T71): same "a DIRECTORY, not a single file" shape —
  // see `captureDaemonOwnershipTransitionVerification`'s own docstring for the full sequence.
  // Never set by `npm run app` or the README.
  const daemonOwnershipDir = process.env.SEEYA_APP_VERIFY_DAEMON_OWNERSHIP_DIR;
  if (daemonOwnershipDir !== undefined) {
    window.webContents.once('did-finish-load', () => {
      void captureDaemonOwnershipTransitionVerification(window, clock, daemonOwnershipDir);
    });
  }
  // SEEYA_APP_VERIFY_ADOPTION_FLOW_DIR (V2-T70): same "a DIRECTORY, not a single file" shape as
  // the flags above — see `captureAdoptionFlowVerification`'s own docstring for the sequence.
  // Combine with `SEEYA_APP_VERIFY_ADOPTION_FAKE`/`SEEYA_APP_VERIFY_ADOPTION_FAKE_COMMIT_FAILURE`.
  // Never set by `npm run app` or the README.
  const adoptionFlowDir = process.env.SEEYA_APP_VERIFY_ADOPTION_FLOW_DIR;
  if (adoptionFlowDir !== undefined) {
    window.webContents.once('did-finish-load', () => {
      void captureAdoptionFlowVerification(window, clock, adoptionFlowDir);
    });
  }
  // SEEYA_APP_VERIFY_PROJECT_DETAILS_DIR (V2-T83): same "a DIRECTORY, not a single file" shape as the
  // flags above — see `verification-project-details.ts`'s own docstring for the sequence and for
  // what the driver script must have prepared (a disposable workspace, a live lock holder, and
  // `SEEYA_APP_VERIFY_PICKED_DIRECTORIES` in place of the native folder dialog). Never set by
  // `npm run app` or the README.
  const projectDetailsDir = process.env.SEEYA_APP_VERIFY_PROJECT_DETAILS_DIR;
  if (projectDetailsDir !== undefined) {
    window.webContents.once('did-finish-load', () => {
      void captureProjectDetailsVerification(window, clock, projectDetailsDir).then(() =>
        quitAfterConfiguredDelay(clock),
      );
    });
  }
  // SEEYA_APP_VERIFY_SELECT_STATES_DIR (V2-T81): same "a DIRECTORY, not a single file" shape as the
  // flags above — see `captureSelectStatesVerification`'s own docstring for the sequence. Combine
  // with `SEEYA_APP_VERIFY_ADOPTION_FAKE`. Never set by `npm run app` or the README.
  const selectStatesDir = process.env.SEEYA_APP_VERIFY_SELECT_STATES_DIR;
  if (selectStatesDir !== undefined) {
    window.webContents.once('did-finish-load', () => {
      void captureSelectStatesVerification(window, clock, selectStatesDir);
    });
  }
  // SEEYA_APP_AUTO_OPEN_SHELL_TAB: same "instrumentação só do spike" class as SEEYA_APP_OFFSCREEN
  // above — clicks the real "+" button (V2-T64: opens the New tab popover, replacing the former
  // command bar), picks the "Shell" segment and leaves `Directory` blank (the same elements and
  // handlers a person would use, for the "leave blank for the home directory" case), then submits
  // the real form, a few seconds after load, so an agent with no keyboard/mouse of its own can
  // prove a shell tab really opens a pty (docs/PLANO-DE-ENTREGA.md V2-T2 aceite: process tree,
  // window count). Three separate `executeJavaScript` calls, each after its own short sleep —
  // same "give Preact's own state update a turn to flush before the next step reads it" discipline
  // `SEEYA_APP_AUTO_EDIT_SETTINGS` below already needs (a single script clicking the segment and
  // calling `requestSubmit()` back to back would submit against the PREVIOUS render's closure,
  // before the click's `setState` had actually re-rendered the form). Never set by `npm run app`
  // or the README. **V2-T3:** also sends `NERD_GLYPH_PROOF_LINE` (this file's own docstring above)
  // through the tab's data channel, so the same screenshot proves the embedded Nerd Font renders
  // real glyphs, not boxes.
  if (process.env.SEEYA_APP_AUTO_OPEN_SHELL_TAB === '1') {
    window.webContents.once('did-finish-load', () => {
      void clock
        .sleep(300)
        .then(() =>
          window.webContents.executeJavaScript(
            "document.getElementById('new-tab-button').click();",
          ),
        )
        .then(() => clock.sleep(200))
        .then(() =>
          window.webContents.executeJavaScript(
            "document.getElementById('new-tab-kind-shell').click();",
          ),
        )
        .then(() => clock.sleep(200))
        .then(() =>
          window.webContents.executeJavaScript(
            "document.getElementById('new-tab-form').requestSubmit();",
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
  // SEEYA_APP_VERIFY_MENU_AND_CLIPBOARD_PATH (V2-T74): writes `verifyMenuAndClipboard`'s own JSON
  // report — the menu-bar state always, and (combined with SEEYA_APP_AUTO_OPEN_SHELL_TAB=1) the
  // copy/paste round trip too. Never set by `npm run app` or the README.
  const verifyMenuAndClipboardPath = process.env.SEEYA_APP_VERIFY_MENU_AND_CLIPBOARD_PATH;
  if (verifyMenuAndClipboardPath !== undefined) {
    window.webContents.once('did-finish-load', () => {
      void verifyMenuAndClipboard(window, clock, verifyMenuAndClipboardPath);
    });
  }
  // SEEYA_APP_AUTO_SWITCH_TO_ALL_PROJECTS: V2-T75-linha-de-projeto's own before/after proof —
  // clicks the "All projects" nav link (`#all-projects-link`) a moment after a shell tab opens
  // (combine with `SEEYA_APP_AUTO_OPEN_SHELL_TAB=1`), so a project's own open tab can be proven
  // `openHere` WITHOUT also being the active tab — the shell tab stays alive (its pty keeps
  // running, its own session evidence keeps matching), it just isn't the one on screen any more.
  // Never set by `npm run app` or the README.
  if (process.env.SEEYA_APP_AUTO_SWITCH_TO_ALL_PROJECTS === '1') {
    window.webContents.once('did-finish-load', () => {
      void clock
        .sleep(1200) // after SEEYA_APP_AUTO_OPEN_SHELL_TAB's own three steps have settled
        .then(() =>
          window.webContents.executeJavaScript(
            "document.getElementById('all-projects-link')?.click();",
          ),
        );
    });
  }
  // SEEYA_APP_AUTO_HOVER_FIRST_FAVORITE: V2-T75-linha-de-projeto's own before/after proof for the
  // row's own `:hover` state — `executeJavaScript` can measure where the first Favorites row sits,
  // but dispatching a synthetic DOM `MouseEvent` from inside the page never makes a real browser
  // engine match `:hover` (confirmed: that's driven by the renderer's own input pipeline tracking
  // real cursor position, not by any DOM event a page can fire at itself). `webContents
  // .sendInputEvent` is the one Electron API that injects input at that same native level a real
  // mouse would — this is the only flag in this file that calls it. Never set by `npm run app` or
  // the README.
  if (process.env.SEEYA_APP_AUTO_HOVER_FIRST_FAVORITE === '1') {
    window.webContents.once('did-finish-load', () => {
      void clock
        .sleep(1000)
        .then(
          () =>
            window.webContents.executeJavaScript(
              "(() => { const el = document.querySelector('#favorites-section li'); " +
                'if (!el) { return null; } ' +
                'const rect = el.getBoundingClientRect(); ' +
                'return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; })();',
            ) as Promise<{ x: number; y: number } | null>,
        )
        .then((point) => {
          if (point === null) {
            return;
          }
          window.webContents.sendInputEvent({ type: 'mouseMove', x: point.x, y: point.y });
        });
    });
  }
  // SEEYA_APP_AUTO_RESUME_ALL: same "instrumentação só do spike" class as the two above — checks
  // every session checkbox the Today tab rendered (opens the tab first — it's a page pane like
  // Projects/Sessions, not shown by default) and clicks "Resume selected", so an agent with no
  // keyboard/mouse of its own can prove V2-T4's own aceite: a tab opens labeled with the handoff's
  // name for a session whose plan fits, and the fallback dialog appears with the right text for
  // one whose plan doesn't (`resume/tab-session-resumer.ts`'s own size check runs before any tab
  // opens, so the dialog can show up well inside this file's screenshot window). Never set by
  // `npm run app` or the README.
  //
  // V2-T66: the Today tab is a real, controlled Preact component now
  // (`renderer/features/today/Today.tsx`) — `.click()` on each checkbox (not `cb.checked = true`
  // directly, which a controlled input's own next render would simply overwrite back, since
  // nothing fired the `onChange` that actually updates `useToday`'s own selection state) is what
  // makes this a real click as far as Preact's own event delegation is concerned. The button is
  // `#today-resume-selected-button` now (`SelectionFooter.tsx`), not the bare first `<button>`
  // inside the old `#today-panel` anchor.
  if (process.env.SEEYA_APP_AUTO_RESUME_ALL === '1') {
    window.webContents.once('did-finish-load', () => {
      void clock
        .sleep(500)
        .then(() =>
          window.webContents.executeJavaScript("document.getElementById('today-card')?.click();"),
        )
        .then(() => clock.sleep(300))
        .then(() =>
          window.webContents.executeJavaScript(
            'document.querySelectorAll("input[id^=\'today-session-\']")' +
              '.forEach((cb) => { if (!cb.checked) { cb.click(); } });',
          ),
        )
        // Separate step, own sleep — same "give Preact's own state update a turn to flush before
        // the next step reads it" discipline `SEEYA_APP_AUTO_OPEN_SHELL_TAB` above already needs:
        // checking a checkbox only updates `useToday`'s own selection state asynchronously, and
        // the "Resume selected" button reads THAT state for its own `disabled` attribute — a
        // click fired in the same script as the checkbox clicks above would still land on a
        // button Preact had not yet re-rendered as enabled.
        .then(() => clock.sleep(300))
        .then(() =>
          window.webContents.executeJavaScript(
            "document.getElementById('today-resume-selected-button')?.click();",
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
        )
        .then(() => clock.sleep(500))
        .then(() =>
          // V2-T66: a successful resume opens a new terminal tab and switches to it the moment the
          // pty spawns (`useTabStrip.ts`'s own `onResumeTabOpened` handler) — well before this
          // attempt's own `resumeSelected` call even resolves. Switching back to the Today tab here
          // is what lets a `SEEYA_APP_SCREENSHOT_PATH` capture (at whatever bucket it uses) actually
          // see the progress line/result section this flag exists to prove, instead of whatever
          // terminal pane the window switched to on its own.
          window.webContents.executeJavaScript(
            '[...document.querySelectorAll(\'[role="tab"]\')]' +
              ".find((el) => el.textContent?.includes('Today'))?.click();",
          ),
        );
    });
  }
  // SEEYA_APP_AUTO_OPEN_TODAY_TAB (V2-T66): same "instrumentação só do spike" class as the above —
  // clicks the real Today card, so an agent with no mouse of its own can prove the Today tab
  // itself (`renderer/features/today/Today.tsx`) renders its real session cards (the three named
  // states, the directory-change notice with its "Resume in" selector) without also driving a
  // resume attempt the way `SEEYA_APP_AUTO_RESUME_ALL` above does. Never set by `npm run app` or
  // the README.
  if (process.env.SEEYA_APP_AUTO_OPEN_TODAY_TAB === '1') {
    window.webContents.once('did-finish-load', () => {
      void clock
        .sleep(500)
        .then(() =>
          window.webContents.executeJavaScript("document.getElementById('today-card')?.click();"),
        )
        .then(() => clock.sleep(200))
        .then(() =>
          // `.Today_scroll` (not an id — this is the one CSS module class name this file reaches
          // for directly, predictable because `scripts/build.mjs`'s own esbuild CSS-modules
          // plugin names classes `<Component>_<class>`, never a content hash): scrolls past the
          // first card so a fixture with three cards fits one screenshot without a taller window.
          window.webContents.executeJavaScript(
            "document.querySelector('.Today_scroll')?.scrollTo({ top: 420 });",
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
  // SEEYA_APP_VERIFY_END_DAY_FAKE (V2-T69): drives the real "End day…" dialog
  // (`renderer/features/end-day/`) to one of four views for a screenshot, entirely against the
  // FAKE generator `contextOverrides` wired above — never the real, billed `claude -p` the
  // original `SEEYA_APP_AUTO_END_DAY` above calls. Dismisses a stray daemon-ownership-transition
  // dialog FIRST, same reasoning as the two flags below this one — self-contained on purpose
  // (one inline click, not the full `dismissDaemonOwnershipTransitionScript` those two share,
  // which also re-expands the sidebar — irrelevant here and declared further down this function)
  // so this flag never depends on `SEEYA_APP_AUTO_DECLINE_DAEMON_OWNERSHIP_TRANSITION` also being
  // set. `'preview'` then clicks End day and stops there (the dry-run preview never calls a
  // generator at all, real or fake, so no extra wait is needed beyond the IPC round trip).
  // `'progress'`/`'result'`/`'hidden'` also click "Run end-day now" (`#end-day-dialog-run`, same
  // id the structured dialog keeps from the legacy one) — with `END_DAY_FAKE_DELAY_MS` (2000ms)
  // per session and `captureConcurrency: 1` in the fixture's own `config.json` (sequential, so
  // the three "will be captured" sessions never race each other),
  // `resolveEndDayFakeScreenshotDelayMs`'s own `'progress'`/`'hidden'` bucket lands inside the
  // SECOND session's own capture window — one row already `captured`, one `capturing`, one still
  // `waiting`. `'hidden'` additionally clicks `Hide` (`#end-day-dialog-hide`) at that same point,
  // so the screenshot shows the SIDEBAR's own `describeEndDayFooterLabel` reopen affordance
  // instead of the dialog. `'result'`'s own bucket waits for all three sessions AND the
  // near-instant poisoned one (a pre-corrupted `~/.seeya` handoff the fixture writes, never a
  // generator failure) to finish. Never set by `npm run app` or the README.
  const endDayFakeScenario = process.env.SEEYA_APP_VERIFY_END_DAY_FAKE;
  if (endDayFakeScenario !== undefined) {
    window.webContents.once('did-finish-load', () => {
      let sequence = clock
        .sleep(3000)
        .then(() =>
          window.webContents.executeJavaScript(
            "document.getElementById('daemon-ownership-transition-decline')?.click();",
          ),
        )
        .then(() => clock.sleep(4400))
        .then(() =>
          window.webContents.executeJavaScript(
            "document.getElementById('end-day-button').click();",
          ),
        );
      if (endDayFakeScenario !== 'preview') {
        sequence = sequence
          .then(() => clock.sleep(800))
          .then(() =>
            window.webContents.executeJavaScript(
              "document.getElementById('end-day-dialog-run')?.click();",
            ),
          );
      }
      if (endDayFakeScenario === 'hidden') {
        sequence = sequence
          .then(() => clock.sleep(3000))
          .then(() =>
            window.webContents.executeJavaScript(
              "document.getElementById('end-day-dialog-hide')?.click();",
            ),
          );
      }
      void sequence;
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
  // clicks the real sidebar-collapse button, so an agent with no keyboard/mouse of its own can
  // prove the sidebar flips from open to collapsed in a single real screenshot — the companion run
  // with this flag unset already shows the open state, so the pair covers "both states" without
  // any code here needing to decide which one to show. Never set by `npm run app` or the README.
  //
  // PO review (V2-T75, 2026-10-01): clicks `#sidebar-collapse-toggle` now, not
  // `#sidebar-toggle-button` — the single-toggle-button fix (`docs/INTERFACE.md`'s own "um botão
  // de recolher por vez") made `#sidebar-toggle-button` the TOOLBAR's own reopen button, only ever
  // rendered once the sidebar is ALREADY collapsed; clicking it while expanded (the window's own
  // starting state, no prior collapse) found no such element and did nothing, leaving every
  // capture with this flag set showing the sidebar still open. `#sidebar-collapse-toggle` is the
  // header's own button, rendered exactly while expanded — the one that can actually collapse it
  // from the window's own starting state.
  if (process.env.SEEYA_APP_AUTO_TOGGLE_SIDEBAR === '1') {
    window.webContents.once('did-finish-load', () => {
      void clock
        .sleep(500)
        .then(() =>
          window.webContents.executeJavaScript(
            "document.getElementById('sidebar-collapse-toggle')?.click();",
          ),
        );
    });
  }
  // SEEYA_APP_AUTO_EDIT_SETTINGS: same "instrumentação só do spike" class as the five above —
  // opens the real Settings dialog (V2-T14; redesigned by V2-T65 into sections that save on blur,
  // docs/INTERFACE.md § 8), navigates to Schedule, and types an invalid `endOfDayTime` value —
  // proving item 2's refusal: the error appears on the field's own line, naming the rejected value
  // (AGENTS.md's own "a mensagem inclui o valor que causou o erro"), nothing is written.
  //
  // `dispatchEvent(new FocusEvent('blur'))`, never `.blur()` — measured difference, V2-T65's own
  // verification: `.blur()` updates `document.activeElement` but never fires a 'blur'/'focusout'
  // EVENT at all when `SEEYA_APP_OFFSCREEN` is set (this offscreen `BrowserWindow` never holds real
  // page focus to begin with, confirmed with a throwaway `addEventListener('blur', ...)` probe that
  // never fired); `TextField.tsx`'s own `onBlur` prop is wired to the React/Preact 'blur' EVENT, so
  // a person tabbing away (which dispatches a real event) saves correctly, but this offscreen-only
  // script needs to dispatch the event itself. The trailing `clock.sleep(2000)` gives the
  // `saveSetting` round trip (renderer → main → zod validation → back) and its own re-render real
  // wall-clock time to land before the screenshot above fires. Never set by `npm run app` or the
  // README.
  if (process.env.SEEYA_APP_AUTO_EDIT_SETTINGS === '1') {
    window.webContents.once('did-finish-load', () => {
      void clock
        .sleep(500)
        .then(() =>
          window.webContents.executeJavaScript(
            "document.getElementById('settings-button').click();",
          ),
        )
        .then(() => clock.sleep(400))
        .then(() =>
          window.webContents.executeJavaScript(
            "document.getElementById('settings-nav-schedule').click();",
          ),
        )
        .then(() => clock.sleep(300))
        .then(() =>
          window.webContents.executeJavaScript(
            "const invalidInput = document.getElementById('endOfDayTime'); " +
              "invalidInput.value = 'not-a-time'; " +
              "invalidInput.dispatchEvent(new Event('input', { bubbles: true })); " +
              "invalidInput.dispatchEvent(new FocusEvent('blur'));",
          ),
        )
        .then(() => clock.sleep(2000));
    });
  }
  // SEEYA_APP_AUTO_UNDO_SNOOZE (V2-T50): opens the real Snooze menu and clicks its "Undo snooze"
  // item, for a screenshot of the faixa de horário back at the configured time — the person-level
  // action the task's acceptance criterion (a) describes, with no mouse of its own for an agent.
  // The first click needs `getScheduleStrip` to have landed (the button does not exist before it).
  // Never set by `npm run app` or the README.
  if (process.env.SEEYA_APP_AUTO_UNDO_SNOOZE === '1') {
    window.webContents.once('did-finish-load', () => {
      void clock
        .sleep(1500)
        .then(() =>
          window.webContents.executeJavaScript(
            "document.getElementById('schedule-strip-snooze-button')?.click();",
          ),
        )
        .then(() => clock.sleep(500))
        .then(() =>
          window.webContents.executeJavaScript(
            "Array.from(document.querySelectorAll('[role=menuitem]'))" +
              ".find((item) => item.textContent.includes('Undo snooze'))?.click();",
          ),
        )
        .then(() => clock.sleep(1500));
    });
  }
  // SEEYA_APP_AUTO_SET_END_OF_DAY (V2-T50): the value is an "HH:MM" string. Opens Settings, goes
  // to Schedule, types that value into `endOfDayTime`, blurs (the same event a person tabbing
  // away fires — see SEEYA_APP_AUTO_EDIT_SETTINGS above for why a dispatched event rather than
  // `.blur()`), waits for the real `saveSetting` round trip, then clicks `Done` so the screenshot
  // shows the faixa de horário behind it: the item 2 proof (the new time with no leftover snooze).
  // Never set by `npm run app` or the README.
  if (process.env.SEEYA_APP_AUTO_SET_END_OF_DAY !== undefined) {
    const newTime = JSON.stringify(process.env.SEEYA_APP_AUTO_SET_END_OF_DAY);
    window.webContents.once('did-finish-load', () => {
      void clock
        .sleep(1500)
        .then(() =>
          window.webContents.executeJavaScript(
            "document.getElementById('settings-button').click();",
          ),
        )
        .then(() => clock.sleep(400))
        .then(() =>
          window.webContents.executeJavaScript(
            "document.getElementById('settings-nav-schedule').click();",
          ),
        )
        .then(() => clock.sleep(300))
        .then(() =>
          window.webContents.executeJavaScript(
            "const timeInput = document.getElementById('endOfDayTime'); " +
              `timeInput.value = ${newTime}; ` +
              "timeInput.dispatchEvent(new Event('input', { bubbles: true })); " +
              "timeInput.dispatchEvent(new FocusEvent('blur'));",
          ),
        )
        .then(() => clock.sleep(1500))
        .then(() =>
          window.webContents.executeJavaScript(
            "document.getElementById('settings-dialog-done').click();",
          ),
        )
        .then(() => clock.sleep(500));
    });
  }
  // SEEYA_APP_AUTO_CLICK_SKIP_TODAY (maintainer-found defect, V2-T65-estado-na-tela item 2): clicks
  // the real "Skip today" button in the faixa de horário, for an agent with no mouse of its own to
  // prove the fix — before this round, `onSkip` fired `skipToday` and threw the response away, so
  // the button stayed exactly as it was (not disabled, no spinner) until some UNRELATED re-render
  // caught up; a screenshot taken right after this click, with NOTHING else happening in between,
  // is the proof: the button must already read disabled/busy in that single frame, never waiting
  // for a second interaction or the next ambient `scheduleUpdate` push. The 2000ms sleep before
  // clicking gives `useSidebarFooter`'s own `getScheduleStrip` fetch time to land first — this
  // button simply doesn't exist in the DOM (`schedule.canSkip`) until that resolves. Never set by
  // `npm run app` or the README.
  if (process.env.SEEYA_APP_AUTO_CLICK_SKIP_TODAY === '1') {
    window.webContents.once('did-finish-load', () => {
      void clock
        .sleep(2000)
        .then(() =>
          window.webContents.executeJavaScript(
            "document.getElementById('schedule-strip-skip-button')?.click();",
          ),
        );
    });
  }
  // SEEYA_APP_SETTINGS_CLOSE_AFTER_SCREENSHOT_PATH (maintainer-found defect,
  // V2-T65-estado-na-tela item 1): combined with `SEEYA_APP_SCREENSHOT_PATH`, captures the real
  // Settings dialog OPEN (same as `captureLiveThemeToggleVerification`'s own "before" shot), clicks
  // the real `Done` button, and captures AGAIN immediately — no other interaction in between, which
  // is exactly the scenario the maintainer found broken: before this round, `SettingsDialog.module
  // .css`'s own `.dialog` set `display: flex` unconditionally, so the dialog stayed PAINTED (and
  // clickable-through, having already left the top layer via `.close()`) until some unrelated
  // re-render forced Preact to repaint. The "after" screenshot proves the opposite now: the dialog
  // is gone from the very next frame, nothing else needed. Same two-screenshot shape as
  // `captureLiveThemeToggleVerification` (this file's own docstring on that function explains why
  // this task needs a same-window before/after instead of two separate processes) — reusing that
  // function's own short sleeps rather than inventing a third timing scheme.
  const settingsCloseAfterPath = process.env.SEEYA_APP_SETTINGS_CLOSE_AFTER_SCREENSHOT_PATH;
  if (screenshotPath !== undefined && settingsCloseAfterPath !== undefined) {
    window.webContents.once('did-finish-load', () => {
      void captureSettingsCloseVerification(window, clock, screenshotPath, settingsCloseAfterPath);
    });
  }
  // V2-T68: `SEEYA_APP_AUTO_OPEN_OTHER_SESSIONS_DIR`'s own docstring used to open this comment —
  // removed along with that flag (see this file's own `SEEYA_APP_AUTO_OPEN_SESSIONS_TAB`, below,
  // for its replacement). Every flag below that calls `dismissDaemonOwnershipTransitionScript`
  // still shares this: a verification run's own machine may have `seeya` already
  // installed, which pops the (unrelated) daemon-ownership-transition dialog on top of everything
  // else the moment its own async check resolves (`AppContext#checkDaemonOwnershipTransitionOffer`)
  // — dismissed defensively, before either flag's own click, so it never blocks a screenshot this
  // task's own verification never meant to be about that dialog at all.
  // Also defensively re-expands the sidebar: `localStorage`'s own collapse preference
  // (`state/sidebar-collapse.ts`) lives in this Electron binary's own userData, not under
  // `SEEYA_APP_HOME_OVERRIDE` — a PRIOR verification run against this same unpackaged binary
  // (V2-T30's own `SEEYA_APP_AUTO_TOGGLE_SIDEBAR`) can leave it collapsed for every run after,
  // hiding the very rows this task's own flags exist to screenshot.
  const dismissDaemonOwnershipTransitionScript =
    "document.getElementById('daemon-ownership-transition-decline')?.click(); " +
    "if (document.getElementById('sidebar')?.classList.contains('collapsed')) { " +
    "document.getElementById('sidebar-toggle-button')?.click(); }";
  // SEEYA_APP_AUTO_DECLINE_DAEMON_OWNERSHIP_TRANSITION: standalone version of the same dismiss —
  // for a verification screenshot that isn't about either flag below but still needs the dialog
  // out of the way on a machine where `seeya` happens to be installed. Never set by `npm run app`.
  if (process.env.SEEYA_APP_AUTO_DECLINE_DAEMON_OWNERSHIP_TRANSITION === '1') {
    window.webContents.once('did-finish-load', () => {
      void clock
        .sleep(600)
        .then(() => window.webContents.executeJavaScript(dismissDaemonOwnershipTransitionScript));
    });
  }
  // SEEYA_APP_AUTO_RESIZE_SIDEBAR: same class (PO acceptance correction 2, 2026-09-25) —
  // dispatches a REAL synthetic pointer drag sequence (pointerdown on the handle, pointermove,
  // pointerup) on `#sidebar-resize-handle`, exercising `sidebar-resize-view.ts`'s own drag
  // listeners exactly as a real mouse would, rather than patching the CSS custom property
  // directly — the more faithful proof that dragging itself works, not just that the sidebar CAN
  // be a different width. Never set by `npm run app` or the README.
  if (process.env.SEEYA_APP_AUTO_RESIZE_SIDEBAR === '1') {
    window.webContents.once('did-finish-load', () => {
      void clock
        .sleep(600)
        .then(() => window.webContents.executeJavaScript(dismissDaemonOwnershipTransitionScript))
        .then(() => clock.sleep(600))
        .then(() =>
          window.webContents.executeJavaScript(
            '(() => { ' +
              "const handle = document.getElementById('sidebar-resize-handle'); " +
              'if (!handle) { return; } ' +
              'const rect = handle.getBoundingClientRect(); ' +
              'const startX = rect.left + rect.width / 2; ' +
              'const targetX = startX + 140; ' +
              "handle.dispatchEvent(new PointerEvent('pointerdown', " +
              '{ clientX: startX, clientY: rect.top, bubbles: true, pointerId: 1 })); ' +
              "window.dispatchEvent(new PointerEvent('pointermove', " +
              '{ clientX: targetX, clientY: rect.top, bubbles: true, pointerId: 1 })); ' +
              "window.dispatchEvent(new PointerEvent('pointerup', " +
              '{ clientX: targetX, clientY: rect.top, bubbles: true, pointerId: 1 })); ' +
              '})();',
          ),
        );
    });
  }
  // SEEYA_APP_AUTO_NARROW_SIDEBAR: PO review (V2-T75, 2026-10-01) — same real pointer-drag
  // technique as SEEYA_APP_AUTO_RESIZE_SIDEBAR above, with a NEGATIVE delta, for a verification
  // screenshot proving a long session name truncates with an ellipsis (never a hidden horizontal
  // scrollbar) once the lateral is narrowed close to MIN_SIDEBAR_WIDTH. Never set by `npm run app`
  // or the README.
  if (process.env.SEEYA_APP_AUTO_NARROW_SIDEBAR === '1') {
    window.webContents.once('did-finish-load', () => {
      void clock
        .sleep(600)
        .then(() => window.webContents.executeJavaScript(dismissDaemonOwnershipTransitionScript))
        .then(() => clock.sleep(600))
        .then(() =>
          window.webContents.executeJavaScript(
            '(() => { ' +
              "const handle = document.getElementById('sidebar-resize-handle'); " +
              'if (!handle) { return; } ' +
              'const rect = handle.getBoundingClientRect(); ' +
              'const startX = rect.left + rect.width / 2; ' +
              'const targetX = startX - 100; ' +
              "handle.dispatchEvent(new PointerEvent('pointerdown', " +
              '{ clientX: startX, clientY: rect.top, bubbles: true, pointerId: 1 })); ' +
              "window.dispatchEvent(new PointerEvent('pointermove', " +
              '{ clientX: targetX, clientY: rect.top, bubbles: true, pointerId: 1 })); ' +
              "window.dispatchEvent(new PointerEvent('pointerup', " +
              '{ clientX: targetX, clientY: rect.top, bubbles: true, pointerId: 1 })); ' +
              '})();',
          ),
        );
    });
  }
  // SEEYA_APP_AUTO_OPEN_SNOOZE_MENU: PO review (V2-T75, 2026-10-01) — clicks the real Snooze
  // trigger button (`#schedule-strip-snooze-button`), for a verification screenshot of the real
  // Menu (role="menu", +15m/+30m/+1h) open over the footer. Only does anything when the schedule
  // actually offers Snooze right now (the button simply doesn't exist otherwise, same as a human
  // would find). Never set by `npm run app` or the README.
  if (process.env.SEEYA_APP_AUTO_OPEN_SNOOZE_MENU === '1') {
    window.webContents.once('did-finish-load', () => {
      void clock
        .sleep(600)
        .then(() => window.webContents.executeJavaScript(dismissDaemonOwnershipTransitionScript))
        .then(() => clock.sleep(600))
        .then(() =>
          window.webContents.executeJavaScript(
            "document.getElementById('schedule-strip-snooze-button')?.click();",
          ),
        );
    });
  }
  // SEEYA_APP_AUTO_TERMINAL_RESIZE_REPRO: V2-T75-terminal-resize's own before/after reproduction
  // — opens a real shell tab (the system default, `cmd`/clink on Windows), "types" into it
  // (`window.seeya.writeTab` directly, the same channel real keystrokes go through — avoids the
  // fragility of synthesizing keyboard events into xterm's own hidden textarea), switches to a
  // page tab (the terminal pane goes `hidden`), collapses the sidebar, re-expands it (both trigger
  // the width transition this bug is about), and switches back to the shell tab — the exact
  // maintainer repro. Paired with `SEEYA_APP_VERIFICATION_RESIZE_LOG_PATH` (this file's own
  // `resizeTab` handler, above): read that file afterwards for the resize sequence sent to the
  // pty. Never set by `npm run app` or the README.
  if (process.env.SEEYA_APP_AUTO_TERMINAL_RESIZE_REPRO === '1') {
    window.webContents.once('did-finish-load', () => {
      void clock
        .sleep(600)
        .then(() => window.webContents.executeJavaScript(dismissDaemonOwnershipTransitionScript))
        .then(() => clock.sleep(600))
        .then(() =>
          window.webContents.executeJavaScript(
            "document.getElementById('new-tab-button').click();",
          ),
        )
        .then(() => clock.sleep(300))
        .then(() =>
          window.webContents.executeJavaScript(
            "document.getElementById('new-tab-kind-shell').click();",
          ),
        )
        .then(() => clock.sleep(300))
        .then(() =>
          window.webContents.executeJavaScript(
            "document.getElementById('new-tab-form').requestSubmit();",
          ),
        )
        // The shell's own startup banner (cmd/clink's own version/update-check text) needs real
        // wall-clock time to print — generous on purpose, this step is never timing-critical.
        .then(() => clock.sleep(1200))
        .then(() =>
          window.webContents.executeJavaScript(
            "window.seeya.writeTab({ id: 'tab-1', data: 'echo hello from seeya\\r' });",
          ),
        )
        .then(() => clock.sleep(500))
        .then(() =>
          window.webContents.executeJavaScript(
            "document.getElementById('all-projects-link')?.click();",
          ),
        )
        .then(() => clock.sleep(300))
        .then(() =>
          window.webContents.executeJavaScript(
            "document.getElementById('sidebar-collapse-toggle')?.click();",
          ),
        )
        // Longer than the transition itself (`--seeya-motion-panel`, 200ms) plus
        // `sidebar-transition-watcher.ts`'s own 400ms fallback — long enough that, with the fix,
        // the deferred fit has already landed by the time the next step fires.
        .then(() => clock.sleep(700))
        .then(() =>
          window.webContents.executeJavaScript(
            "document.getElementById('sidebar-toggle-button')?.click();",
          ),
        )
        .then(() => clock.sleep(700))
        .then(() =>
          window.webContents.executeJavaScript(
            'document.querySelector(\'[role="tab"][aria-selected="false"]\')?.click();',
          ),
        );
    });
  }
  // V2-T68: `SEEYA_APP_AUTO_OPEN_OTHER_SESSIONS_DIR`/`SEEYA_APP_AUTO_SEARCH_SESSION_ID` (V2-T55,
  // above) used to live here — both clicked/typed into DOM this task deleted (the directory modal,
  // the id-search field), replaced by the Sessions tab's own real component
  // (`renderer/features/sessions/`). `captureSessionsTabStatesVerification` below is their
  // replacement, covering the same facts (and more) in one sequence.
  if (process.env.SEEYA_APP_AUTO_OPEN_SESSIONS_TAB === '1') {
    window.webContents.once('did-finish-load', () => {
      void clock
        .sleep(600)
        .then(() => window.webContents.executeJavaScript(dismissDaemonOwnershipTransitionScript))
        .then(() => clock.sleep(600))
        .then(() =>
          window.webContents.executeJavaScript(
            "document.getElementById('sessions-link')?.click();",
          ),
        );
    });
  }
  // SEEYA_APP_AUTO_VERIFY_DIALOG_FOCUS_RETURN_PATH: same "instrumentação só do spike" class as
  // the flags above (PO acceptance correction 3, 2026-09-25) — opens and closes the real
  // Settings dialog, then writes whether focus landed back on the active tab's terminal
  // (`document.activeElement` inside `#terminal-host`) to the file this variable names. Meant to
  // run together with `SEEYA_APP_AUTO_OPEN_SHELL_TAB=1` (a real terminal has to exist first) — a
  // screenshot wouldn't show a focus state anyway, so this writes a fact to read back instead.
  // Never set by `npm run app` or the README.
  const focusReturnVerificationPath = process.env.SEEYA_APP_AUTO_VERIFY_DIALOG_FOCUS_RETURN_PATH;
  if (focusReturnVerificationPath !== undefined) {
    window.webContents.once('did-finish-load', () => {
      void clock
        .sleep(1500) // after SEEYA_APP_AUTO_OPEN_SHELL_TAB's own tab has mounted
        .then(() => window.webContents.executeJavaScript(dismissDaemonOwnershipTransitionScript))
        .then(() => clock.sleep(300))
        .then(() =>
          window.webContents.executeJavaScript(
            "document.getElementById('settings-button')?.click();",
          ),
        )
        .then(() => clock.sleep(300))
        .then(() =>
          window.webContents.executeJavaScript(
            "document.getElementById('settings-dialog-close')?.click();",
          ),
        )
        .then(() => clock.sleep(300))
        .then(() =>
          window.webContents.executeJavaScript(
            "document.activeElement !== null && document.activeElement.closest('#terminal-host') !== null",
          ),
        )
        .then(async (focusReturnedToTerminal: unknown) => {
          const { writeFile } = await import('node:fs/promises');
          await writeFile(focusReturnVerificationPath, JSON.stringify({ focusReturnedToTerminal }));
        });
    });
  }
  // SEEYA_APP_AUTO_TAB_STRIP_DEMO: same "instrumentação só do spike" class as every flag above
  // (V2-T64) — builds a tab strip with one of each icon kind for a single real screenshot: a
  // shell tab opened through the real New tab popover, then closed (its own real pty exit marks
  // it "· exited"), a fabricated "project" tab and a fabricated "session" tab (two
  // `CHANNELS.resumeTabOpened` events sent directly, the same technique
  // `NERD_GLYPH_PROOF_LINE` above already uses for `CHANNELS.tabData` — no real project/session
  // needs to exist for a screenshot that is only proving which ICON each `kind` renders), and
  // finally the real Sessions page tab, left active. `main.ts`'s own `ptyManager`/`tabs` never
  // learn about the two fabricated ids — `PtyManager.resize`/`.write` are no-ops for an id they
  // never spawned (their own docstrings), so this never risks crashing a real pty. Never set by
  // `npm run app` or the README.
  if (process.env.SEEYA_APP_AUTO_TAB_STRIP_DEMO === '1') {
    window.webContents.once('did-finish-load', () => {
      void clock
        .sleep(600)
        .then(() => window.webContents.executeJavaScript(dismissDaemonOwnershipTransitionScript))
        .then(() => clock.sleep(400))
        .then(() =>
          window.webContents.executeJavaScript(
            "document.getElementById('new-tab-button').click();",
          ),
        )
        .then(() => clock.sleep(200))
        .then(() =>
          window.webContents.executeJavaScript(
            "document.getElementById('new-tab-kind-shell').click();",
          ),
        )
        .then(() => clock.sleep(200))
        .then(() =>
          window.webContents.executeJavaScript(
            "document.getElementById('new-tab-form').requestSubmit();",
          ),
        )
        .then(() => clock.sleep(300))
        .then(() => {
          const projectTab: ResumeTabOpenedEvent = {
            id: 'demo-project-tab',
            label: 'auth-hardening',
            cwd: 'C:\\seeya-demo\\workspace\\auth-hardening',
            pid: 999001,
            kind: 'project',
          };
          window.webContents.send(CHANNELS.resumeTabOpened, projectTab);
        })
        .then(() => clock.sleep(300))
        .then(() => {
          const sessionTab: ResumeTabOpenedEvent = {
            id: 'demo-session-tab',
            label: 'fix-flaky-test',
            cwd: 'C:\\seeya-demo\\code\\app',
            pid: 999002,
            kind: 'session',
          };
          window.webContents.send(CHANNELS.resumeTabOpened, sessionTab);
        })
        .then(() => clock.sleep(300))
        .then(() =>
          // Still running — ends the real pty; the exit event that follows is what actually marks
          // it "· exited" (`useTabStrip.ts`'s own `onTabExit` handler), never faked directly.
          window.webContents.executeJavaScript(
            'document.querySelector(\'[aria-label="Close shell"]\')?.click();',
          ),
        )
        .then(() => clock.sleep(500))
        .then(() =>
          window.webContents.executeJavaScript(
            "document.getElementById('sessions-link')?.click();",
          ),
        )
        .then(() => clock.sleep(300))
        .then(() => {
          // SEEYA_APP_AUTO_OPEN_NEW_TAB_POPOVER: combined with the flag above, opens the New tab
          // popover on top of the demo's own tab strip and selects "Other…" — the second real
          // screenshot this task's own aceite asks for. Standalone (without the demo flag), the
          // popover still opens over whatever the window already shows.
          if (process.env.SEEYA_APP_AUTO_OPEN_NEW_TAB_POPOVER !== '1') {
            return Promise.resolve();
          }
          return window.webContents
            .executeJavaScript("document.getElementById('new-tab-button').click();")
            .then(() => clock.sleep(200))
            .then(() =>
              window.webContents.executeJavaScript(
                "document.getElementById('new-tab-kind-other').click();",
              ),
            );
        });
    });
  } else if (process.env.SEEYA_APP_AUTO_OPEN_NEW_TAB_POPOVER === '1') {
    // Standalone (no tab strip demo): just the popover, with "Other…" selected.
    window.webContents.once('did-finish-load', () => {
      void clock
        .sleep(600)
        .then(() => window.webContents.executeJavaScript(dismissDaemonOwnershipTransitionScript))
        .then(() => clock.sleep(400))
        .then(() =>
          window.webContents.executeJavaScript(
            "document.getElementById('new-tab-button').click();",
          ),
        )
        .then(() => clock.sleep(200))
        .then(() =>
          window.webContents.executeJavaScript(
            "document.getElementById('new-tab-kind-other').click();",
          ),
        );
    });
  }
  return window;
}

/**
 * The faixa de horário's own data — shared by `CHANNELS.getScheduleStrip`'s own handler, the
 * ambient tick's own `scheduleUpdate` push, and `saveSetting`'s own immediate recompute (V2-T75 PO
 * review, round 3: these three call sites used to each run the same `decideSchedule` call inline,
 * which is exactly the duplication AGENTS.md's "nada de duplicação" rules out). `config` is
 * accepted already-resolved so a caller that just read or wrote it (the ambient tick, `saveSetting`)
 * never pays for a second `readConfig()` — `getScheduleStrip`'s own handler is the only caller that
 * has to read it itself.
 */
async function computeScheduleEvent(
  context: Pick<AppContext, 'storage' | 'clock'>,
  config: Config,
): Promise<ScheduleUpdateEvent> {
  const now = context.clock.now();
  const today = localDayString(now);
  const dayState = (await context.storage.readState()) ?? emptyDayState(today);
  const { decision } = decideSchedule(config, dayState, now);
  return buildScheduleStripData(decision, now, decideUndoSnooze(config, dayState, now));
}

/**
 * The daemon pill's own availability — shared by `CHANNELS.getDaemonAvailability`'s own handler,
 * the ambient tick's own `daemonAvailabilityUpdate` push, and `daemonControl`'s own post-action
 * recompute (same deduplication reasoning as `computeScheduleEvent` above).
 */
async function computeDaemonAvailabilityEvent(
  context: Pick<AppContext, 'storage' | 'processControl' | 'clock'>,
): Promise<DaemonAvailabilityUpdateEvent> {
  const liveLockCheck = await checkLiveLock({
    storage: context.storage,
    processControl: context.processControl,
    clock: context.clock,
  });
  return resolveDaemonControlAvailability(liveLockCheck);
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
    readonly kind: ResumeTabOpenedKind;
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
    const event: ResumeTabOpenedEvent = {
      id,
      label: options.label,
      cwd: options.cwd,
      pid,
      kind: options.kind,
    };
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
  // V2-T55 item 4: the id-search field's own IPC — same "own module, main.ts doesn't grow" split
  // `wireProjectIpc` already established.
  wireSessionSearchIpc(context);
  // V2-T83: the "Project details" dialog's own IPC — same "own module" split, reusing the push
  // `wireProjectIpc` already exposes so every action refreshes the Projects tab at once.
  wireProjectDetailsIpc(window, context, projectIpc.pushProjectsUpdate);
  // V2-T68: the Sessions tab's own "Resume" button — same "own module" split, reusing the SAME
  // tabResumeOpener as every other tab-backed launcher above.
  wireSessionResumeIpc(context, tabResumeOpener);
  // V2-T64: the New tab popover's "Browse…" button — same "own module" split as the two above.
  wireDirectoryPickerIpc(window);

  // V2-T3: fetched once by `renderer.ts#main`, before any `new Terminal({...})` is constructed —
  // the two-way handshake (`invoke`, not `send`) matches `createTab` below, the only other channel
  // the renderer needs a value back from. V2-T16: `AppContext.initialTerminalFontOptions` is
  // already the resolved shape (read once, at startup, on purpose — see that field's own
  // docstring), so this handler needs no `Config` read of its own.
  ipcMain.handle(
    CHANNELS.getTerminalFontConfig,
    (): TerminalFontConfigResponse => context.initialTerminalFontOptions,
  );

  // V2-T65 (PO review): Settings' own General section — `__SEEYA_APP_VERSION__`
  // (`build-constants.d.ts`'s own docstring has why this is never `app.getVersion()`), never
  // pushed: a running window's own installed version cannot change under it until relaunched.
  ipcMain.handle(CHANNELS.getAppVersion, (): string => __SEEYA_APP_VERSION__);
  // V2-T66 PO review, item 2: `context.homeDir` (never `os.homedir()` read fresh here or in the
  // renderer) — it already carries `SEEYA_APP_HOME_OVERRIDE` when a verification run set one, so
  // the `~`-abbreviation a verification screenshot proves is against the SAME home the fixture
  // itself was built under, not the real machine's.
  ipcMain.handle(CHANNELS.getHomeDir, (): string => context.homeDir);

  // V2-T62 (D-051): the window's effective theme — "system" has a live counterpart
  // (`getTerminalFontConfig` above deliberately does not, its own docstring explains why), so
  // `Config.theme` is read FRESH here, never cached on `AppContext` the way V2-T16 already
  // decided every OTHER config value should be (`context.storage.readConfig()`, the same "at the
  // moment it's needed" precedent `getSettingsPanel` below follows). `nativeTheme.shouldUseDarkColors`
  // is Electron's own live OS signal; this file never sets `nativeTheme.themeSource`, so that
  // signal always reflects the real OS preference regardless of what THIS app has pinned —
  // `resolveEffectiveTheme` (pure, unit-tested on its own) is the one place that decides what to
  // do with the two together.
  let lastSentEffectiveTheme: ThemeUpdateEvent['effectiveTheme'] | null = null;
  async function resolveAndSendEffectiveTheme(): Promise<void> {
    const config = await context.storage.readConfig();
    const effectiveTheme = resolveEffectiveTheme(config.theme, nativeTheme.shouldUseDarkColors);
    if (effectiveTheme === lastSentEffectiveTheme) {
      return;
    }
    lastSentEffectiveTheme = effectiveTheme;
    const event: ThemeUpdateEvent = { effectiveTheme };
    window.webContents.send(CHANNELS.themeUpdate, event);
  }
  const onNativeThemeUpdated = (): void => void resolveAndSendEffectiveTheme();
  nativeTheme.on('updated', onNativeThemeUpdated);
  window.once('closed', () => nativeTheme.removeListener('updated', onNativeThemeUpdated));
  ipcMain.handle(CHANNELS.getEffectiveTheme, async (): Promise<ThemeUpdateEvent> => {
    const config = await context.storage.readConfig();
    const effectiveTheme = resolveEffectiveTheme(config.theme, nativeTheme.shouldUseDarkColors);
    lastSentEffectiveTheme = effectiveTheme;
    return { effectiveTheme };
  });

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
      // SEEYA_APP_VERIFICATION_TAB_PID_PATH: same "instrumentação só do spike" class as every
      // other `SEEYA_APP_*` flag this file reads (never set by `npm run app`, never documented in
      // the README) — V2-T75 PO review (round 3), item 4's own capture: proving a project shows
      // `openHere` (`matchingTabId`, `sidebar/session-match.ts`'s own "by pid, and only by pid")
      // needs a discovered session whose `pid` equals a REAL tab's pid, and the fixture used for
      // every other V2-T75 screenshot has no way to predict that pid in advance (the OS assigns
      // it at spawn time). Writing it out here, for a verification run to read and fold back into
      // its own fixture session file before the ambient tick after this one, is simpler and more
      // reliable than guessing at it from the OS process tree externally.
      const tabPidPath = process.env.SEEYA_APP_VERIFICATION_TAB_PID_PATH;
      if (tabPidPath !== undefined) {
        await writeFile(tabPidPath, String(pid), 'utf8');
      }
      return { id: request.id, pid };
    },
  );

  ipcMain.on(CHANNELS.writeTab, (_event, request: WriteTabRequest) => {
    ptyManager.write(request.id, request.data);
  });

  ipcMain.on(CHANNELS.resizeTab, (_event, request: ResizeTabRequest) => {
    ptyManager.resize(request.id, request.cols, request.rows);
    // SEEYA_APP_VERIFICATION_RESIZE_LOG_PATH: same "instrumentação só do spike" class as every
    // other `SEEYA_APP_*` flag this file reads (never set by `npm run app`) — V2-T75-terminal-
    // resize's own before/after proof: one line per `resize-tab` this process ever sends to a
    // pty, so a verification run can show the exact sequence (absurd cols/rows mid-transition
    // before the fix; none while hidden, one correct resize on return, after it).
    const resizeLogPath = process.env.SEEYA_APP_VERIFICATION_RESIZE_LOG_PATH;
    if (resizeLogPath !== undefined) {
      const line = `${context.clock.now().toISOString()} id=${request.id} cols=${request.cols} rows=${request.rows}\n`;
      void appendFile(resizeLogPath, line);
    }
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
  // rebuilt, never a value cached from window startup — same discipline `getSettingsPanel` below
  // already follows.
  //
  // V2-T66: extracted out of the `getTodayPanel` handler (its only caller before this task) so
  // `endDayRun` below can also rebuild and PUSH a fresh value once a real end-day run finishes —
  // the Today tab is a real component now (`renderer/features/today/Today.tsx`), mounted once for
  // the life of the window and driven entirely by `onTodayUpdate`/its own mount-time fetch, with
  // no imperative `refreshTodayPanel()` escape hatch left for a sibling dialog to call into it
  // (unlike the deleted `renderer/legacy/today-panel-view.ts`, which `renderer/legacy/
  // end-day-dialog-view.ts` used to call directly after "Run end-day now" resolved).
  async function buildFreshTodayPanelData(): Promise<TodayPanelResponse> {
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
    // and cwd history just built here stay valid until the next rebuild; only liveness needs to be
    // fresh every tick.
    latestTodayPanelInputs = { lookup, cwdHistoryBySessionId };
    return buildTodayPanelData(lookup, cwdHistoryBySessionId, liveSessionIds);
  }

  ipcMain.handle(CHANNELS.getTodayPanel, (): Promise<TodayPanelResponse> =>
    buildFreshTodayPanelData(),
  );

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

      // PO review of V2-T66 (2026-09-xx): the sidebar's own "Today" card reads the SAME
      // `todayUpdate` channel (useSidebar.ts) as the Today tab itself — pushing the freshly
      // resumed state here, right after resumeSessions resolves, is what keeps the sidebar's
      // count in sync with the tab's own result at the same instant, instead of leaving it stale
      // until the next ambient refresh tick (up to REFRESH_INTERVAL_MS away). Same pattern as
      // `endDayRun` above.
      window.webContents.send(CHANNELS.todayUpdate, await buildFreshTodayPanelData());

      return buildResumeSummary(result, resolveLabel);
    },
  );

  // V2-T5a item 1, reworked by V2-T69 into structured rows: "End day..." — the dry-run preview
  // shown as the confirmation itself (D-039, D-002: this NEVER writes a handoff or terminates a
  // process — dryRun: true stops every write right before it happens, application/end-day.ts's own
  // top comment). skipGeneration: true (review fix) means this NEVER calls a real generator either
  // — unlike `seeya end-day --dry-run` itself (whose own contract, S2-T5, still calls the real
  // lean generator during a dry run: a command the person already decided to run), a preview the
  // person has NOT confirmed anything for yet must not spend a real, billed model call — see
  // EndDayOptions.skipGeneration's own docstring for the full reasoning.
  // `state/end-day-sessions.ts#buildEndDayPreviewRows` is the SAME `EndDayResult` `seeya end-day
  // --dry-run`'s own `formatEndDayReport` reads, just shaped into the "Will be captured"/"Not
  // captured" lists `docs/INTERFACE.md` § 6 asks for instead of that function's literal paragraph
  // (principle 5) — its CONTENT still differs from `seeya end-day --dry-run` for lean sessions
  // specifically, honestly (D-025): no "understanding" this preview never produced, since none of
  // these rows carry one. The cost ceiling has no CLI equivalent, so it's computed here.
  //
  // V2-T16: `config` is read fresh, right here, for the cost-ceiling rendering — `endDay` itself
  // already reads its own fresh copy internally (`application/end-day.ts`'s own
  // `storage.readConfig()` call), so this was never about `endDay`'s behavior; it was `main.ts`
  // formatting the RESULT against a config snapshot taken at window startup.
  //
  // PO review round 2 (V2-T69, item 1): the cost ceiling counts `willBeCaptured.length`, never the
  // engine's own `result.sessionsInScope` — three different numbers (the cost ceiling, the running
  // view's own "i of M", and "Will be captured"'s own total) all described slightly different
  // populations before this fix. `sessionsInScope` also counts cheap-ineligible AND genuinely-
  // failing sessions, neither of which ever reaches the paid generation step (a `CaptureFailure`
  // can ONLY arise from `gatherEvidence`/eligibility-assembly I/O — `end-day.ts#captureSessionOutcome`
  // never lets a GENERATOR failure become one; that's swallowed into a `deterministic` handoff
  // instead), so counting them toward "how much could this cost" overstated the ceiling. The SAME
  // `willBeCaptured.length` also seeds `state/end-day-panel.ts#seedTrackedSessions`'s own `total` —
  // one number, three readers.
  ipcMain.handle(CHANNELS.endDayPreview, async (): Promise<EndDayPreviewResponse> => {
    const result = await endDay(toEndDayDeps(context), {
      dryRun: true,
      skipGeneration: true,
      scope: { kind: 'fullDay' },
    });
    const config = await context.storage.readConfig();
    const { willBeCaptured, notCaptured } = buildEndDayPreviewRows(
      result,
      context.homeDir,
      context.platformHint,
    );
    return {
      willBeCaptured,
      notCaptured,
      costCeiling: buildEndDayCostCeiling(willBeCaptured.length, config),
    };
  });

  // V2-T5a item 4, reworked by V2-T69: "Run end-day now" — the real run (dryRun: false), notified
  // through the SAME Notifier/buildEndDayNotice seeya end-day uses (composition/index.ts
  // #buildAppContext wires the real adapter, D-020). The status panel picks up whatever this run
  // wrote/terminated on its own next tick (runRefreshLoop below, at most REFRESH_INTERVAL_MS away —
  // no separate push needed). `buildEndDayResultRows` replaces `formatEndDayReport` here — the
  // response is the same `EndDayResult`'s own captured/failed/skipped buckets, structured.
  //
  // V2-T66: the "Today" panel is refreshed and PUSHED from here, not fetched explicitly by the
  // renderer after this resolves — `renderer/legacy/end-day-dialog-view.ts` (apagado by V2-T69,
  // and already apagado of its own `today-panel-view.ts#refreshTodayPanel()` call by V2-T66) used
  // to call that for a DOM-at-hand panel; Today is a real, independently-mounted component now
  // (`renderer/features/today/Today.tsx`) with no reference a sibling dialog could call into —
  // `CHANNELS.todayUpdate`, the same push every ambient refresh tick already uses, is the only
  // channel left that reaches it.
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
          window.webContents.send(CHANNELS.endDayProgress, projectEndDayProgressEvent(event));
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
      window.webContents.send(CHANNELS.todayUpdate, await buildFreshTodayPanelData());
      return buildEndDayResultRows(result, context.homeDir, context.platformHint);
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

  ipcMain.handle(CHANNELS.skipToday, async (): Promise<ScheduleUpdateEvent> => {
    const result = await skipTodayNow(context.storage, context.clock);
    // SEEYA_APP_VERIFY_HOLD_SKIP_MS (V2-T79): see `holdForVerification`'s own docstring — a no-op
    // outside a verification run, so the real button's own latency is exactly what it always was.
    await holdForVerification(context.clock);
    return result;
  });

  // V2-T50: the Snooze menu's "Undo snooze" — same immediate-update shape as the two above.
  ipcMain.handle(CHANNELS.undoSnoozeToday, async (): Promise<ScheduleUpdateEvent> =>
    undoSnoozeTodayNow(context.storage, context.clock),
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
      return { resultText, availability: await computeDaemonAvailabilityEvent(context) };
    },
  );

  // V2-T75 PO review (round 3): fetched once at startup — see `CHANNELS.getScheduleStrip`'s own
  // docstring (the invoke-discard production defect this fixes).
  ipcMain.handle(CHANNELS.getScheduleStrip, async (): Promise<ScheduleStripResponse> => {
    const config = await context.storage.readConfig();
    return computeScheduleEvent(context, config);
  });

  // V2-T75 PO review (round 3): fetched once at startup — same reasoning as `getScheduleStrip`
  // above.
  ipcMain.handle(CHANNELS.getDaemonAvailability, async (): Promise<DaemonAvailabilityResponse> =>
    computeDaemonAvailabilityEvent(context),
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
      // V2-T50: the shared write path (`application/config-update.ts`, also used by `seeya config
      // set`) — a changed `endOfDayTime` zeroes today's snooze, and the recompute below reads the
      // already-cleared day state, so the strip comes back without the old "+1h".
      const { config: updated } = await saveConfigChange(
        context.storage,
        context.clock,
        (current) => applyConfigFieldUpdate(current, parsed.key, parsed.value),
      );

      const scheduleEvent = await computeScheduleEvent(context, updated);
      // D-052 (V2-T75): pushed too, not just returned in the response — the lateral's own
      // schedule strip (`renderer/features/sidebar/SidebarFooter`) is a reactive component now,
      // driven ONLY by `onScheduleUpdate` pushes (the same channel the ambient tick above already
      // uses); without this push it would show the STALE schedule until the next tick (up to
      // `REFRESH_INTERVAL_MS`), the exact regression `settings-dialog-view.ts`'s own comment on
      // this response field was written to prevent in the FIRST place, before the Settings dialog
      // moved to `renderer/legacy/`.
      window.webContents.send(CHANNELS.scheduleUpdate, scheduleEvent);
      // V2-T65 (PO review, 2026-10-01 — "troca de tema só vale depois de fechar e abrir o app"):
      // a `theme` save used to rely on `nativeTheme.on('updated', ...)` to ever push
      // `themeUpdate` — which only fires on an OS-level light/dark change, never on this save. The
      // window's own `data-theme`/terminal colours (`renderer/legacy/theme-view.ts#wireTheme`)
      // are driven ONLY by that push, so picking Light/Dark/System in Settings silently did
      // nothing until the next relaunch. Reusing the SAME resolve-and-maybe-push function the
      // native-theme listener already calls, right here, is what makes a save apply live — it
      // already no-ops when the effective theme didn't actually change (e.g. System picked on a
      // machine whose OS is already light), so this costs nothing on every OTHER field's save.
      await resolveAndSendEffectiveTheme();
      return {
        ok: true,
        rows: buildSettingsRows(updated),
        schedule: scheduleEvent,
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

  // V2-T65: Settings' own General section — fetched once when it mounts. Answers from the
  // ambient-tick cache ONLY, never a direct `context.autostart.status()` call of its own
  // (`CHANNELS.getAutostartAvailability`'s own docstring: that call measured up to ~6s cold).
  // `{ kind: 'unknown' }` before the first tick has run yet (D-025 — the switch shows "cannot
  // verify" rather than guessing enabled/disabled) — the very next `autostartAvailabilityUpdate`
  // push (within `REFRESH_INTERVAL_MS`) corrects it.
  ipcMain.handle(CHANNELS.getAutostartAvailability, (): AutostartAvailabilityResponse =>
    autostartCache === null
      ? { kind: 'unknown' }
      : resolveAutostartControlAvailability(context.daemonOwner, autostartCache.status),
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
      // SEEYA_APP_VERIFY_HOLD_DAEMON_OWNERSHIP_ANSWER_MS (V2-T71): see
      // `holdForDaemonOwnershipVerification`'s own docstring — a no-op outside a verification
      // run, so the real button's own latency is exactly what it always was.
      await holdForDaemonOwnershipVerification(context.clock);
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
      const scheduleEvent = await computeScheduleEvent(context, liveConfig);
      window.webContents.send(CHANNELS.scheduleUpdate, scheduleEvent);

      // V2-T5b item 3: a SECOND checkLiveLock this tick (buildStatusPanelText's own
      // describeDaemonState already did one for the status panel's text) — a deliberate,
      // measured-acceptable cost (the SAME ~0.24-0.88s class this file's own REFRESH_INTERVAL_MS
      // docstring already accepts once per tick for describeDaemonState), not shared: threading a
      // precomputed LiveLockCheck INTO describeDaemonState would mean changing that function's own
      // signature for a caller outside its existing two (seeya status/--status), which is a
      // bigger change than this task's own scope.
      const daemonAvailabilityEvent = await computeDaemonAvailabilityEvent(context);
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
    // uses it against a tmpdir fixture, never the real home). Never set by `npm run app`. Captured
    // once here, and reused below by `shouldRegisterProtocolScheme` (V2-T57) — the OS-level
    // registration and the marker file live outside whatever home this window is pointed at, so
    // redirecting the home alone was never enough to isolate them (see that module's own docstring).
    const homeOverride = process.env.SEEYA_APP_HOME_OVERRIDE;
    // SEEYA_APP_VERIFY_END_DAY_FAKE (V2-T69): 'preview' | 'progress' | 'result' | 'hidden' — picks
    // which of End day's own views (`renderer/features/end-day/`) the click-automation block below
    // drives the window to before `captureVerificationScreenshot` fires. Whenever set at all, BOTH
    // generators become `VerificationFakeHandoffGenerator` (`composition/verification-fake-
    // generator.ts`) — a real, billed `claude -p` must never run just because someone wanted a
    // screenshot of the progress/result view. `END_DAY_FAKE_DELAY_MS` is what spaces sessions out
    // enough for a mid-flight screenshot to show one `captured`, one `capturing`, one `waiting`
    // (see the click-automation block's own comment for the exact timing this buys). Never set by
    // `npm run app` or the README.
    const endDayFakeScenario = process.env.SEEYA_APP_VERIFY_END_DAY_FAKE;
    // SEEYA_APP_VERIFY_FAKE_INSTALLED_LAUNCH_PATH (V2-T71): `captureDaemonOwnershipTransitionVerification`'s
    // own driver — a fake `AppInstallation` that reports "installed" at the given path WITHOUT
    // ever querying the real OS registry/`dpkg`/`/Applications` (`BuildAppContextOverrides
    // .appInstallation`'s own docstring already names this exact use). Never set by `npm run app`
    // or the README.
    const fakeInstalledLaunchPath = process.env.SEEYA_APP_VERIFY_FAKE_INSTALLED_LAUNCH_PATH;
    const fakeAppInstallation: AppInstallation | undefined =
      fakeInstalledLaunchPath === undefined
        ? undefined
        : {
            find: () =>
              Promise.resolve({ kind: 'installed', executablePath: fakeInstalledLaunchPath }),
          };
    // SEEYA_APP_VERIFY_ADOPTION_FAKE (V2-T70): whenever set at all (any value), the real
    // `ProjectAdoptTabLauncher` is replaced by `VerificationFakeAdoptionLauncher` — a real
    // `claude` adoption fork must never launch just because someone wanted a screenshot of the
    // review-before-commit step (`renderer/features/adoption/`). Never set by `npm run app` or
    // the README.
    const adoptionFakeRequested = process.env.SEEYA_APP_VERIFY_ADOPTION_FAKE !== undefined;
    // SEEYA_APP_VERIFY_ADOPTION_FAKE_COMMIT_FAILURE (V2-T70): proves the adoption review dialog's
    // own failure result (`docs/INTERFACE.md` § 7 item 3) — `wrapWorkspaceWithFailingCommit`'s own
    // docstring explains why a thrown `commitAll` stands in for a real git-hook refusal. Only ever
    // meaningful alongside `SEEYA_APP_VERIFY_ADOPTION_FAKE` (there is no commit to fail without a
    // fork that wrote something first). Never set by `npm run app` or the README.
    const adoptionCommitFailureRequested =
      process.env.SEEYA_APP_VERIFY_ADOPTION_FAKE_COMMIT_FAILURE !== undefined;
    const contextOverrides: BuildAppContextOverrides = {
      ...(endDayFakeScenario !== undefined
        ? {
            leanGenerator: new VerificationFakeHandoffGenerator(systemClock, END_DAY_FAKE_DELAY_MS),
            deepGenerator: new VerificationFakeHandoffGenerator(systemClock, END_DAY_FAKE_DELAY_MS),
          }
        : {}),
      ...(fakeAppInstallation !== undefined ? { appInstallation: fakeAppInstallation } : {}),
      ...(adoptionFakeRequested
        ? {
            adoptionLauncher: new VerificationFakeAdoptionLauncher(
              systemClock,
              ADOPTION_FAKE_DELAY_MS,
            ),
          }
        : {}),
      // SEEYA_APP_VERIFY_FAKE_HARNESS_LOG (V2-T82): the path of a file that
      // `VerificationFakeHarnessLauncher` appends one line to per `openProject` call, instead of
      // spawning `claude`. Never set by `npm run app` or the README.
      ...(process.env.SEEYA_APP_VERIFY_FAKE_HARNESS_LOG !== undefined
        ? {
            harnessLauncher: new VerificationFakeHarnessLauncher(
              process.env.SEEYA_APP_VERIFY_FAKE_HARNESS_LOG,
            ),
          }
        : {}),
      ...(adoptionCommitFailureRequested
        ? {
            workspace: wrapWorkspaceWithFailingCommit(
              new FsWorkspaceRepository(),
              'seeya: verification fixture — commitAll always fails under ' +
                'SEEYA_APP_VERIFY_ADOPTION_FAKE_COMMIT_FAILURE.',
            ),
          }
        : {}),
    };
    const context = await buildAppContext(homeOverride, contextOverrides);

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
