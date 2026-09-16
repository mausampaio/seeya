/**
 * The renderer bootstrap: DOM + `@xterm/xterm` wiring for the tab strip, sidebar and status panel.
 * Excluded from `packages/app/src`'s coverage floor with everything else in `electron/` (it cannot
 * run without a display) — this file is intentionally thin, no decision of its own beyond "which
 * DOM element does this event belong to"; the tab bookkeeping itself is `tabs/tab-model.ts`
 * (imported here, unit-tested on its own).
 *
 * **Never `window.prompt`** (spike M's "Correção depois do spike": it doesn't exist in the
 * renderer and throws) — the command bar below (docs/PLANO-DE-ENTREGA.md V2-T2, item 3: "comando e
 * diretório pedidos numa barra de entrada, nunca `window.prompt`") is a real form instead.
 */
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { createTab, isRunning, markExited, withPid, type Tab } from '../tabs/tab-model.js';
import { MESSAGES } from '../text/messages.js';
import type { SeeyaApi } from './preload.js';
import type { SidebarRow } from '../sidebar/sidebar-data.js';
import type { FallbackConfirmRequestEvent, TerminalFontConfigResponse } from '../ipc/channels.js';

declare global {
  interface Window {
    seeya: SeeyaApi;
  }
}

interface OpenTab {
  readonly tab: Tab;
  readonly terminal: Terminal;
  readonly fitAddon: FitAddon;
  readonly container: HTMLDivElement;
}

const openTabs = new Map<string, OpenTab>();
let nextTabId = 0;

/**
 * Fetched once, at startup (`main` below), before `wireCommandBar` is wired — no tab can be
 * opened before this is populated, so `openTab` never needs a defensive fallback (V2-T2: "a
 * interface lê o config uma vez ao subir"; changing `terminalFontFamily`/`terminalFontSize`
 * needs a relaunch, documented in `README.md`, not here).
 */
let terminalFontConfig: TerminalFontConfigResponse;

function newTabId(): string {
  nextTabId += 1;
  return `tab-${nextTabId}`;
}

function tabStrip(): HTMLElement {
  return document.getElementById('tab-strip') as HTMLElement;
}

function terminalHost(): HTMLElement {
  return document.getElementById('terminal-host') as HTMLElement;
}

