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
import { TERMINAL_THEME } from '../state/terminal-theme.js';
import type { SeeyaApi } from './preload.js';
import type { SidebarRow } from '../sidebar/sidebar-data.js';
import type {
  EndDayPreviewResponse,
  FallbackConfirmRequestEvent,
  ResumeSummaryResponse,
  ResumeTabOpenedEvent,
  ScheduleUpdateEvent,
  TerminalFontConfigResponse,
} from '../ipc/channels.js';
import type { TodayPanelData, TodaySessionRow } from '../state/today-panel.js';
import { reduceEndDayPanel, type EndDayPanelState } from '../state/end-day-panel.js';
import { reduceDaemonControl, type DaemonControlState } from '../state/daemon-control-panel.js';

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
  const shown = openTabs.get(id);
  shown?.fitAddon.fit();
  // Maintainer's request (2026-09-17): the tab that was just shown — by "+"/Open, by clicking
  // its button, or by a resume — takes keyboard focus, so typing starts in the terminal
  // without a second click on it.
  shown?.terminal.focus();
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
  // below re-measures cell size against whatever font actually got applied here.
  const terminal = new Terminal({
    convertEol: true,
    fontFamily: terminalFontConfig.fontFamily,
    fontSize: terminalFontConfig.fontSize,
    theme: TERMINAL_THEME,
  });
  // Same colour on the pane behind the terminal canvas, from the same constant, so the padding
  // around the cell grid never shows a different shade (`state/terminal-theme.ts`).
  container.style.backgroundColor = TERMINAL_THEME.background;
  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open(container);
  fitAddon.fit();

  terminal.onData((data) => {
    window.seeya.writeTab({ id: tab.id, data });
  });

  openTabs.set(tab.id, { tab, terminal, fitAddon, container });
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
  window.seeya.onResumeProgress(({ index, total, name }) => {
    const progress = document.getElementById('today-progress');
    if (progress !== null) {
      progress.textContent = MESSAGES.todayResumeProgress(index, total, name);
    }
  });
  window.seeya.onResumeTabOpened((event) => openResumeTabUi(event));
  // V2-T5b item 1: the faixa de horário, pushed on the same refresh tick as onStatusUpdate above.
  window.seeya.onScheduleUpdate((event) => renderScheduleStrip(event));
  // V2-T5b item 3: the daemon's own liveness, same refresh tick.
  window.seeya.onDaemonAvailabilityUpdate((availability) => {
    daemonControlState = reduceDaemonControl(daemonControlState, {
      kind: 'availabilityUpdated',
      availability,
    });
    renderDaemonControl();
  });
  // V2-T5a item 4: "capturing N of M: <name>" while "Run end-day now" is in flight — a no-op if
  // the dialog has already moved past `running` (e.g. a straggler event after `runFinished`),
  // same guard `reduceEndDayPanel`'s own `progress` case already enforces.
  window.seeya.onEndDayProgress(({ index, total, name }) => {
    endDayState = reduceEndDayPanel(endDayState, {
      kind: 'progress',
      progressText: MESSAGES.endDayCaptureProgress(index, total, name),
    });
    renderEndDayDialog();
  });
}

function fallbackDialog(): HTMLDialogElement {
  return document.getElementById('fallback-dialog') as HTMLDialogElement;
}

function fallbackResumeWithoutPlanButton(): HTMLButtonElement {
  return document.getElementById('fallback-dialog-resume-without-plan') as HTMLButtonElement;
}

/** Sends the person's answer and closes the dialog — the ONLY way a pending fallback question
 * ever gets answered, whether by a button click or by the dialog's own "cancel" event below.
 * `'resumeWithoutPlan'` (V2-T7) is only ever sent by a click on that button, which stays `hidden`
 * for a `resumeFailed` question (`showFallbackDialog` below) — so it's never reachable there. */
function answerFallbackDialog(
  requestId: string,
  decision: 'open' | 'resumeWithoutPlan' | 'skip',
): void {
  window.seeya.answerFallbackConfirm({ requestId, decision });
  fallbackDialog().close();
}

