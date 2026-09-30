/**
 * The tab strip and embedded terminals (V2-T2, split out of the former single-file `renderer.ts`
 * by V2-T62/D-051 — see that task's own AGENTS.md glossary entry). Excluded from
 * `packages/app/src`'s coverage floor with everything else in `electron/` (it cannot run without
 * a display) — the tab bookkeeping itself is `tabs/tab-model.ts` (imported here, unit-tested on
 * its own).
 *
 * **Never `window.prompt`** (spike M's "Correção depois do spike": it doesn't exist in the
 * renderer and throws) — the command bar below (V2-T2 item 3: "comando e diretório pedidos numa
 * barra de entrada, nunca `window.prompt`") is a real form instead.
 */
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { createTab, isRunning, markExited, withPid, type Tab } from '../tabs/tab-model.js';
import { MESSAGES } from '../text/messages.js';
import { TERMINAL_THEME_DARK, type TerminalTheme } from '../state/terminal-theme.js';
import type { ResumeTabOpenedEvent, TerminalFontConfigResponse } from '../ipc/channels.js';

interface OpenTab {
  readonly tab: Tab;
  readonly terminal: Terminal;
  readonly fitAddon: FitAddon;
  readonly container: HTMLDivElement;
}

const openTabs = new Map<string, OpenTab>();
let nextTabId = 0;

/**
 * V2-T63: every pane the tab strip can show — a terminal's own container (also in `openTabs`
 * above, for the terminal-specific bits `showTab` needs: `fitAddon.fit()`, `terminal.focus()`) AND
 * a page tab's own pane (`electron/page-tab-strip.ts#registerPagePane`, which has neither). One
 * registry so `showTab` below hides/shows BOTH kinds through the same loop — a page tab open at
 * the same time as a terminal tab always hides the other correctly, and vice versa.
 */
const paneContainers = new Map<string, HTMLElement>();

/** V2-T63 correction (real-window screenshot review, item 6): who wants to know which tab is
 * active — the lateral's own nav rows/Today card highlight themselves when their page tab is the
 * one showing (`sidebar-favorites-view.ts`'s own listener below). `showTab` is the single place
 * visibility changes, so this is the single place that announces it — never a second poll of
 * `aria-current` elsewhere. */
type ActiveTabListener = (id: string) => void;
const activeTabListeners: ActiveTabListener[] = [];

export function onActiveTabChanged(listener: ActiveTabListener): void {
  activeTabListeners.push(listener);
}

/** `electron/page-tab-strip.ts`'s own registration/removal — kept as functions, not an export of
 * the map itself, so only this module ever iterates or clears it directly. */
export function registerPane(id: string, container: HTMLElement): void {
  paneContainers.set(id, container);
}

export function unregisterPane(id: string): void {
  paneContainers.delete(id);
}

/**
 * Fetched once, at startup (`renderer.ts#main`), before `wireCommandBar` is wired — no tab can be
 * opened before this is populated, so `openTab` never needs a defensive fallback (V2-T2: "a
 * interface lê o config uma vez ao subir"; changing `terminalFontFamily`/`terminalFontSize`
 * needs a relaunch, documented in `README.md`, not here).
 */
let terminalFontConfig: TerminalFontConfigResponse;

export function setTerminalFontConfig(config: TerminalFontConfigResponse): void {
  terminalFontConfig = config;
}

/**
 * V2-T62 (D-051): the colours every terminal MOUNTED FROM NOW ON gets — `theme-view.ts` is the
 * only caller, right after it resolves the window's effective theme. Defaults to the dark theme
 * (this app's original, only theme before V2-T62) so a tab opened before the theme round trip
 * resolves — there is no such path today, `main()` awaits it first, but a future caller should
 * never see an unset value — still renders something coherent.
 */
let activeTerminalTheme: TerminalTheme = TERMINAL_THEME_DARK;

/** Updates the theme for every tab ALREADY open, and for every tab mounted after this call
 * (`mountTerminalTab` below always reads `activeTerminalTheme`) — "o terminal segue o tema"
 * (`docs/INTERFACE.md` princípio 1) applies live, not just to a fresh window. */
export function setActiveTerminalTheme(theme: TerminalTheme): void {
  activeTerminalTheme = theme;
  for (const open of openTabs.values()) {
    open.terminal.options.theme = theme;
    open.container.style.backgroundColor = theme.background;
  }
}

function newTabId(): string {
  nextTabId += 1;
  return `tab-${nextTabId}`;
}

/** V2-T63: exported so `electron/page-tab-strip.ts` appends its own buttons to the SAME strip a
 * terminal tab's button lives in — one strip, both kinds of tab. */
