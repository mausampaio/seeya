/**
 * The "End day…" preview/progress/result dialog (V2-T5a — split out of the former single-file
 * `renderer.ts` by V2-T62/D-051). Excluded from `packages/app/src`'s coverage floor with
 * everything else in `electron/` (it cannot run without a display).
 */
import { MESSAGES } from '../text/messages.js';
import { reduceEndDayPanel, type EndDayPanelState } from '../state/end-day-panel.js';
import type { EndDayPreviewResponse } from '../ipc/channels.js';
import { refreshTodayPanel } from './today-panel-view.js';

/**
 * V2-T5a items 1/4: the "End day…" button and its preview-as-confirmation/progress/result dialog
 * — one native `<dialog>` reused across the whole `EndDayPanelState` lifecycle (`idle` →
 * `previewPending` → `preview` → `running` → `result`), the same `showModal()`/`cancel`-event
 * pattern `fallback-dialog-view.ts` also uses. `endDayState` is the single source of truth; every
 * handler below updates it through `reduceEndDayPanel` (`state/end-day-panel.ts`) and then calls
 * `renderEndDayDialog` — never mutates the DOM directly from an event handler.
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
 * `handleResumeSelected`'s own button-disable convention does elsewhere. */
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

/** Wired once, at startup — also wires `onEndDayProgress`, the end-day-specific slice of what
 * used to be `wireIncomingEvents`. */
export function wireEndDayDialog(): void {
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