/**
 * V2-T4 item 3: populates and opens the dialog for one `confirmFallbackRequest` — `requestId` is
 * stashed on the element itself (`dataset`) so the button/cancel handlers wired once in
 * `wireFallbackDialog` below can find it without a second piece of state to keep in sync.
 *
 * **V2-T7 item 4: `offersResumeWithoutPlan` decides which button shows and which one takes
 * focus.** For a `promptTooLarge` reason, "Resume without the plan" is shown FIRST and focused —
 * the new default, mirroring the CLI's blank-answer default for the same reason (`core/
 * resume-fallback-decision.ts`'s own docstring); for `resumeFailed`, that button stays `hidden`
 * entirely (there is no free option to offer) and "Open a fresh session" keeps the focus it
 * always had.
 */
function showFallbackDialog(event: FallbackConfirmRequestEvent): void {
  (document.getElementById('fallback-dialog-title') as HTMLElement).textContent =
    MESSAGES.fallbackDialogTitle(event.sessionName);
  (document.getElementById('fallback-dialog-reason') as HTMLElement).textContent =
    `${event.reasonText} (${event.cwd})`;
  (document.getElementById('fallback-dialog-body') as HTMLElement).textContent =
    MESSAGES.fallbackDialogBody(event.offersResumeWithoutPlan);
  const resumeWithoutPlanButton = fallbackResumeWithoutPlanButton();
  resumeWithoutPlanButton.hidden = !event.offersResumeWithoutPlan;
  const dialog = fallbackDialog();
  dialog.dataset.requestId = event.requestId;
  dialog.showModal();
  const focusTarget = event.offersResumeWithoutPlan
    ? resumeWithoutPlanButton
    : (document.getElementById('fallback-dialog-open') as HTMLButtonElement);
  focusTarget.focus();
}

/** Wired once, at startup — the dialog element itself is reused for every fallback question, one
 * at a time (`PendingFallbackRequests`'s own docstring on the production shape this assumes). */
function wireFallbackDialog(): void {
  const dialog = fallbackDialog();
  const resumeWithoutPlanButton = fallbackResumeWithoutPlanButton();
  resumeWithoutPlanButton.textContent = MESSAGES.fallbackDialogResumeWithoutPlan;
  resumeWithoutPlanButton.addEventListener('click', () => {
    answerFallbackDialog(dialog.dataset.requestId ?? '', 'resumeWithoutPlan');
  });
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
  // escolher = pular" for resumeFailed; V2-T7 changes the DEFAULT for promptTooLarge to "resume
  // without the plan", so closing that question without choosing must match its own new default,
  // not always "skip" — same per-reason default `core/resume-fallback-decision.ts#
  // parseFallbackAnswer('')` already applies to a blank CLI answer.
  dialog.addEventListener('cancel', () => {
    const decision = resumeWithoutPlanButton.hidden ? 'skip' : 'resumeWithoutPlan';
    answerFallbackDialog(dialog.dataset.requestId ?? '', decision);
  });
}

/**
 * V2-T5a items 1/4: the "End day…" button and its preview-as-confirmation/progress/result dialog
 * — one native `<dialog>` reused across the whole `EndDayPanelState` lifecycle (`idle` →
 * `previewPending` → `preview` → `running` → `result`), the same `showModal()`/`cancel`-event
 * pattern `wireFallbackDialog` above already uses. `endDayState` is the single source of truth;
 * every handler below updates it through `reduceEndDayPanel` (`state/end-day-panel.ts`) and then
 * calls `renderEndDayDialog` — never mutates the DOM directly from an event handler.
 */
let endDayState: EndDayPanelState = { kind: 'idle' };

function endDayDialog(): HTMLDialogElement {
  return document.getElementById('end-day-dialog') as HTMLDialogElement;
}

/** Renders the dialog's contents and button visibility from `endDayState` alone — called after
 * every event the handlers below feed into `reduceEndDayPanel`, so the DOM never drifts from the
 * state machine that owns it. */