function showTab(id: string): void {
  for (const [openId, open] of openTabs) {
    open.container.hidden = openId !== id;
  }
  const buttons = tabStrip().querySelectorAll<HTMLButtonElement>('button.tab-button');
  for (const button of buttons) {
    button.setAttribute('aria-current', String(button.dataset.tabId === id));
  }
  openTabs.get(id)?.fitAddon.fit();
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
    // docs/PLANO-DE-ENTREGA.md V2-T2: closing a LIVE tab ends its process; the tab itself stays
    // visible (onTabExit below marks it, it never removes the button on its own) until the
    // process really exits — a second click, once exited, is what removes it (branch above).
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

/** Opens one tab: creates the model entry, an `@xterm/xterm` instance, and asks the main process
 * to spawn the pty behind it — in that order, so the terminal exists before any data can arrive
 * for it (`main.ts`'s own `onData` starts sending as soon as `createTab` resolves). */
async function openTab(command: string, args: readonly string[], cwd: string): Promise<void> {
  const id = newTabId();
  let tab = createTab({ id, command, args, cwd });

  const container = document.createElement('div');
  container.className = 'terminal-pane';
  terminalHost().appendChild(container);

  // V2-T3: terminalFontConfig (fontFamily/fontSize, `state/terminal-font.ts`) — the embedded Nerd
  // Font falls back into effect here whenever the config-supplied stack doesn't resolve to
  // something installed, since the stack's own last entry is a generic `monospace`
  // (`config-schema.ts#TERMINAL_FONT_FAMILY_DEFAULT`'s own docstring). `fitAddon.fit()` right
  // below re-measures cell size against whatever font actually got applied here.
  const terminal = new Terminal({
    convertEol: true,
    fontFamily: terminalFontConfig.fontFamily,
    fontSize: terminalFontConfig.fontSize,
  });
  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open(container);
  fitAddon.fit();

  terminal.onData((data) => {
    window.seeya.writeTab({ id, data });
  });

  openTabs.set(id, { tab, terminal, fitAddon, container });
  addTabButton(id, command === '' ? 'shell' : command);
  showTab(id);

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

function wireIncomingEvents(): void {
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
  window.seeya.onSessionsUpdate(({ rows }) => {
    renderSidebar(rows);
  });
  window.seeya.onStatusUpdate(({ text }) => {
    const panel = document.getElementById('status-panel') as HTMLElement;
    panel.textContent = text;
  });
  window.seeya.onConfirmFallbackRequest((event) => showFallbackDialog(event));
}

function fallbackDialog(): HTMLDialogElement {
  return document.getElementById('fallback-dialog') as HTMLDialogElement;
}

/** Sends the person's answer and closes the dialog — the ONLY way a pending fallback question
 * ever gets answered, whether by a button click or by the dialog's own "cancel" event below. */
function answerFallbackDialog(requestId: string, decision: 'open' | 'skip'): void {
  window.seeya.answerFallbackConfirm({ requestId, decision });
  fallbackDialog().close();
}

/** V2-T4 item 3: populates and opens the dialog for one `confirmFallbackRequest` — `requestId` is
 * stashed on the element itself (`dataset`) so the button/cancel handlers wired once in
 * `wireFallbackDialog` below can find it without a second piece of state to keep in sync. */
function showFallbackDialog(event: FallbackConfirmRequestEvent): void {
  (document.getElementById('fallback-dialog-title') as HTMLElement).textContent =
    MESSAGES.fallbackDialogTitle(event.sessionName);
  (document.getElementById('fallback-dialog-reason') as HTMLElement).textContent =
    `${event.reasonText} (${event.cwd})`;
  const dialog = fallbackDialog();
  dialog.dataset.requestId = event.requestId;
  dialog.showModal();
}

/** Wired once, at startup — the dialog element itself is reused for every fallback question, one
 * at a time (`PendingFallbackRequests`'s own docstring on the production shape this assumes). */
function wireFallbackDialog(): void {
  const dialog = fallbackDialog();
  (document.getElementById('fallback-dialog-body') as HTMLElement).textContent =
    MESSAGES.fallbackDialogBody;
  const openButton = document.getElementById('fallback-dialog-open') as HTMLButtonElement;
  openButton.textContent = MESSAGES.fallbackDialogOpen;
  openButton.addEventListener('click', () => {
    answerFallbackDialog(dialog.dataset.requestId ?? '', 'open');
  });
  const skipButton = document.getElementById('fallback-dialog-skip') as HTMLButtonElement;
  skipButton.textContent = MESSAGES.fallbackDialogSkip;
  skipButton.addEventListener('click', () => {
    answerFallbackDialog(dialog.dataset.requestId ?? '', 'skip');
  });
  // "cancel" fires on Escape (and any other native dismissal) — V2-T4's own cuidado, "fechar sem
  // escolher = pular": closing the dialog without a button click must still answer "skip", never
  // leave `resumeSessions` waiting forever on a question nobody answered.
  dialog.addEventListener('cancel', () => {
    answerFallbackDialog(dialog.dataset.requestId ?? '', 'skip');
  });
}

/** Renders the sidebar's session list — same rows `seeya sessions` would print
 * (docs/PLANO-DE-ENTREGA.md V2-T2), one `<li>` per discovered session, marked `.matched` when it
 * corresponds to a tab open in this window (by pid, D-025: no correspondence, no mark). */
function renderSidebar(rows: readonly SidebarRow[]): void {
  const list = document.getElementById('session-list') as HTMLElement;
  list.textContent = '';
  if (rows.length === 0) {
    const empty = document.createElement('li');
    empty.textContent = MESSAGES.sidebarEmpty;
    list.appendChild(empty);
    return;
  }
  for (const row of rows) {
    const item = document.createElement('li');
    item.textContent = `${row.name} (${row.state})`;
    item.title = row.cwd;
    if (row.matchedTabId !== null) {
      item.classList.add('matched');
    }
    list.appendChild(item);
  }
}

/** Resizing the window resizes every open tab's pty (docs/PLANO-DE-ENTREGA.md V2-T2, item 3). */
function wireWindowResize(): void {
  window.addEventListener('resize', () => {
    for (const [id, open] of openTabs) {
      open.fitAddon.fit();
      window.seeya.resizeTab({ id, cols: open.terminal.cols, rows: open.terminal.rows });
    }
  });
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
function wireCommandBar(): void {
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

/** Fetches `terminalFontConfig` before wiring anything that could open a tab (the command bar's
 * submit handler, and `SEEYA_APP_AUTO_OPEN_SHELL_TAB`'s own simulated click) — see
 * `terminalFontConfig`'s own docstring for why `openTab` never needs a fallback value. */
async function main(): Promise<void> {
  terminalFontConfig = await window.seeya.getTerminalFontConfig();
  wireIncomingEvents();
  wireWindowResize();
  wireCommandBar();
  wireFallbackDialog();
}

void main();
