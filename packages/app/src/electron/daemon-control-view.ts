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

/** V2-T63: the button IS the pill (`docs/INTERFACE.md` § 1's own "rodapé... pílula do daemon,
 * largura total") — `seeya-status-pill-button`/`seeya-status-pill--<tone>` (`components.css`) give
 * it the same rounded, toned look `StatusPill` gives a plain `<span>` elsewhere, sized to a full
 * native `<button>` since this one has to stay clickable. One call, so a re-render never leaves a
 * stale tone class from a previous state sitting alongside the new one. */
function setPillTone(button: HTMLButtonElement, tone: 'success' | 'neutral'): void {
  button.classList.remove('seeya-status-pill--success', 'seeya-status-pill--neutral');
  button.classList.add('seeya-status-pill-button', `seeya-status-pill--${tone}`);
}

function renderDaemonControl(): void {
  const button = document.getElementById('daemon-control-button') as HTMLButtonElement;
  const result = document.getElementById('daemon-control-result') as HTMLElement;

  if (daemonControlState.kind === 'running') {
    button.textContent = MESSAGES.daemonControlRunning;
    button.disabled = true;
    setPillTone(button, 'neutral');
    return;
  }
  if (daemonControlState.kind === 'result') {
    result.textContent = daemonControlState.resultText;
  }
  const availability = daemonControlState.availability;
  if (availability.kind === 'unknown') {
    button.textContent = MESSAGES.daemonControlUnknown;
    button.disabled = true;
    setPillTone(button, 'neutral');
    return;
  }
  // `availability.kind === 'start'` means the daemon is currently STOPPED (starting is the
  // action offered) — the pill's own text says the fact, not the action (this file's own
  // `daemonControlState` docstring), so it reads "Daemon stopped"/"Daemon running" here.
  button.textContent =
    availability.kind === 'start' ? MESSAGES.daemonPillStopped : MESSAGES.daemonPillRunning;
  button.disabled = false;
  setPillTone(button, availability.kind === 'start' ? 'neutral' : 'success');
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
