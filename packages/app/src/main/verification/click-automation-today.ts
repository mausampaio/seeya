/**
 * Click automations that drive the Today tab and the End day dialog (V2-T51: moved out of
 * `createWindow` in `main/main.ts`). Each registration is a no-op unless its own
 * `SEEYA_APP_*` variable is set.
 */
import { BrowserWindow } from 'electron';
import type { Clock } from '@seeya-ai/engine/core/ports.js';

export function registerResumeAllAutomation(window: BrowserWindow, clock: Clock): void {
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
}

export function registerOpenTodayTabAutomation(window: BrowserWindow, clock: Clock): void {
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
}

export function registerEndDayAutomation(window: BrowserWindow, clock: Clock): void {
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
}

export function registerEndDayFakeAutomation(window: BrowserWindow, clock: Clock): void {
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
}