export function tabStrip(): HTMLElement {
  return document.getElementById('tab-strip') as HTMLElement;
}

function terminalHost(): HTMLElement {
  return document.getElementById('terminal-host') as HTMLElement;
}

/** V2-T63: exported so `electron/page-tab-strip.ts` can show a page tab's own pane through the
 * SAME function a terminal tab button already uses — one place decides "what's currently visible
 * in `#main`", regardless of which kind of tab asked for it. */
export function showTab(id: string): void {
  for (const [paneId, container] of paneContainers) {
    container.hidden = paneId !== id;
  }
  const buttons = tabStrip().querySelectorAll<HTMLButtonElement>('button.tab-button');
  for (const button of buttons) {
    button.setAttribute('aria-current', String(button.dataset.tabId === id));
  }
  const shown = openTabs.get(id);
  shown?.fitAddon.fit();
  // Maintainer's request (2026-09-17): the tab that was just shown — by "+"/Open, by clicking
  // its button, or by a resume — takes keyboard focus, so typing starts in the terminal
  // without a second click on it. A page tab (no `Terminal` of its own) simply has nothing to
  // focus here — the browser's own default tab order into its content still works.
  shown?.terminal.focus();
  for (const listener of activeTabListeners) {
    listener(id);
  }
}

/** PO acceptance of V2-T55, correction 3 (2026-09-25) — the one place that knows which tab is
 * currently shown, reused by `dialog-focus-return.ts` via `registerActiveTerminalFocuser` (this
 * function is passed there, once, at startup) so every `<dialog>` on the page returns focus here
 * on close. No tab open at all: leaves focus wherever it already is (D-025, never guessed) —
 * mirrors `showTab`'s own `shown?.terminal.focus()` for the identical "no open tab" case. */
export function focusActiveTabTerminal(): void {
  for (const open of openTabs.values()) {
    if (!open.container.hidden) {
      open.terminal.focus();
      return;
    }
  }
}

function addTabButton(id: string, label: string): void {
  const wrapper = document.createElement('span');

  const button = document.createElement('button');
  button.className = 'tab-button';
  button.type = 'button';
  button.textContent = label;
  button.dataset.tabId = id;
  button.addEventListener('click', () => showTab(id));
  wrapper.appendChild(button);

  const closeButton = document.createElement('button');
  closeButton.className = 'tab-close';
  closeButton.type = 'button';
  closeButton.textContent = '×';
  closeButton.addEventListener('click', () => {
    const open = openTabs.get(id);
    if (open !== undefined && !isRunning(open.tab)) {
      // V2-T3 item 2: the process already exited — × now removes the tab outright instead of
      // asking main.ts to end a process that's already gone.
      removeTabUi(id, wrapper, open);
      return;
    }
    // V2-T2: closing a LIVE tab ends its process; the tab itself stays visible (the exit handler
    // below marks it, it never removes the button on its own) until the process really exits — a
    // second click, once exited, is what removes it (branch above).
    window.seeya.closeTab({ id });
  });
  wrapper.appendChild(closeButton);

  tabStrip().appendChild(wrapper);
}

/**
 * V2-T3 item 2: drops a tab whose process has already exited — the × handler above is the only
 * caller. Disposes the `@xterm/xterm` instance (nothing else does) and removes both DOM pieces
 * (`addTabButton`'s own `wrapper`, and the terminal pane); if the removed tab was the one showing,
 * falls back to whatever tab remains, if any (`tabs/tab-model.ts#removeTab`'s own docstring: the
 * pure model doesn't know about "which tab is showing" — that's a renderer/DOM concern).
 *
 * **V2-T3 review: also tells the main process** (`window.seeya.removeTab`) so its own
 * `TabCollection` drops the entry too — otherwise it keeps matching a NEW session against this
 * tab's old pid if the OS reuses it (`CHANNELS.removeTab`'s own docstring has the concrete risk).
 */
function removeTabUi(id: string, wrapper: HTMLElement, open: OpenTab): void {
  const wasShown = !open.container.hidden;
  open.terminal.dispose();
  open.container.remove();
  wrapper.remove();
  openTabs.delete(id);
  unregisterPane(id);
  window.seeya.removeTab({ id });
  const remaining = wasShown ? openTabs.keys().next().value : undefined;
  if (remaining !== undefined) {
    showTab(remaining);
  }
}

function markTabButtonExited(id: string, exitCode: number): void {
  const button = tabStrip().querySelector<HTMLButtonElement>(
    `button.tab-button[data-tab-id="${id}"]`,
  );
  if (button !== null) {
    button.textContent = `${button.textContent ?? id} ${MESSAGES.tabExited(exitCode)}`;
  }
}

