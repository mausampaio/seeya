/**
 * Click automations for the schedule strip and the Settings dialog (V2-T51: moved out of
 * `createWindow` in `main/main.ts`). Each registration is a no-op unless its own
 * `SEEYA_APP_*` variable is set.
 */
import { BrowserWindow } from 'electron';
import type { Clock } from '@seeya-ai/engine/core/ports.js';
import { dismissDaemonOwnershipTransitionScript } from './click-automation-common.js';

export function registerSnooze15Automation(window: BrowserWindow, clock: Clock): void {
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
}

export function registerEditSettingsAutomation(window: BrowserWindow, clock: Clock): void {
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
}

export function registerUndoSnoozeAutomation(window: BrowserWindow, clock: Clock): void {
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
}

export function registerSetEndOfDayAutomation(window: BrowserWindow, clock: Clock): void {
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
}

export function registerClickSkipTodayAutomation(window: BrowserWindow, clock: Clock): void {
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
}

export function registerOpenSnoozeMenuAutomation(window: BrowserWindow, clock: Clock): void {
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
}
