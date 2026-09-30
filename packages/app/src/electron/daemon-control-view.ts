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

/** V2-T63 correction (real-window screenshot review): the pill is a dot + a label
 * (`#daemon-pill-dot`/`#daemon-pill-label`) reporting the FACT, plus a separate small icon button
 * (`#daemon-control-button`, ▶/■) that performs the action — replaces the earlier version, where
 * the whole pill was one button and had no visible stop affordance at all. `setDotTone` mirrors
 * `sidebar-favorites-view.ts`'s own single-call-clears-stale-class shape. */
function setDotTone(dot: HTMLElement, tone: 'success' | 'neutral'): void {
  dot.classList.remove('sidebar-pill-dot--success', 'sidebar-pill-dot--neutral');
  dot.classList.add(`sidebar-pill-dot--${tone}`);
}

function renderDaemonControl(): void {
  const dot = document.getElementById('daemon-pill-dot') as HTMLElement;
  const label = document.getElementById('daemon-pill-label') as HTMLElement;
  const button = document.getElementById('daemon-control-button') as HTMLButtonElement;
  const result = document.getElementById('daemon-control-result') as HTMLElement;

  if (daemonControlState.kind === 'running') {
    label.textContent = MESSAGES.daemonControlRunning;
    setDotTone(dot, 'neutral');
    button.disabled = true;
    button.textContent = '';
    return;
  }
  if (daemonControlState.kind === 'result') {
    result.textContent = daemonControlState.resultText;
  }
  const availability = daemonControlState.availability;
  if (availability.kind === 'unknown') {
    label.textContent = MESSAGES.daemonControlUnknown;
    setDotTone(dot, 'neutral');
    button.disabled = true;
    button.textContent = '';
    button.setAttribute('aria-label', MESSAGES.daemonControlUnknown);
    return;
  }
  // `availability.kind === 'start'` means the daemon is currently STOPPED (starting is the
  // action offered) — the LABEL says the fact, not the action (this file's own
  // `daemonControlState` docstring), so it reads "Daemon stopped"/"Daemon running" here; the
  // BUTTON is the action, glyph and `aria-label` both naming what clicking it does.
  const running = availability.kind === 'stop';
  label.textContent = running ? MESSAGES.daemonPillRunning : MESSAGES.daemonPillStopped;
  setDotTone(dot, running ? 'success' : 'neutral');
  button.disabled = false;
  button.textContent = running ? '■' : '▶';
  button.setAttribute(
    'aria-label',
    running ? MESSAGES.daemonControlStopAction : MESSAGES.daemonControlStartAction,
  );
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
