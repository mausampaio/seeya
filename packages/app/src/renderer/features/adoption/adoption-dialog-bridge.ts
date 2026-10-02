/**
 * V2-T70 — the single adoption dialog's own tiny pub/sub, same shape as
 * `renderer/features/projects/new-project-dialog-bridge.ts`: the Sessions tab's own `Adopt…`
 * button (`renderer/features/sessions/useSessions.ts`) opens this dialog without importing its
 * component tree directly, and `AdoptionDialog.tsx` (mounted once by `App.tsx`) is the only module
 * that ever calls `subscribeAdoptPanel`/dispatches into the state machine.
 *
 * Replaces `renderer/legacy/adopt-flow-view.ts`'s own module-level `state`/`apply` pair (apagado
 * by this task) with the same idea exposed as a subscribable store instead of an imperative
 * `apply()` — `useAdoption.ts` is the one hook that turns this into Preact state via `useState`/
 * `useEffect`.
 */
import {
  type AdoptPanelEvent,
  type AdoptPanelState,
  reduceAdoptPanel,
} from '../../../state/adopt-panel.js';
import type { AdoptionSessionCard } from '../../../state/adopt-panel.js';

type Listener = (state: AdoptPanelState) => void;

let state: AdoptPanelState = { kind: 'idle' };
const listeners = new Set<Listener>();

function apply(next: AdoptPanelState): void {
  state = next;
  for (const listener of listeners) {
    listener(state);
  }
}

/** `useAdoption.ts`'s own first read, before its `useEffect` subscribes. */
export function getAdoptPanelState(): AdoptPanelState {
  return state;
}

/** Called once, by `useAdoption.ts`, on mount — returns the unsubscribe function. */
export function subscribeAdoptPanel(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Every caller of this module dispatches through here — `useAdoption.ts` is the only one that
 * actually does, keeping `reduceAdoptPanel` itself the single source of truth for what each event
 * means. */
export function dispatchAdoptPanel(event: AdoptPanelEvent): void {
  apply(reduceAdoptPanel(state, event));
}

/**
 * The Sessions tab's own entry point (`useSessions.ts#onAdopt`) — opens the picker for `session`.
 *
 * @example
 * openAdoptionDialog({
 *   sessionId: '11111111-1111-4111-8111-111111111111',
 *   name: 'Payments investigation',
 *   displaySessionId: '11111111',
 *   cwd: '/code/payments',
 *   state: 'ended',
 *   stateLabel: 'ended',
 * });
 */
export function openAdoptionDialog(session: AdoptionSessionCard): void {
  dispatchAdoptPanel({ kind: 'pickerOpened', session });
}

/** Test-only — this module's own `state` is otherwise a singleton for the life of the renderer
 * process, which a render test would otherwise leak across `it()` blocks in the same file (Vitest
 * caches the module once per file, not once per test). Never called by production code. */
export function resetAdoptPanelStateForTests(): void {
  state = { kind: 'idle' };
}
