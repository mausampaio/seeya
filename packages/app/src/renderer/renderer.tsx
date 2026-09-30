/**
 * The renderer bootstrap (V2-T62/D-051: split from the former single-file `renderer.ts`, which
 * had grown to 1407 lines and every region's DOM wiring at once — absorbing the V2-T51 goal). Its
 * only job now: mount the window's Preact tree (`App.tsx`) into `#root`, then wire every LEGACY
 * region's own module (D-052/V2-T75: everything under `renderer/legacy/` — dialogs, the tab
 * strip, the Today/Projects/Sessions page panes, theme, settings), in the order each one's own
 * data dependency requires. The lateral (`renderer/features/sidebar/`) needs almost none of this
 * wiring any more — it is a real component now, mounted as part of `<App/>` itself, driven by its
 * own hooks subscribing straight to the IPC client. `wireAutostartControl` is the one exception
 * still wired here (D-052's own "Cuidados: autostart continua no rodapé até a V2-T65" — its
 * button/result text stay legacy-imperative, targeting the two stable anchor elements the new
 * `SidebarFooter` renders for it, unchanged by this task). Excluded from `packages/app/src`'s
 * coverage floor with everything else that cannot run without a display — every module this file
 * wires is unit-tested (the pure ones) or is itself excluded for the same "cannot run headless"
 * reason (the DOM-wiring ones).
 */
import { render } from 'preact';
import { AppShell } from './App.js';
import {
  registerActiveTerminalFocuser,
  wireDialogFocusReturn,
} from './legacy/dialog-focus-return.js';
import { wireTheme } from './legacy/theme-view.js';
import {
  focusActiveTabTerminal,
  setTerminalFontConfig,
  wireCommandBar,
  wireTabIncomingEvents,
  wireWindowResize,
} from './legacy/tabs-view.js';
import { wireFallbackDialog } from './legacy/fallback-dialog-view.js';
import { wireEndDayDialog } from './legacy/end-day-dialog-view.js';
import { wireAutostartControl } from './legacy/autostart-control-view.js';
import {
  offerDaemonOwnershipTransitionIfNeeded,
  wireDaemonOwnershipTransitionDialog,
} from './legacy/daemon-ownership-transition-view.js';
import { wireSettingsDialog } from './legacy/settings-dialog-view.js';
import { refreshTodayPanel, wireTodayIncomingEvents } from './legacy/today-panel-view.js';
import { wireProjectPanel } from './legacy/project-panel-view.js';
import './ipc/client.js';

/**
 * V2-T62 found this (cosmetic, root cause confirmed by this task): on window load, Electron's
 * `webContents` gaining native OS focus moves DOM focus to the first focusable element in tab
 * order even though nobody pressed Tab or clicked — so the global `:focus-visible` rule
 * (`tokens.css`, V2-T62) renders a ring nobody asked to see, right as the window opens. The DOM
 * `window`'s own `focus` event fires exactly at that moment; blurring whatever the synthetic focus
 * landed on, once, is what removes only that — every REAL keyboard/mouse focus afterward still
 * shows its ring normally, since this only ever runs once, before any of that can happen.
 */
function suppressInitialFocusRing(): void {
  window.addEventListener(
    'focus',
    () => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body) {
        active.blur();
      }
    },
    { once: true },
  );
}

/**
 * Fetches `terminalFontConfig`/the theme before wiring anything that could open a tab (the
 * command bar's submit handler, and `SEEYA_APP_AUTO_OPEN_SHELL_TAB`'s own simulated click) — see
 * `legacy/tabs-view.ts`'s own `terminalFontConfig`/`activeTerminalTheme` docstrings for why
 * `mountTerminalTab` never needs a fallback value for either.
 */
async function main(): Promise<void> {
  suppressInitialFocusRing();
  render(AppShell(), document.getElementById('root') as HTMLElement);

  setTerminalFontConfig(await window.seeya.getTerminalFontConfig());
  await wireTheme();
  wireTabIncomingEvents();
  wireWindowResize();
  wireCommandBar();
  wireFallbackDialog();
  wireEndDayDialog();
  wireAutostartControl();
  wireSettingsDialog();
  wireDaemonOwnershipTransitionDialog();
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