function renderEndDayDialog(): void {
  const dialog = endDayDialog();
  const report = document.getElementById('end-day-dialog-report') as HTMLElement;
  const cost = document.getElementById('end-day-dialog-cost') as HTMLElement;
  const progress = document.getElementById('end-day-dialog-progress') as HTMLElement;
  const runButton = document.getElementById('end-day-dialog-run') as HTMLButtonElement;
  const cancelButton = document.getElementById('end-day-dialog-cancel') as HTMLButtonElement;

  if (endDayState.kind === 'idle') {
    if (dialog.open) {
      dialog.close();
    }
    return;
  }
  (document.getElementById('end-day-dialog-title') as HTMLElement).textContent =
    MESSAGES.endDayDialogTitle;
  if (!dialog.open) {
    dialog.showModal();
  }

  if (endDayState.kind === 'previewPending') {
    report.textContent = MESSAGES.endDayDialogLoadingPreview;
    cost.textContent = '';
    progress.hidden = true;
    runButton.hidden = true;
    cancelButton.hidden = true;
    return;
  }
  if (endDayState.kind === 'preview') {
    report.textContent = endDayState.reportText;
    cost.textContent = MESSAGES.endDayCostCeiling(endDayState.costCeiling);
    progress.hidden = true;
    runButton.hidden = false;
    runButton.textContent = MESSAGES.endDayRunNow;
    cancelButton.hidden = false;
    cancelButton.textContent = MESSAGES.endDayCancel;
    return;
  }
  if (endDayState.kind === 'running') {
    progress.hidden = false;
    progress.textContent = endDayState.progressText ?? MESSAGES.endDayRunningNoProgressYet;
    runButton.hidden = true;
    cancelButton.hidden = true;
    return;
  }
  // 'result': the report pre-block swaps from the preview to the real run's own literal text
  // (V2-T5a item 4) — the SAME element, so a person doesn't have to hunt for a second place the
  // final report shows up.
  report.textContent = endDayState.reportText;
  progress.hidden = true;
  runButton.hidden = true;
  cancelButton.hidden = false;
  cancelButton.textContent = MESSAGES.endDayClose;
}

/** "End day…" clicked: fetches the dry-run preview and shows it as the confirmation itself
 * (D-039, D-002 — nothing is written or terminated by this call, `main.ts`'s own handler docstring
 * has the guarantee). Guards against a stray second click while already open/loading the same way
 * `handleResumeSelected`'s own button-disable convention does elsewhere in this file. */
async function handleEndDayOpenClicked(): Promise<void> {
  if (endDayState.kind !== 'idle') {
    return;
  }
  endDayState = reduceEndDayPanel(endDayState, { kind: 'openClicked' });
  renderEndDayDialog();
  const response: EndDayPreviewResponse = await window.seeya.endDayPreview();
  // The person may have cancelled WHILE the preview was in flight — a stale response must not
  // resurrect a dialog they already dismissed (D-025: only apply what's still relevant).
  if (endDayState.kind !== 'previewPending') {
    return;
  }
  endDayState = reduceEndDayPanel(endDayState, {
    kind: 'previewReady',
    reportText: response.reportText,
    costCeiling: response.costCeiling,
  });
  renderEndDayDialog();
}

/** Cancel/Close/Escape — "fechar a prévia sem escolher é cancelar" (V2-T5a item 1). Also the
 * dialog's own "Close" button once a result is showing (item 4): either way, back to `idle`. */
function handleEndDayCancelOrClose(): void {
  endDayState = reduceEndDayPanel(endDayState, { kind: 'cancelled' });
  endDayState = reduceEndDayPanel(endDayState, { kind: 'closed' });
  renderEndDayDialog();
}

/**
 * "Run end-day now" clicked (V2-T5a item 4): runs the real `endDay`, one at a time — this
 * function only proceeds from `preview` (the button is hidden in every other state, and the
 * reducer itself refuses `runClicked` from anywhere else, so a stray second call is a no-op even
 * if it somehow fired). Refreshes the "Today" panel once the run resolves — the freshly-written
 * handoffs/briefing are what tomorrow's `start-day` will find; the status panel picks up the same
 * write on its own next ambient refresh tick (`main.ts`'s own `runRefreshLoop`, at most
 * `REFRESH_INTERVAL_MS` away), no separate push needed here.
 */
async function handleEndDayRunClicked(): Promise<void> {
  if (endDayState.kind !== 'preview') {
    return;
  }
  endDayState = reduceEndDayPanel(endDayState, { kind: 'runClicked' });
  renderEndDayDialog();
  const response = await window.seeya.endDayRun();
  endDayState = reduceEndDayPanel(endDayState, {
    kind: 'runFinished',
    reportText: response.reportText,
  });
  renderEndDayDialog();
  await refreshTodayPanel();
}

