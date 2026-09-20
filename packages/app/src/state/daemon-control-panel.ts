/**
 * V2-T5b item 3: "Start daemon"/"Stop daemon" — a button whose availability follows the SAME
 * liveness check the status panel already renders
 * (`@seeya-ai/engine/scheduler/daemon-state.js#checkLiveLock`), plus a small "disabled while the
 * command runs" state machine, the same "idle → running → result" shape
 * `state/end-day-panel.ts`'s own module comment already established for the "End day…" dialog.
 * Pure: no I/O, no Electron, no DOM.
 *
 * **`unknown` availability is a real, third case (D-024/D-025), not folded into either button.**
 * `checkLiveLock`'s own `'unknown'` variant means the liveness check itself threw — this module
 * never guesses which button would be safe to show for that (D-025: absence of a fact is not
 * license to imagine the more specific one). `resolveDaemonControlAvailability` below is the one
 * place that maps `LiveLockCheck` to a button decision, so the panel and the status text can never
 * disagree about what "unknown" means.
 */
import type { LiveLockCheck } from '@seeya-ai/engine/scheduler/daemon-state.js';

export type DaemonControlAvailability =
  | { readonly kind: 'start' }
  | { readonly kind: 'stop'; readonly pid: number }
  | { readonly kind: 'unknown' };

/** `dead`/`noLock` both mean "nothing to stop" (`describeLiveness`'s own docstring: a stale lock
 * reads as not-running, not as an error) — both resolve to `'start'` here for the same reason. */
export function resolveDaemonControlAvailability(check: LiveLockCheck): DaemonControlAvailability {
  switch (check.kind) {
    case 'noLock':
    case 'dead':
      return { kind: 'start' };
    case 'alive':
      return { kind: 'stop', pid: check.lock.pid };
    case 'unknown':
      return { kind: 'unknown' };
  }
}

export type DaemonControlState =
  | { readonly kind: 'idle'; readonly availability: DaemonControlAvailability }
  | { readonly kind: 'running'; readonly availability: DaemonControlAvailability }
  | {
      readonly kind: 'result';
      readonly availability: DaemonControlAvailability;
      readonly resultText: string;
    };

export type DaemonControlEvent =
  | { readonly kind: 'availabilityUpdated'; readonly availability: DaemonControlAvailability }
  | { readonly kind: 'clicked' }
  | {
      readonly kind: 'finished';
      readonly resultText: string;
      /** V2-T21 item 1 — the availability `electron/main.ts`'s own `daemonControl` handler
       * recomputed right after running the action, never the pre-click value `state.availability`
       * still held. This is what lets the button's label correct itself the instant the command
       * resolves, instead of waiting up to `REFRESH_INTERVAL_MS` for the next ambient tick's
       * `availabilityUpdated`. */
      readonly availability: DaemonControlAvailability;
    };

/**
 * @example
 * let state: DaemonControlState = { kind: 'idle', availability: { kind: 'start' } };
 * state = reduceDaemonControl(state, { kind: 'clicked' }); // -> running
 * state = reduceDaemonControl(state, { kind: 'finished', resultText, availability }); // -> result
 * // Next refresh tick re-reads the real lock and moves the panel back to idle either way:
 * state = reduceDaemonControl(state, { kind: 'availabilityUpdated', availability }); // -> idle
 */
export function reduceDaemonControl(
  state: DaemonControlState,
  event: DaemonControlEvent,
): DaemonControlState {
  switch (event.kind) {
    case 'availabilityUpdated':
      // A refresh tick landing WHILE the command is running must not re-enable the button (the
      // real command in flight is what's authoritative, not a stale liveness read racing it) —
      // the next tick after `finished` moves this back to `idle` on its own.
      return state.kind === 'running' ? state : { kind: 'idle', availability: event.availability };
    case 'clicked':
      // V2-T21 item 1: clicking is allowed from `result` too, not just `idle` — the measured
      // defect was exactly a click landing on a STALE `result.availability` and sending the wrong
      // action ("desligar de novo"). Reading `state.availability` here always means the value
      // `finished` just recomputed, never a value from before the previous click.
      return state.kind === 'idle' || state.kind === 'result'
        ? { kind: 'running', availability: state.availability }
        : state;
    case 'finished':
      return state.kind === 'running'
        ? { kind: 'result', availability: event.availability, resultText: event.resultText }
        : state;
  }
}
