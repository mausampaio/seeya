/**
 * Shared display text for `SessionState` (V2-T52). Classification itself is D-016's rule
 * (`core/classification.ts`) and stays exactly as it is — this module only decides what WORD a
 * person reads for each value, so the `unknown` identifier in disk/code (D-027: it's a value that
 * ends up in `~/.seeya/days/<day>/sessions/<sessionId>.json`'s own `sessionState`, D-021's
 * "identifier, not the display") never has to change just because the word that confused people
 * did.
 *
 * **Why `unknown` reads wrong.** Aceite da V2-T29/V2-T30 pelo mantenedor (2026-09-25): a session
 * he had just closed showed up as `unknown`, and he read that as an error — "seeya doesn't know
 * what happened" — when the honest fact is narrower: there's no PID to check liveness against
 * (D-016, `classifyState`'s own docstring), so `unknown` is the LEAST specific state the evidence
 * sustains (D-025), not a failure to observe. The classification is correct; the word was
 * confusing whoever read it right after closing the very session it described.
 *
 * **The one place this label lives**, shared CLI↔window (AGENTS.md § "Texto voltado ao usuário" —
 * concentrated, never scattered): `cli/format-sessions.ts` (`seeya sessions`) and
 * `packages/app/src/state/projects-panel.ts`/`session-search.ts` (the window's "Projects"
 * lateral, its directory modal, and the id-search result) all call this instead of rendering
 * `SessionState` directly.
 */
import type { SessionState } from './types.js';

export function formatSessionStateLabel(state: SessionState): string {
  switch (state) {
    case 'alive':
      return 'alive';
    case 'idle':
      return 'idle';
    case 'ended':
      return 'ended';
    case 'unknown':
      return 'no running process';
  }
}