/** Wired once, at startup. */
function wireEndDayDialog(): void {
  const openButton = document.getElementById('end-day-button') as HTMLButtonElement;
  openButton.textContent = MESSAGES.endDayButton;
  openButton.addEventListener('click', () => {
    void handleEndDayOpenClicked();
  });
  document.getElementById('end-day-dialog-run')?.addEventListener('click', () => {
    void handleEndDayRunClicked();
  });
  document.getElementById('end-day-dialog-cancel')?.addEventListener('click', () => {
    handleEndDayCancelOrClose();
  });
  endDayDialog().addEventListener('cancel', () => {
    handleEndDayCancelOrClose();
  });
}

/**
 * V2-T5b item 1: renders the faixa de horário from whatever `buildScheduleStripData` last
 * produced — called after every `onScheduleUpdate` push (the ambient refresh tick) and again,
 * immediately, after a Snooze/Skip click resolves (`handleScheduleAdjustment` below), so the
 * faixa never waits up to `REFRESH_INTERVAL_MS` to reflect what the person just clicked.
 */
function renderScheduleStrip(data: ScheduleUpdateEvent): void {
  (document.getElementById('schedule-strip-text') as HTMLElement).textContent = data.text;
  const snooze15 = document.getElementById('schedule-strip-snooze-15') as HTMLButtonElement;
  const snooze30 = document.getElementById('schedule-strip-snooze-30') as HTMLButtonElement;
  const snooze1h = document.getElementById('schedule-strip-snooze-1h') as HTMLButtonElement;
  const skip = document.getElementById('schedule-strip-skip') as HTMLButtonElement;
  snooze15.hidden = !data.canSnooze;
  snooze30.hidden = !data.canSnooze;
  snooze1h.hidden = !data.canSnooze;
  skip.hidden = !data.canSkip;
}

/** One click handler for all three Snooze buttons and "Skip today" — `request` is `null` for
 * skip, one of D-006's three increments otherwise. Both IPC calls return the freshly recomputed
 * strip (`main.ts`'s own handler docstring), rendered immediately rather than waiting for the
 * next ambient `onScheduleUpdate` tick. */
async function handleScheduleAdjustment(minutes: 15 | 30 | 60 | null): Promise<void> {
  const updated =
    minutes === null ? await window.seeya.skipToday() : await window.seeya.snoozeToday({ minutes });
  renderScheduleStrip(updated);
}

/** Wired once, at startup. */
function wireScheduleStrip(): void {
  const snooze15 = document.getElementById('schedule-strip-snooze-15') as HTMLButtonElement;
  const snooze30 = document.getElementById('schedule-strip-snooze-30') as HTMLButtonElement;
  const snooze1h = document.getElementById('schedule-strip-snooze-1h') as HTMLButtonElement;
  const skip = document.getElementById('schedule-strip-skip') as HTMLButtonElement;
  snooze15.textContent = MESSAGES.scheduleStripSnooze15;
  snooze30.textContent = MESSAGES.scheduleStripSnooze30;
  snooze1h.textContent = MESSAGES.scheduleStripSnooze1h;
  skip.textContent = MESSAGES.scheduleStripSkipToday;
  snooze15.addEventListener('click', () => void handleScheduleAdjustment(15));
  snooze30.addEventListener('click', () => void handleScheduleAdjustment(30));
  snooze1h.addEventListener('click', () => void handleScheduleAdjustment(60));
  skip.addEventListener('click', () => void handleScheduleAdjustment(null));
}

/**
 * V2-T5b item 3: "Start daemon"/"Stop daemon" — one native button, driven end to end by
 * `state/daemon-control-panel.ts#reduceDaemonControl`, the same "one state machine, one render
 * function" discipline `endDayState`/`renderEndDayDialog` above already establish for the
 * "End day…" dialog.
 */
let daemonControlState: DaemonControlState = { kind: 'idle', availability: { kind: 'unknown' } };

