/**
 * The renderer bootstrap (V2-T62/D-051: split from the former single-file `renderer.ts`, which
 * had grown to 1407 lines and every region's DOM wiring at once — absorbing the V2-T51 goal). Its
 * only job now: mount the window's Preact tree (`App.tsx`) into `#root`, then wire every LEGACY
 * region's own module (D-052/V2-T75: everything under `renderer/legacy/` — dialogs, the tab
 * strip, the Projects/Sessions page panes, theme), in the order each one's own data dependency
 * requires. The lateral (`renderer/features/sidebar/`), Settings (`renderer/features/settings/`,
 * V2-T65) and the Today tab (`renderer/features/today/`, V2-T66) need none of this wiring any
 * more — all are real components now, mounted as part of `<App/>` itself, driven by their own
 * hooks subscribing
 * straight to the IPC client (Settings' own autostart switch replaces the last "Cuidados:
 * autostart continua... até a V2-T65" exception D-052 had carved out here). End day
 * (`renderer/features/end-day/`, V2-T69) joined them the same way — it's mounted inside
 * `SidebarFooter`, no separate `wire*` call here. Excluded from
 * `packages/app/src`'s coverage floor with everything else that cannot run without a display —
 * every module this file wires is unit-tested (the pure ones) or is itself excluded for the same
 * "cannot run headless" reason (the DOM-wiring ones).
 *
 * V2-T66: `wireTodayIncomingEvents`/`refreshTodayPanel` (`renderer/legacy/today-panel-view.ts`,
 * apagado by this task) are gone from here — the Today tab is a real component now
 * (`renderer/features/today/Today.tsx`), driven by its own `useToday` hook subscribing straight to
 * the IPC client, the same "needs none of this wiring any more" shape this docstring already
 * describes above for the lateral/Settings.
 *
 * V2-T71: `wireFallbackDialog`/`wireDaemonOwnershipTransitionDialog`/
 * `offerDaemonOwnershipTransitionIfNeeded` (`renderer/legacy/fallback-dialog-view.ts`/
 * `daemon-ownership-transition-view.ts`, apagados by this task) are gone from here too, for the
 * same reason — `renderer/features/confirmations/ResumeFallbackDialog`/
 * `DaemonOwnershipTransitionDialog` are real components now, mounted as part of `<App/>`, each
 * fetching/subscribing on its own `useEffect`.
 */
import { render } from 'preact';
import { AppShell } from './App.js';
import {
  registerActiveTerminalFocuser,
  wireDialogFocusReturn,
} from './legacy/dialog-focus-return.js';
import { wireTheme } from './legacy/theme-view.js';
import { focusActiveTabTerminal } from './features/tabs/index.js';
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
 * Resolves the theme before anything else — `renderer/features/tabs/terminal-theme-registry.ts
 * #currentActiveTerminalTheme` (read by `TerminalPane` at mount) defaults to the dark theme until
 * this resolves, so the window's own real theme is in place before a person could possibly open a
 * tab (V2-T64: the tab strip's own font config/IPC wiring now lives inside `<TabStrip/>` itself,
 * mounted synchronously by the `render()` call below — no separate `wireTabIncomingEvents`/
 * `wireCommandBar`-style calls needed here any more).
 */
async function main(): Promise<void> {
  suppressInitialFocusRing();
  // D-052 (V2-T75) production defect, found by real-window screenshot verification: `AppShell`
  // now calls `useSidebarCollapse` (a real hook) at its own top level, so it MUST be mounted as a
  // proper Preact component (`<AppShell />`) — calling it as a plain function (`AppShell()`, what
  // this line did before this task, back when the whole tree was static markup with no hooks of
  // its own) skips Preact's own component-render setup entirely, and every hook inside throws
  // `Cannot read properties of undefined (reading '__H')` the instant it runs, since there is no
  // owning component instance for `useState`/`useEffect` to attach to.
  render(<AppShell />, document.getElementById('root') as HTMLElement);

  await wireTheme();
  registerActiveTerminalFocuser(focusActiveTabTerminal);
  wireDialogFocusReturn();
  wireProjectPanel();
}

void main();
