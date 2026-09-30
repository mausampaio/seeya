/**
 * The "Enable autostart"/"Disable autostart" button (V2-T13 item 4 — split out of the former
 * single-file `renderer.ts` by V2-T62/D-051). Excluded from `packages/app/src`'s coverage floor
 * with everything else in `electron/` (it cannot run without a display).
 */
import { MESSAGES } from '../text/messages.js';
import {
  reduceAutostartControl,
  type AutostartControlState,
} from '../state/autostart-control-panel.js';

/**
 * V2-T13 item 4: "Enable autostart"/"Disable autostart" — mirrors `daemon-control-view.ts`'s own
 * `daemonControlState`/`renderDaemonControl`/`handleDaemonControlClicked`/`wireDaemonControl`
 * exactly (same "one state machine, one render function" shape), for the second button that only
 * ever shows when `AutostartControlAvailability.kind !== 'notApplicable'` (the app owns autostart
 * on this machine — `state/autostart-control-panel.ts#resolveAutostartControlAvailability`'s own
 * gate).
 */
let autostartControlState: AutostartControlState = {
  kind: 'idle',
  availability: { kind: 'notApplicable' },
};

function renderAutostartControl(): void {
  const button = document.getElementById('autostart-control-button') as HTMLButtonElement;
  const result = document.getElementById('autostart-control-result') as HTMLElement;

  if (autostartControlState.kind === 'running') {
    button.hidden = false;
    button.textContent = MESSAGES.autostartControlRunning;
    button.disabled = true;
    return;
  }
  if (autostartControlState.kind === 'result') {
    result.textContent = autostartControlState.resultText;
  }
  const availability = autostartControlState.availability;
  if (availability.kind === 'notApplicable') {
    // The CLI (or an ownership query that failed, D-025) owns autostart here — this button has
    // nothing honest to offer, so it stays out of the way entirely rather than showing disabled.
    button.hidden = true;
    return;
  }
  button.hidden = false;
  if (availability.kind === 'unknown') {
    button.textContent = MESSAGES.autostartControlUnknown;
    button.disabled = true;
    return;
  }
  button.textContent =
    availability.kind === 'enable'
      ? MESSAGES.autostartControlEnable
      : MESSAGES.autostartControlDisable;
  button.disabled = false;
}

async function handleAutostartControlClicked(): Promise<void> {
  // V2-T21 item 1: clicking is allowed from 'result' too, not just 'idle' — mirrors
  // `handleDaemonControlClicked` (same measured defect, same fix).
  if (
    (autostartControlState.kind !== 'idle' && autostartControlState.kind !== 'result') ||
    autostartControlState.availability.kind === 'notApplicable' ||
    autostartControlState.availability.kind === 'unknown'
  ) {
    return;
  }
  const action = autostartControlState.availability.kind === 'enable' ? 'enable' : 'disable';
  autostartControlState = reduceAutostartControl(autostartControlState, { kind: 'clicked' });
  renderAutostartControl();
  const response = await window.seeya.autostartControl({ action });
  autostartControlState = reduceAutostartControl(autostartControlState, {
    kind: 'finished',
    resultText: response.resultText,
    availability: response.availability,
  });
  renderAutostartControl();
}

/** Wired once, at startup — also wires `onAutostartAvailabilityUpdate`, the autostart-specific
 * slice of what used to be `wireIncomingEvents`. */
export function wireAutostartControl(): void {
  document.getElementById('autostart-control-button')?.addEventListener('click', () => {
    void handleAutostartControlClicked();
  });
  window.seeya.onAutostartAvailabilityUpdate((availability) => {
    autostartControlState = reduceAutostartControl(autostartControlState, {
      kind: 'availabilityUpdated',
      availability,
    });
    renderAutostartControl();
  });
}
