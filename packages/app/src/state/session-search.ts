/**
 * V2-T55 item 4 — the window's own id-search field's row shaping: turns whatever
 * `@seeya-ai/engine/application/session-id-search.js#findSessionByIdOrPrefix` found into the SAME
 * row shape the "Other sessions" directory modal already renders
 * (`state/projects-panel.ts#ProjectPanelOtherSessionRow`), so `electron/session-row-view.ts
 * #renderSessionActionRow` can render either one without a second markup (AGENTS.md: "nada de
 * duplicação"). `electron/session-search-ipc.ts` is the only caller.
 *
 * Classifies fresh rather than trusting a caller-supplied `SessionState`, on purpose: a match found
 * among the window's own already-known sessions and a match found by the direct, unwindowed
 * fallback both arrive here as a plain `DiscoveredSession` (`SessionIdLookupOutcome`'s own shape,
 * `core/types.ts`) — `classifyState` is a pure, cheap function either way, so there's no reason to
 * carry two code paths (one reusing a pre-computed state, one computing it) for what's the same
 * five-line call.
 */
import { classifyState } from '@seeya-ai/engine/core/classification.js';
import { formatSessionStateLabel } from '@seeya-ai/engine/core/session-state-label.js';
import { computeDisplaySessionIds } from '@seeya-ai/engine/application/session-id-display.js';
import type { AdoptionRecord, DiscoveredSession } from '@seeya-ai/engine/core/types.js';
import { resolveAdoptEligibility } from '../sidebar/project-sessions.js';
import type { ProjectPanelOtherSessionRow } from './projects-panel.js';

/**
 * Short ids are computed scoped to just THIS batch of matches — never the whole sidebar's own
 * batch (`session-id-display.ts`'s own docstring: "batch-unique", not globally unique — a search
 * result's own short id only needs to tell ITS candidates apart from each other).
 *
 * @example
 * buildSessionSearchRows([session], now, config.idleMinutes, adoptions)
 * // [{ sessionId, displaySessionId, name, cwd, state: 'unknown', stateLabel: 'no running process', ... }]
 */
export function buildSessionSearchRows(
  sessions: readonly DiscoveredSession[],
  now: Date,
  idleMinutes: number,
  adoptions: readonly AdoptionRecord[],
): readonly ProjectPanelOtherSessionRow[] {
  const displayIds = computeDisplaySessionIds(sessions.map((session) => session.sessionId));
  return sessions.map((session): ProjectPanelOtherSessionRow => {
    const state = classifyState(session, { now, idleMinutes });
    return {
      sessionId: session.sessionId,
      displaySessionId: displayIds.get(session.sessionId) ?? session.sessionId,
      name: session.name,
      cwd: session.cwd,
      state,
      stateLabel: formatSessionStateLabel(state),
      lastActivity: session.lastActivity,
      matchedTabId: null,
      adopt: resolveAdoptEligibility({ sessionId: session.sessionId, state }, adoptions),
    };
  });
}
