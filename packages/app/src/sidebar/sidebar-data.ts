/**
 * Assembles the sidebar's rows: the exact same `SessionRow[]` `seeya sessions` builds
 * (`@seeya-ai/engine/application/session-view.js#buildSessionRows` — the same fields, same state
 * vocabulary, D-024: "sem PID", "não inspecionável" etc. render the same way here as in the CLI),
 * annotated with which open tab (if any) corresponds to each session, by pid
 * (`sidebar/session-match.ts`). No I/O of its own beyond the injected `SessionProvider`.
 */
import { buildSessionRows, type SessionRow } from '@seeya-ai/engine/application/session-view.js';
import type { Clock, SessionProvider } from '@seeya-ai/engine/core/ports.js';
import type { Config } from '@seeya-ai/engine/core/types.js';
import { matchSessionsToTabs } from './session-match.js';
import type { TabCollection } from '../tabs/tab-model.js';

export interface SidebarRow extends SessionRow {
  /** `null` when no open tab's pty pid matches this session (D-025) — see
   * `session-match.ts#matchingTabId` for the one rule this is computed by. */
  readonly matchedTabId: string | null;
}

export async function buildSidebarRows(
  sessionProvider: SessionProvider,
  config: Config,
  clock: Clock,
  tabs: TabCollection,
): Promise<readonly SidebarRow[]> {
  const discovery = await sessionProvider.list();
  const rows = buildSessionRows(discovery.sessions, config, clock.now());
  const matches = matchSessionsToTabs(tabs, discovery.sessions);
  const matchedTabIdBySessionId = new Map(
    matches.map((match) => [match.session.sessionId, match.matchedTabId]),
  );
  return rows.map((row) => ({
    ...row,
    matchedTabId: matchedTabIdBySessionId.get(row.sessionId) ?? null,
  }));
}
