/**
 * Assembles the sidebar's rows: the exact same `SessionRow[]` `seeya sessions` builds
 * (`@seeya-ai/engine/application/session-view.js#buildSessionRows` — the same fields, same state
 * vocabulary, D-024: "sem PID", "não inspecionável" etc. render the same way here as in the CLI),
 * annotated with which open tab (if any) corresponds to each session, by pid
 * (`sidebar/session-match.ts`).
 *
 * **Takes an already-fetched `DiscoveryResult`, not a `SessionProvider` (PO review of V2-T2).**
 * `electron/main.ts`'s own refresh cycle needs the SAME discovery both here and in
 * `state/status-panel.ts#buildStatusPanelText` (the eligible-session count there is computed over
 * the same sessions) — measured on the PO's machine, against his own real, live `~/.claude`:
 * `SessionProvider.list()` alone cost ~239ms for one session, so calling it twice per cycle (once
 * here, once inside the status panel, as this module's first version did) doubles that cost for
 * no reason. One `sessionProvider.list()` call per cycle, in `electron/main.ts`, shared by both.
 */
import { buildSessionRows, type SessionRow } from '@seeya-ai/engine/application/session-view.js';
import type { DiscoveryResult } from '@seeya-ai/engine/core/ports.js';
import type { Config } from '@seeya-ai/engine/core/types.js';
import { matchSessionsToTabs } from './session-match.js';
import type { TabCollection } from '../tabs/tab-model.js';

export interface SidebarRow extends SessionRow {
  /** `null` when no open tab's pty pid matches this session (D-025) — see
   * `session-match.ts#matchingTabId` for the one rule this is computed by. */
  readonly matchedTabId: string | null;
}

export function buildSidebarRows(
  discovery: DiscoveryResult,
  config: Config,
  now: Date,
  tabs: TabCollection,
): readonly SidebarRow[] {
  const rows = buildSessionRows(discovery.sessions, config, now);
  const matches = matchSessionsToTabs(tabs, discovery.sessions);
  const matchedTabIdBySessionId = new Map(
    matches.map((match) => [match.session.sessionId, match.matchedTabId]),
  );
  return rows.map((row) => ({
    ...row,
    matchedTabId: matchedTabIdBySessionId.get(row.sessionId) ?? null,
  }));
}

/** One session's aliveness, as far as the "Today" panel's checkbox rule cares (V2-T9 item 4) —
 * just the tab mark, since `buildLiveSessionIndex` below only ever puts a sessionId in the map at
 * all when it's live. */
export interface LiveSessionInfo {
  readonly matchedTabId: string | null;
}

/**
 * V2-T9 item 4 — "sessão viva (numa aba ou num terminal — a descoberta vê os dois) → sem caixa,
 * 'running now'". `rows` is whatever this SAME cycle's `buildSidebarRows` already computed (the
 * discovery it already does every 10s tick, `electron/main.ts`'s own `REFRESH_INTERVAL_MS`) —
 * never a second `SessionProvider.list()` call just for the "Today" panel. `alive`/`idle` both
 * mean the process is running right now (`core/classification.ts`'s own docstring: idle is a
 * REFINEMENT of alive, not a different liveness); `ended`/`unknown` are not in this map at all —
 * that "not found" is the honest answer the panel needs to fall back to `resumed.json` instead
 * (D-025).
 *
 * @example
 * const live = buildLiveSessionIndex(sidebarRows);
 * live.has(handoff.sessionId) // true only for a session running right now
 */
export function buildLiveSessionIndex(
  rows: readonly SidebarRow[],
): ReadonlyMap<string, LiveSessionInfo> {
  const map = new Map<string, LiveSessionInfo>();
  for (const row of rows) {
    if (row.state === 'alive' || row.state === 'idle') {
      map.set(row.sessionId, { matchedTabId: row.matchedTabId });
    }
  }
  return map;
}
