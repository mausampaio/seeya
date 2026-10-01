/**
 * PO review (2026-10-01, docs/INTERFACE.md § 1's own "a sessão vira linha com ponto de estado,
 * tom pelo estado"): the semantic colour (`renderer/components/props.ts#Tone`) a session's state
 * dot reads in — pure, so it is testable without rendering anything, same split every other
 * state→presentation mapping in this app already has (`core/session-state-label.ts`'s own
 * `state`→text, this module's own `state`→tone).
 *
 * `alive` is the only state actively doing something right now (`success`, the same tone the
 * Favorites badge already uses for "open here"); `idle` still has a live process, just not
 * actively working (`warning`, same tone the lock badge uses for "needs attention"); `ended`/
 * `unknown` both describe "nothing to watch here" and share `neutral` (D-025: `unknown` is an
 * absence of evidence, never upgraded to a more specific/alarming tone than the facts support).
 */
import type { SessionState } from '@seeya-ai/engine/core/types.js';
import type { Tone } from '../renderer/components/props.js';

const SESSION_STATE_TONE: Record<SessionState, Tone> = {
  alive: 'success',
  idle: 'warning',
  ended: 'neutral',
  unknown: 'neutral',
};

/**
 * @example
 * resolveSessionStateTone('alive') // 'success'
 */
export function resolveSessionStateTone(state: SessionState): Tone {
  return SESSION_STATE_TONE[state];
}