function renderDaemonControl(): void {
  const button = document.getElementById('daemon-control-button') as HTMLButtonElement;
  const result = document.getElementById('daemon-control-result') as HTMLElement;

  if (daemonControlState.kind === 'running') {
    button.textContent = MESSAGES.daemonControlRunning;
    button.disabled = true;
    return;
  }
  if (daemonControlState.kind === 'result') {
    result.textContent = daemonControlState.resultText;
  }
  const availability = daemonControlState.availability;
  if (availability.kind === 'unknown') {
    button.textContent = MESSAGES.daemonControlUnknown;
    button.disabled = true;
    return;
  }
  button.textContent =
    availability.kind === 'start' ? MESSAGES.daemonControlStart : MESSAGES.daemonControlStop;
  button.disabled = false;
}

async function handleDaemonControlClicked(): Promise<void> {
  if (daemonControlState.kind !== 'idle' || daemonControlState.availability.kind === 'unknown') {
    return;
  }
  const action = daemonControlState.availability.kind === 'start' ? 'start' : 'stop';
  daemonControlState = reduceDaemonControl(daemonControlState, { kind: 'clicked' });
  renderDaemonControl();
  const response = await window.seeya.daemonControl({ action });
  daemonControlState = reduceDaemonControl(daemonControlState, {
    kind: 'finished',
    resultText: response.resultText,
  });
  renderDaemonControl();
}

/** Wired once, at startup. */
function wireDaemonControl(): void {
  document.getElementById('daemon-control-button')?.addEventListener('click', () => {
    void handleDaemonControlClicked();
  });
}

function todayPanel(): HTMLElement {
  return document.getElementById('today-panel') as HTMLElement;
}

/** V2-T9 item 2: the directory-changed note + the explanatory line, shown only when the session's
 * own history actually records a change — "sem histórico é sem nota" (D-025), a single-entry
 * history says nothing extra rather than affirming "no change". */
function renderCwdHistoryNote(history: TodaySessionRow['cwdHistory']): HTMLElement | null {
  if (history.length <= 1) {
    return null;
  }
  const container = document.createElement('div');
  const note = document.createElement('p');
  note.textContent = MESSAGES.todayCwdHistoryNote(history);
  container.appendChild(note);
  const explanation = document.createElement('p');
  explanation.textContent = MESSAGES.todayCwdHistoryExplanation;
  container.appendChild(explanation);
  return container;
}

/** V2-T9 item 2: "Resume in" — offered only when there's something to choose (more than one
 * directory recorded, and at least one still exists), the most recent EXISTING one preselected —
 * "é o comportamento de hoje" (the plan's own wording): a directory nobody touches here resumes
 * exactly where it already would have. The interface never picks silently otherwise (D-039):
 * every other option stays one click away. */
function renderResumeInSelect(
  sessionId: string,
  history: TodaySessionRow['cwdHistory'],
): HTMLElement | null {
  if (history.length <= 1) {
    return null;
  }
  const existing = history.filter((entry) => entry.exists);
  if (existing.length === 0) {
    return null;
  }
  const label = document.createElement('label');
  label.className = 'today-resume-in-label';
  label.append(`${MESSAGES.todayResumeInLabel}: `);
  const select = document.createElement('select');
  select.className = 'today-session-resume-in';
  select.dataset.sessionId = sessionId;
  for (const entry of existing) {
    const option = document.createElement('option');
    option.value = entry.cwd;
    option.textContent = entry.cwd;
    select.appendChild(option);
  }
  select.value = existing[existing.length - 1]?.cwd ?? '';
  label.appendChild(select);
  return label;
}

/** One session row in the "Today" panel (V2-T4 item 1, checkbox rule reshaped by V2-T9 item 4) —
 * a checkbox for a session that isn't running right now, or a plain note for one that is (D-024/
 * D-025: the three `TodayResumeStatus` forms are never rendered the same way, same discipline
 * `core/consolidated-plan.ts#renderSessionPlanLine` already applies to the CLI's own plan text). */
