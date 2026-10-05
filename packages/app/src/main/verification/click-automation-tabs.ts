/**
 * Click automations that open, switch and close tabs (V2-T51: moved out of `createWindow` in
 * `main/main.ts`). Each registration is a no-op unless its own `SEEYA_APP_*` variable is set.
 */
import type { BrowserWindow } from 'electron';
import { CHANNELS } from '../../ipc/channels.js';
import type { TabDataEvent, ResumeTabOpenedEvent } from '../../ipc/channels.js';
import type { Clock } from '@seeya-ai/engine/core/ports.js';
import { dismissDaemonOwnershipTransitionScript } from './click-automation-common.js';

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
export const NERD_GLYPH_PROOF_LINE = '  \r\n';

export function registerOpenShellTabAutomation(window: BrowserWindow, clock: Clock): void {
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
}

export function registerSwitchToAllProjectsAutomation(window: BrowserWindow, clock: Clock): void {
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
}

export function registerHoverFirstFavoriteAutomation(window: BrowserWindow, clock: Clock): void {
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
}

export function registerTerminalResizeReproAutomation(window: BrowserWindow, clock: Clock): void {
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
}

export function registerFocusReturnAutomation(window: BrowserWindow, clock: Clock): void {
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
}

export function registerTabStripDemoAutomation(window: BrowserWindow, clock: Clock): void {
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
}
