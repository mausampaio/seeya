/**
 * The single-file screenshot captures (V2-T51: moved out of `main/main.ts`): the plain one-shot
 * `SEEYA_APP_SCREENSHOT_PATH` capture and the three two-screenshot flows that share its path
 * (theme toggle, Settings close, resume progress/result).
 */
import { BrowserWindow } from 'electron';
import type { Clock } from '@seeya-ai/engine/core/ports.js';
import { quitAfterConfiguredDelay } from './quit-after.js';

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
export async function captureVerificationScreenshot(
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
export async function captureLiveThemeToggleVerification(
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
export async function captureSettingsCloseVerification(
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
export async function captureResumeProgressThenResult(
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
