/**
 * The renderer bootstrap (V2-T62/D-051: split from the former single-file `renderer.ts`, which
 * had grown to 1407 lines and every region's DOM wiring at once — absorbing the V2-T51 goal). Its
 * only job now: mount the window's Preact skeleton (`app-shell.tsx`) into `#root`, then wire every
 * region's own module, in the order each one's own data dependency requires. Excluded from
 * `packages/app/src`'s coverage floor with everything else in `electron/` (it cannot run without
 * a display) — every module this file wires is unit-tested (the pure ones) or is itself excluded
 * for the same "cannot run headless" reason (the DOM-wiring ones).
 */
import { render } from 'preact';
import { AppShell } from './app-shell.js';
import type { SeeyaApi } from './preload.js';
import { registerActiveTerminalFocuser, wireDialogFocusReturn } from './dialog-focus-return.js';
import { wireTheme } from './theme-view.js';
import {
  focusActiveTabTerminal,
  setTerminalFontConfig,
  wireCommandBar,
  wireTabIncomingEvents,
  wireWindowResize,
} from './tabs-view.js';
import { wireFallbackDialog } from './fallback-dialog-view.js';
import { wireEndDayDialog } from './end-day-dialog-view.js';
import { wireScheduleStrip } from './schedule-strip-view.js';
import { wireDaemonControl } from './daemon-control-view.js';
import { wireAutostartControl } from './autostart-control-view.js';
import {
  offerDaemonOwnershipTransitionIfNeeded,
  wireDaemonOwnershipTransitionDialog,
} from './daemon-ownership-transition-view.js';
import { wireSettingsDialog } from './settings-dialog-view.js';
import { refreshTodayPanel, wireTodayIncomingEvents } from './today-panel-view.js';
import { wireStatusPanel } from './status-panel-view.js';
import { wireProjectPanel } from './project-panel-view.js';

declare global {
  interface Window {
    seeya: SeeyaApi;
  }
}

/**
 * Fetches `terminalFontConfig`/the theme before wiring anything that could open a tab (the
 * command bar's submit handler, and `SEEYA_APP_AUTO_OPEN_SHELL_TAB`'s own simulated click) — see
 * `tabs-view.ts`'s own `terminalFontConfig`/`activeTerminalTheme` docstrings for why `mountTerminalTab`
 * never needs a fallback value for either.
 */
async function main(): Promise<void> {
  render(AppShell(), document.getElementById('root') as HTMLElement);

  setTerminalFontConfig(await window.seeya.getTerminalFontConfig());
  await wireTheme();
  wireTabIncomingEvents();
  wireWindowResize();
  wireCommandBar();
  wireFallbackDialog();
  wireEndDayDialog();
  wireScheduleStrip();
  wireDaemonControl();
  wireAutostartControl();
  wireSettingsDialog();
  wireDaemonOwnershipTransitionDialog();
  wireStatusPanel();
  wireTodayIncomingEvents();
  registerActiveTerminalFocuser(focusActiveTabTerminal);
  wireDialogFocusReturn();
  wireProjectPanel();
  await refreshTodayPanel();
  // V2-T13 item 5: after every other piece of the window is already wired and usable — the
  // ownership-transition question never blocks tabs/sidebar/settings from working.
  await offerDaemonOwnershipTransitionIfNeeded();
}

void main();
