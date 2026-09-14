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
