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
import { createTab, withPid, type Tab } from '../tabs/tab-model.js';
import { MESSAGES } from '../text/messages.js';
import type { SeeyaApi } from './preload.js';
import type { SidebarRow } from '../sidebar/sidebar-data.js';

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
    // docs/PLANO-DE-ENTREGA.md V2-T2: closing a tab ends its process; the tab itself stays
    // visible (onTabExit below marks it, it never removes the button) until the real process
    // exit event confirms it.
    window.seeya.closeTab({ id });
  });
  wrapper.appendChild(closeButton);

  tabStrip().appendChild(wrapper);
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

  const terminal = new Terminal({ convertEol: true });
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
    markTabButtonExited(id, exitCode);
  });
  window.seeya.onSessionsUpdate(({ rows }) => {
    renderSidebar(rows);
  });
  window.seeya.onStatusUpdate(({ text }) => {
    const panel = document.getElementById('status-panel') as HTMLElement;
    panel.textContent = text;
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

function main(): void {
  wireIncomingEvents();
  wireWindowResize();
  wireCommandBar();
}

main();
