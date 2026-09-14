/**
 * The renderer bootstrap: DOM + `@xterm/xterm` wiring for the tab strip. Excluded from
 * `packages/app/src`'s coverage floor with everything else in `electron/` (it cannot run without
 * a display) — this file is intentionally thin, no decision of its own beyond "which DOM element
 * does this event belong to"; the tab bookkeeping itself is `tabs/tab-model.ts` (imported here,
 * unit-tested on its own).
 *
 * **Never `window.prompt`** (spike M's "Correção depois do spike": it doesn't exist in the
 * renderer and throws) — the command bar below is a real form instead.
 */
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { createTab, withPid, type Tab } from '../tabs/tab-model.js';
import { MESSAGES } from '../text/messages.js';
import type { SeeyaApi } from './preload.js';

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
  const buttons = tabStrip().querySelectorAll<HTMLButtonElement>('button[data-tab-id]');
  for (const button of buttons) {
    button.setAttribute('aria-current', String(button.dataset.tabId === id));
  }
  openTabs.get(id)?.fitAddon.fit();
}

function addTabButton(id: string, label: string): void {
  const button = document.createElement('button');
  button.textContent = label;
  button.dataset.tabId = id;
  button.addEventListener('click', () => showTab(id));
  tabStrip().appendChild(button);
}

function markTabButtonExited(id: string, exitCode: number): void {
  const button = tabStrip().querySelector<HTMLButtonElement>(`button[data-tab-id="${id}"]`);
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
}

function wireIncomingEvents(): void {
  window.seeya.onTabData(({ id, data }) => {
    openTabs.get(id)?.terminal.write(data);
  });
  window.seeya.onTabExit(({ id, exitCode }) => {
    markTabButtonExited(id, exitCode);
  });
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

function wireNewTabButton(): void {
  const button = document.getElementById('new-tab-button') as HTMLButtonElement;
  button.addEventListener('click', () => {
    // Step (b) of V2-T2: "+" opens the system shell directly, cwd left blank so main.ts defaults
    // it to the real home directory (`composition/index.ts#AppContext.homeDir`) — the command bar
    // asking for command/cwd is step (d).
    void openTab('', [], '');
  });
}

function main(): void {
  wireIncomingEvents();
  wireWindowResize();
  wireNewTabButton();
}

main();