/**
 * Creates the `@xterm/xterm` instance, its DOM pane and tab-strip button for `tab`, and wires
 * keystrokes to `writeTab` — the part `openTab` (below, spawns via `createTab`) and
 * `openResumeTabUi` (V2-T4 item 2, the pty already exists by the time its event arrives) both need
 * identically; only how the pty gets spawned differs between the two callers.
 */
function mountTerminalTab(tab: Tab, label: string): Terminal {
  const container = document.createElement('div');
  container.className = 'terminal-pane';
  terminalHost().appendChild(container);

  // V2-T3: terminalFontConfig (fontFamily/fontSize, `state/terminal-font.ts`) — the embedded Nerd
  // Font falls back into effect here whenever the config-supplied stack doesn't resolve to
  // something installed, since the stack's own last entry is a generic `monospace`
  // (`config-schema.ts#TERMINAL_FONT_FAMILY_DEFAULT`'s own docstring). `fitAddon.fit()` right
  // below re-measures cell size against whatever font actually got applied here. V2-T62 (D-051):
  // `activeTerminalTheme` is whatever `theme-view.ts` last resolved — "o terminal segue o tema".
  const terminal = new Terminal({
    convertEol: true,
    fontFamily: terminalFontConfig.fontFamily,
    fontSize: terminalFontConfig.fontSize,
    theme: activeTerminalTheme,
  });
  // Same colour on the pane behind the terminal canvas, from the same theme, so the padding
  // around the cell grid never shows a different shade (`state/terminal-theme.ts`).
  container.style.backgroundColor = activeTerminalTheme.background;
  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open(container);
  fitAddon.fit();

  terminal.onData((data) => {
    window.seeya.writeTab({ id: tab.id, data });
  });

  openTabs.set(tab.id, { tab, terminal, fitAddon, container });
  registerPane(tab.id, container);
  addTabButton(tab.id, label);
  showTab(tab.id);
  return terminal;
}

/** Opens one command-bar tab: mounts the terminal UI first, then asks the main process to spawn
 * the pty behind it — in that order, so the terminal exists before any data can arrive for it
 * (`main.ts`'s own `onData` starts sending as soon as `createTab` resolves). */
async function openTab(command: string, args: readonly string[], cwd: string): Promise<void> {
  const id = newTabId();
  let tab = createTab({ id, command, args, cwd });
  const terminal = mountTerminalTab(tab, command === '' ? 'shell' : command);

  try {
    const response = await window.seeya.createTab({
      id,
      command,
      args,
      cwd,
      cols: terminal.cols,
      rows: terminal.rows,
    });
    tab = withPid(tab, response.pid);
    const open = openTabs.get(id);
    if (open !== undefined) {
      openTabs.set(id, { ...open, tab });
    }
  } catch (error) {
    // Command resolution failed (e.g. "claude" isn't on PATH) — main.ts's own
    // resolveHarnessOrThrow already names exactly what it searched (AGENTS.md's error-message
    // rule); show it in the terminal itself rather than leaving a silently empty pane.
    const message = error instanceof Error ? error.message : String(error);
    terminal.write(`\x1b[31m${message}\x1b[0m\r\n`);
  }
}

/**
 * V2-T4 item 2: creates the tab UI for a session `electron/main.ts`'s own `TabResumeOpener`
 * already spawned — never calls `window.seeya.createTab` (unlike `openTab` above), because the pty
 * exists by the time `CHANNELS.resumeTabOpened` arrives. Labeled with the handoff's `name`, not a
 * raw command (V2-T4: "a aba ... rotulada com o nome da sessão").
 */
function openResumeTabUi(event: ResumeTabOpenedEvent): void {
  const tab = withPid(
    createTab({ id: event.id, command: 'claude', args: [], cwd: event.cwd }),
    event.pid,
  );
  const terminal = mountTerminalTab(tab, event.label);
  // The main process spawned this pty at a fixed 80x24 (`main.ts#openResumeTab`: the pty has to
  // exist before the renderer has a terminal to measure) — a "+" tab never needs this because
  // `openTab` above measures its own terminal first. Without this resize the harness's TUI keeps
  // drawing 80x24 inside a bigger pane until the window itself is resized (found in PO review).
  window.seeya.resizeTab({ id: tab.id, cols: terminal.cols, rows: terminal.rows });
}