function renderTodaySessionRow(row: TodaySessionRow): HTMLLIElement {
  const item = document.createElement('li');
  if (row.resumeStatus.kind === 'runningNow') {
    item.textContent = `${row.name} (${row.cwd}) — ${MESSAGES.todayRunningNow}`;
    if (row.resumeStatus.matchedTabId !== null) {
      item.classList.add('matched');
    }
    return item;
  }
  if (row.resumeStatus.kind === 'resumedEarlier') {
    item.textContent = `${row.name} (${row.cwd}) — ${MESSAGES.todayResumedEarlier}`;
    return item;
  }
  const label = document.createElement('label');
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'today-session-checkbox';
  checkbox.value = row.sessionId;
  label.appendChild(checkbox);
  label.append(` ${row.name} (${row.cwd}) — ${row.firstPlanLine ?? MESSAGES.todayNoPlanRecorded}`);
  item.appendChild(label);
  const cwdHistoryNote = renderCwdHistoryNote(row.cwdHistory);
  if (cwdHistoryNote !== null) {
    item.appendChild(cwdHistoryNote);
  }
  const resumeInSelect = renderResumeInSelect(row.sessionId, row.cwdHistory);
  if (resumeInSelect !== null) {
    item.appendChild(resumeInSelect);
  }
  return item;
}

/**
 * Renders the whole "Today" panel from scratch — called once at startup (`main` below) and again
 * after "Resume selected" finishes (`handleResumeSelected`), so a session just resumed stops
 * showing a checkbox without a page reload. Simpler than patching the existing DOM in place for a
 * list this small, and it's what keeps the resume button's own click handler always closed over
 * the CURRENT `data.day` rather than a stale one from an earlier render.
 */
function renderTodayPanel(data: TodayPanelData): void {
  const panel = todayPanel();
  panel.textContent = '';
  if (data.kind === 'noBriefing') {
    const message = document.createElement('p');
    message.textContent = data.message;
    panel.appendChild(message);
    return;
  }

  const title = document.createElement('p');
  title.textContent = MESSAGES.todayPlanTitle(data.day, data.daysAgo);
  panel.appendChild(title);

  const list = document.createElement('ul');
  for (const row of data.rows) {
    list.appendChild(renderTodaySessionRow(row));
  }
  panel.appendChild(list);

  const resumeButton = document.createElement('button');
  resumeButton.type = 'button';
  resumeButton.textContent = MESSAGES.todayResumeSelected;
  resumeButton.addEventListener('click', () => void handleResumeSelected(data.day));
  panel.appendChild(resumeButton);

  const progress = document.createElement('p');
  progress.id = 'today-progress';
  panel.appendChild(progress);

  const result = document.createElement('p');
  result.id = 'today-result';
  panel.appendChild(result);
}

async function refreshTodayPanel(): Promise<void> {
  renderTodayPanel(await window.seeya.getTodayPanel());
}

/** One labeled `<ul>` of `name (cwd)` lines — the shared shape every section of the summary below
 * uses (V2-T4 item 4), same repeated structure `cli/format-start-day.ts`'s own
 * `formatResumedSection`/`formatSkippedSection`/etc. already have, just built as DOM instead of
 * joined lines. `null` when `sessions` is empty, so an empty section never renders as a bare
 * heading with nothing under it. */
function renderSummarySection(
  heading: string,
  sessions: readonly {
    readonly name: string;
    readonly cwd: string;
    readonly note?: string | undefined;
  }[],
): HTMLElement | null {
  if (sessions.length === 0) {
    return null;
  }
  const section = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = heading;
  section.appendChild(title);
  const list = document.createElement('ul');
  for (const session of sessions) {
    const item = document.createElement('li');
    item.textContent =
      session.note === undefined
        ? `${session.name} (${session.cwd})`
        : `${session.name} (${session.cwd}) — ${session.note}`;
    list.appendChild(item);
  }
  section.appendChild(list);
  return section;
}

/** V2-T7: the resumed section's own note, per `ResumeSummaryOutcome`'s three forms — `undefined`
 * for a plain `resumed` (nothing to add), and the matching `MESSAGES` wrapper for the other two,
 * never the raw `noteText` unwrapped (that's `state/resume-summary.ts`'s bare fact; the sentence
 * around it lives in `text/messages.ts`, D-041). */
function resumeOutcomeNote(outcome: ResumeSummaryResponse['resumed'][number]): string | undefined {
  if (outcome.kind === 'resumed') {
    return undefined;
  }
  return outcome.kind === 'resumedWithoutPlan'
    ? MESSAGES.todaySummaryResumedWithoutPlanNote(outcome.noteText)
    : MESSAGES.todaySummaryFallbackNote(outcome.noteText);
}

