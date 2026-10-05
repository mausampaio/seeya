/**
 * The `did-finish-load` registrations of every screenshot/directory capture (V2-T51: moved out of
 * `createWindow` in `main/main.ts`, one function per `SEEYA_APP_*` flag, in the order the
 * original `createWindow` registered them — see `main/verification/index.ts`). Each is a no-op
 * unless its own variable is set; none is read by `npm run app` or the README.
 */
import { BrowserWindow } from 'electron';
import type { Clock } from '@seeya-ai/engine/core/ports.js';
import { quitAfterConfiguredDelay } from './quit-after.js';
import { verifyMenuAndClipboard } from './menu-clipboard.js';
import {
  captureLiveThemeToggleVerification,
  captureResumeProgressThenResult,
  captureSettingsCloseVerification,
  captureVerificationScreenshot,
} from './screenshot-captures.js';
import {
  captureButtonCenteringVerification,
  captureProjectsTabStatesVerification,
} from './projects-tab-captures.js';
import { captureSessionsTabStatesVerification } from './sessions-tab-captures.js';
import {
  captureConfirmationsVerification,
  captureDaemonOwnershipTransitionVerification,
} from './confirmations-captures.js';
import {
  captureAdoptionFlowVerification,
  captureSelectStatesVerification,
} from './adoption-captures.js';
import { captureProjectResumeVerification } from './verify-project-resume.js';
import { captureWindowMinVerification } from './verify-window-min.js';
import { captureProjectDetailsVerification } from './verification-project-details.js';
import { captureArchiveVerification } from './verification-archive.js';

export function registerRendererConsoleForwarding(window: BrowserWindow): void {
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
}

export function registerScreenshotCapture(window: BrowserWindow, clock: Clock): void {
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
}

export function registerProjectsTabStatesCapture(window: BrowserWindow, clock: Clock): void {
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
}

export function registerButtonCenteringCapture(window: BrowserWindow, clock: Clock): void {
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
}

export function registerSessionsTabStatesCapture(window: BrowserWindow, clock: Clock): void {
  // SEEYA_APP_VERIFY_SESSIONS_TAB_STATES_DIR (V2-T68): same "a DIRECTORY, not a single file" shape
  // as the Projects flag above — see `captureSessionsTabStatesVerification`'s own docstring for the
  // full sequence. Never set by `npm run app` or the README.
  const sessionsTabStatesDir = process.env.SEEYA_APP_VERIFY_SESSIONS_TAB_STATES_DIR;
  if (sessionsTabStatesDir !== undefined) {
    window.webContents.once('did-finish-load', () => {
      void captureSessionsTabStatesVerification(window, clock, sessionsTabStatesDir);
    });
  }
}

export function registerProjectResumeCapture(window: BrowserWindow, clock: Clock): void {
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
}

export function registerWindowMinCapture(window: BrowserWindow, clock: Clock): void {
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
}

export function registerConfirmationsCapture(window: BrowserWindow, clock: Clock): void {
  // SEEYA_APP_VERIFY_CONFIRMATIONS_DIR (V2-T71): same "a DIRECTORY, not a single file" shape as
  // the two flags above — see `captureConfirmationsVerification`'s own docstring for the full
  // sequence. Never set by `npm run app` or the README.
  const confirmationsDir = process.env.SEEYA_APP_VERIFY_CONFIRMATIONS_DIR;
  if (confirmationsDir !== undefined) {
    window.webContents.once('did-finish-load', () => {
      void captureConfirmationsVerification(window, clock, confirmationsDir);
    });
  }
}

export function registerDaemonOwnershipCapture(window: BrowserWindow, clock: Clock): void {
  // SEEYA_APP_VERIFY_DAEMON_OWNERSHIP_DIR (V2-T71): same "a DIRECTORY, not a single file" shape —
  // see `captureDaemonOwnershipTransitionVerification`'s own docstring for the full sequence.
  // Never set by `npm run app` or the README.
  const daemonOwnershipDir = process.env.SEEYA_APP_VERIFY_DAEMON_OWNERSHIP_DIR;
  if (daemonOwnershipDir !== undefined) {
    window.webContents.once('did-finish-load', () => {
      void captureDaemonOwnershipTransitionVerification(window, clock, daemonOwnershipDir);
    });
  }
}

export function registerAdoptionFlowCapture(window: BrowserWindow, clock: Clock): void {
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
}

export function registerProjectDetailsCapture(window: BrowserWindow, clock: Clock): void {
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
}

export function registerArchiveCapture(window: BrowserWindow, clock: Clock): void {
  // SEEYA_APP_VERIFY_ARCHIVE_DIR (V2-T84): same "a DIRECTORY, not a single file" shape as the flags
  // above — see `verification-archive.ts`'s own docstring for the sequence and for what the driver
  // script must have prepared (a disposable workspace with active and archived projects, a live
  // lock holder, the fake harness log). Never set by `npm run app` or the README.
  const archiveDir = process.env.SEEYA_APP_VERIFY_ARCHIVE_DIR;
  if (archiveDir !== undefined) {
    window.webContents.once('did-finish-load', () => {
      void captureArchiveVerification(window, clock, archiveDir, () =>
        quitAfterConfiguredDelay(clock),
      );
    });
  }
}

export function registerSelectStatesCapture(window: BrowserWindow, clock: Clock): void {
  // SEEYA_APP_VERIFY_SELECT_STATES_DIR (V2-T81): same "a DIRECTORY, not a single file" shape as the
  // flags above — see `captureSelectStatesVerification`'s own docstring for the sequence. Combine
  // with `SEEYA_APP_VERIFY_ADOPTION_FAKE`. Never set by `npm run app` or the README.
  const selectStatesDir = process.env.SEEYA_APP_VERIFY_SELECT_STATES_DIR;
  if (selectStatesDir !== undefined) {
    window.webContents.once('did-finish-load', () => {
      void captureSelectStatesVerification(window, clock, selectStatesDir);
    });
  }
}

export function registerMenuAndClipboardVerification(window: BrowserWindow, clock: Clock): void {
  // SEEYA_APP_VERIFY_MENU_AND_CLIPBOARD_PATH (V2-T74): writes `verifyMenuAndClipboard`'s own JSON
  // report — the menu-bar state always, and (combined with SEEYA_APP_AUTO_OPEN_SHELL_TAB=1) the
  // copy/paste round trip too. Never set by `npm run app` or the README.
  const verifyMenuAndClipboardPath = process.env.SEEYA_APP_VERIFY_MENU_AND_CLIPBOARD_PATH;
  if (verifyMenuAndClipboardPath !== undefined) {
    window.webContents.once('did-finish-load', () => {
      void verifyMenuAndClipboard(window, clock, verifyMenuAndClipboardPath);
    });
  }
}

export function registerSettingsCloseCapture(window: BrowserWindow, clock: Clock): void {
  const screenshotPath = process.env.SEEYA_APP_SCREENSHOT_PATH;
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
}
