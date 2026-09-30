/**
 * The "Start daemon"/"Stop daemon" button (V2-T5b item 3 — split out of the former single-file
 * `renderer.ts` by V2-T62/D-051). Excluded from `packages/app/src`'s coverage floor with
 * everything else in `electron/` (it cannot run without a display).
 */
import { MESSAGES } from '../text/messages.js';
import { reduceDaemonControl, type DaemonControlState } from '../state/daemon-control-panel.js';

/**
 * V2-T5b item 3: "Start daemon"/"Stop daemon" — one native button, driven end to end by
 * `state/daemon-control-panel.ts#reduceDaemonControl`, the same "one state machine, one render
 * function" discipline `end-day-dialog-view.ts`'s own `endDayState` already establishes.
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
  // V2-T21 item 1: clicking is allowed from 'result' too, not just 'idle' — that's what lets a
  // click right after the previous action's own result send the FRESH action (`reduceDaemonControl`'s
  // own docstring has the measured defect this fixes).
  if (
    (daemonControlState.kind !== 'idle' && daemonControlState.kind !== 'result') ||
    daemonControlState.availability.kind === 'unknown'
  ) {
    return;
  }
  const action = daemonControlState.availability.kind === 'start' ? 'start' : 'stop';
  daemonControlState = reduceDaemonControl(daemonControlState, { kind: 'clicked' });
  renderDaemonControl();
  const response = await window.seeya.daemonControl({ action });
  daemonControlState = reduceDaemonControl(daemonControlState, {
    kind: 'finished',
    resultText: response.resultText,
    availability: response.availability,
  });
  renderDaemonControl();
}

/** Wired once, at startup — also wires `onDaemonAvailabilityUpdate`, the daemon-specific slice of
 * what used to be `wireIncomingEvents`. */
export function wireDaemonControl(): void {
  document.getElementById('daemon-control-button')?.addEventListener('click', () => {
    void handleDaemonControlClicked();
  });
  window.seeya.onDaemonAvailabilityUpdate((availability) => {
    daemonControlState = reduceDaemonControl(daemonControlState, {
      kind: 'availabilityUpdated',
      availability,
    });
    renderDaemonControl();
  });
}