/** Renders `response` into `#today-result` (V2-T4 item 4) — same four sections
 * `cli/format-start-day.ts#formatStartDaySummary` shows (resumed, skipped, invalid fallback
 * answers, not-yet-attempted/stopped-early), built from `ResumeSummaryResponse`
 * (`state/resume-summary.ts`'s own output) rather than any text reused literally (Q-073). */
function renderResumeSummary(response: ResumeSummaryResponse): void {
  const resultLine = document.getElementById('today-result');
  if (resultLine === null) {
    return;
  }
  resultLine.textContent = '';
  const sections = [
    renderSummarySection(
      MESSAGES.todaySummaryResumedHeading,
      response.resumed.map((outcome) => ({
        name: outcome.name,
        cwd: outcome.cwd,
        note: resumeOutcomeNote(outcome),
      })),
    ),
    renderSummarySection(
      MESSAGES.todaySummarySkippedHeading,
      response.skipped.map((session) => ({
        name: session.name,
        cwd: session.cwd,
        note: session.reasonText,
      })),
    ),
    renderSummarySection(
      MESSAGES.todaySummaryInvalidHeading,
      response.invalidFallbackAnswers.map((session) => ({
        name: session.name,
        cwd: session.cwd,
        note: session.reason,
      })),
    ),
    renderSummarySection(MESSAGES.todaySummaryRemainingHeading, response.remaining),
  ];
  for (const section of sections) {
    if (section !== null) {
      resultLine.appendChild(section);
    }
  }
  if (response.stoppedEarly !== false) {
    const note = document.createElement('p');
    note.textContent = MESSAGES.todaySummaryStoppedEarly(
      response.stoppedEarly.session.name,
      response.stoppedEarly.message,
    );
    resultLine.appendChild(note);
  }
}

/** "Resume selected" (V2-T4 items 1/2/3/4): reads the checked boxes straight from the DOM (the
 * panel's own render is the single source of truth for what's currently offered — no separate
 * selection state to keep in sync with it), calls the main process, renders the structured
 * summary, then refreshes the panel so newly-resumed sessions stop offering a checkbox. */
async function handleResumeSelected(day: string): Promise<void> {
  const checked = todayPanel().querySelectorAll<HTMLInputElement>(
    '.today-session-checkbox:checked',
  );
  const sessionIds = [...checked].map((checkbox) => checkbox.value);
  const resultLine = document.getElementById('today-result');
  if (sessionIds.length === 0) {
    if (resultLine !== null) {
      resultLine.textContent = MESSAGES.todayNothingSelected;
    }
    return;
  }
  // V2-T9 item 2: whatever "Resume in" currently shows for each session that has one — read
  // straight from the DOM, same "the panel's own render is the single source of truth" reasoning
  // this function's own docstring already gives the checkboxes above.
  const chosenCwdBySessionId: Record<string, string> = {};
  for (const select of todayPanel().querySelectorAll<HTMLSelectElement>(
    '.today-session-resume-in',
  )) {
    const sessionId = select.dataset.sessionId;
    if (sessionId !== undefined) {
      chosenCwdBySessionId[sessionId] = select.value;
    }
  }
  const response = await window.seeya.resumeSelected({ day, sessionIds, chosenCwdBySessionId });
  // Refresh FIRST: renderTodayPanel rebuilds #today-panel from scratch (including a fresh, empty
  // #today-result), so the summary has to be painted AFTER it — painting it before would just get
  // wiped out by the refresh immediately following.
  await refreshTodayPanel();
  renderResumeSummary(response);
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
      // V2-T6: measured defect — after a resize+scroll, orphaned characters stayed at the left
      // edge of a Claude Code tab (its TUI redraws its own block with erase-to-end-of-line
      // sequences, and a row-wrap disagreement between ConPTY and xterm.js right after a resize
      // is what paints those wrong). A full refresh forces xterm.js to repaint every row from its
      // own buffer — cheap, and a no-op when nothing was actually stale.
      open.terminal.refresh(0, open.terminal.rows - 1);
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
  wireEndDayDialog();
  wireScheduleStrip();
  wireDaemonControl();
  await refreshTodayPanel();
}

void main();