/** Wired once, at startup — the tab-specific slice of what used to be `wireIncomingEvents`. */
export function wireTabIncomingEvents(): void {
  window.seeya.onTabData(({ id, data }) => {
    openTabs.get(id)?.terminal.write(data);
  });
  window.seeya.onTabExit(({ id, exitCode }) => {
    // V2-T3 item 2: keeps this OpenTab's own `tab.status` in sync (mirrors what main.ts already
    // does for its own TabCollection) — the close-button handler above reads it to decide whether
    // × removes the tab outright or still just ends a live process.
    const open = openTabs.get(id);
    if (open !== undefined) {
      openTabs.set(id, { ...open, tab: markExited(open.tab, exitCode) });
    }
    markTabButtonExited(id, exitCode);
  });
  window.seeya.onResumeTabOpened((event) => openResumeTabUi(event));
}

/** Re-fits every open tab's terminal to its (now current) container size and pushes the new
 * cols/rows to its pty — the one thing every trigger below needs, extracted so none of them
 * duplicates the V2-T6 refresh-after-resize fix. */
function fitAllOpenTabs(): void {
  for (const [id, open] of openTabs) {
    open.fitAddon.fit();
    window.seeya.resizeTab({ id, cols: open.terminal.cols, rows: open.terminal.rows });
    // V2-T6: measured defect — after a resize+scroll, orphaned characters stayed at the left
    // edge of a Claude Code tab (its TUI redraws its own block with erase-to-end-of-line
    // sequences, and a row-wrap disagreement between ConPTY and xterm.js right after a resize
    // is what paints those wrong). A full refresh forces xterm.js to repaint every row from its
    // own buffer — cheap, and a no-op when nothing was actually stale.
    open.terminal.refresh(0, open.terminal.rows - 1);
  }
}

/**
 * V2-T30/V2-T48 item 6: a `ResizeObserver` on `#terminal-host`, not `window.addEventListener
 * ('resize', ...)` — two reasons, one measured and one structural:
 *
 * - **Structural, and enough on its own:** the lateral's own collapse toggle (item 2) changes
 *   `#terminal-host`'s width by re-flowing the sidebar/main flexbox — it never touches the
 *   window's own outer size, so `window`'s `resize` event **never fires** for it at all. Any
 *   fix for "the terminal reflows when the sidebar collapses" has to watch the terminal's own
 *   container, not the window.
 * - **Measured, inconclusive on this machine:** a temporary instrumentation run during this task
 *   (a `ResizeObserver` and a `window.resize` listener on `#terminal-host`, both logging the
 *   container's own rect, around a programmatic `window.maximize()`) showed the two firing within
 *   a millisecond of each other, both already reporting the POST-maximize size, in this sandbox's
 *   own `SEEYA_APP_OFFSCREEN` mode — the same mode `docs/DESEMPENHO.md` already notes doesn't fully
 *   represent a real, composited desktop. It did not reproduce the maintainer's own first-maximize
 *   defect (real Windows, a real display) one way or the other; a `ResizeObserver` fires strictly
 *   AFTER layout for every box-size change of the element it observes (the documented reason
 *   `@xterm/addon-fit`'s own README recommends it over a window-level listener), so it can only
 *   read a size at least as fresh as `window.resize` would, never staler.
 *
 * `#sidebar`'s own collapse also resizes `#terminal-host` indirectly (the flex layout above), so
 * one observer on the terminal's own container covers both triggers — no second observer needed
 * on `#sidebar` itself.
 */
export function wireWindowResize(): void {
  const observer = new ResizeObserver(() => fitAllOpenTabs());
  observer.observe(terminalHost());
}

function commandBar(): HTMLFormElement {
  return document.getElementById('command-bar') as HTMLFormElement;
}

function commandBarCommandInput(): HTMLInputElement {
  return document.getElementById('command-bar-command') as HTMLInputElement;
}

function commandBarCwdInput(): HTMLInputElement {
  return document.getElementById('command-bar-cwd') as HTMLInputElement;
}

/** The "+" button opens the command bar (a real form — never `window.prompt`, see this file's own
 * module docstring) instead of spawning a tab directly; submitting or cancelling closes it again. */
export function wireCommandBar(): void {
  document.getElementById('new-tab-button')?.addEventListener('click', () => {
    commandBar().hidden = false;
    commandBarCommandInput().focus();
  });

  document.getElementById('command-bar-cancel')?.addEventListener('click', () => {
    commandBar().hidden = true;
  });

  commandBar().addEventListener('submit', (event) => {
    event.preventDefault();
    const command = commandBarCommandInput().value.trim();
    const cwd = commandBarCwdInput().value.trim();
    commandBarCommandInput().value = '';
    commandBarCwdInput().value = '';
    commandBar().hidden = true;
    void openTab(command, [], cwd);
  });
}
