/**
 * V2-T13 (D-045 item 4): "Enable autostart"/"Disable autostart" — a button that only ever shows
 * when the app owns the daemon (`AppContext.daemonOwner.kind === 'app'`; the CLI is the client
 * otherwise, and the button would have nothing honest to offer), driven by the same
 * `Autostart.status()` line the window already renders via `autostart-cache.ts`. Same "idle →
 * running → result" shape `state/daemon-control-panel.ts`'s own module comment already established
 * for the "Start daemon"/"Stop daemon" button — a second, small state machine rather than
 * generalizing the two into one shared type: the two buttons' availability types are genuinely
 * different shapes (D-024: `'notApplicable'` here has no equivalent on the daemon button), and
 * this project's own precedent (`state/end-day-panel.ts`, `state/daemon-control-panel.ts`) already
 * duplicates this exact "idle/running/result" shape per feature rather than abstracting it. Pure:
 * no I/O, no Electron, no DOM.
 */
import type { AutostartStatus } from '@seeya-ai/engine/core/ports.js';
import type { DaemonOwner } from '@seeya-ai/engine/core/types.js';

export type AutostartControlAvailability =
  | { readonly kind: 'notApplicable' }
  | { readonly kind: 'enable' }
  | { readonly kind: 'disable' }
  | { readonly kind: 'unknown' };

/**
 * `owner.kind !== 'app'` always wins, regardless of `status` — a CLI-owned or unresolved machine
 * never gets this button at all (D-045: only the app's own window may register/remove ITS
 * autostart). `brokenPath` reads as `'disable'`, not `'enable'`: something is still registered
 * (pointing at a path that no longer exists), so the honest next action is removing it, not
 * registering a second one on top — `enableAppAutostart` would just overwrite it anyway, but the
 * button's own label should match what's actually there (same "unknown is a real third case"
 * discipline `resolveDaemonControlAvailability` already applies to its own button).
 */
export function resolveAutostartControlAvailability(
  owner: DaemonOwner,
  status: AutostartStatus,
): AutostartControlAvailability {
  if (owner.kind !== 'app') {
    return { kind: 'notApplicable' };
  }
  switch (status.kind) {
    case 'disabled':
      return { kind: 'enable' };
    case 'enabled':
    case 'brokenPath':
      return { kind: 'disable' };
    case 'unknown':
      return { kind: 'unknown' };
  }
}

export type AutostartControlState =
  | { readonly kind: 'idle'; readonly availability: AutostartControlAvailability }
  | { readonly kind: 'running'; readonly availability: AutostartControlAvailability }
  | {
      readonly kind: 'result';
      readonly availability: AutostartControlAvailability;
      readonly resultText: string;
    };

export type AutostartControlEvent =
  | { readonly kind: 'availabilityUpdated'; readonly availability: AutostartControlAvailability }
  | { readonly kind: 'clicked' }
  | { readonly kind: 'finished'; readonly resultText: string };

/**
 * @example
 * let state: AutostartControlState = { kind: 'idle', availability: { kind: 'enable' } };
 * state = reduceAutostartControl(state, { kind: 'clicked' }); // -> running
 * state = reduceAutostartControl(state, { kind: 'finished', resultText }); // -> result
 * // Next refresh tick re-reads the real status and moves the panel back to idle either way:
 * state = reduceAutostartControl(state, { kind: 'availabilityUpdated', availability }); // -> idle
 */
export function reduceAutostartControl(
  state: AutostartControlState,
  event: AutostartControlEvent,
): AutostartControlState {
  switch (event.kind) {
    case 'availabilityUpdated':
      // Same "a run in flight is authoritative, never re-enabled by a racing tick" rule
      // `reduceDaemonControl` already applies.
      return state.kind === 'running' ? state : { kind: 'idle', availability: event.availability };
    case 'clicked':
      return state.kind === 'idle' &&
        state.availability.kind !== 'notApplicable' &&
        state.availability.kind !== 'unknown'
        ? { kind: 'running', availability: state.availability }
        : state;
    case 'finished':
      return state.kind === 'running'
        ? { kind: 'result', availability: state.availability, resultText: event.resultText }
        : state;
  }
}
