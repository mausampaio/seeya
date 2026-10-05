/**
 * Click automations that drive the lateral (collapse, resize, the stray daemon-ownership dialog,
 * the Sessions tab link) — V2-T51: moved out of `createWindow` in `main/main.ts`. Each
 * registration is a no-op unless its own `SEEYA_APP_*` variable is set.
 */
import { BrowserWindow } from 'electron';
import type { Clock } from '@seeya-ai/engine/core/ports.js';
import { dismissDaemonOwnershipTransitionScript } from './click-automation-common.js';

export function registerToggleSidebarAutomation(window: BrowserWindow, clock: Clock): void {
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
}

export function registerDeclineDaemonOwnershipAutomation(
  window: BrowserWindow,
  clock: Clock,
): void {
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
}

export function registerResizeSidebarAutomation(window: BrowserWindow, clock: Clock): void {
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
}

export function registerNarrowSidebarAutomation(window: BrowserWindow, clock: Clock): void {
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
}

export function registerOpenSessionsTabAutomation(window: BrowserWindow, clock: Clock): void {
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
}
