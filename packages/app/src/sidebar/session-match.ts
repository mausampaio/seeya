/**
 * Tab↔session correspondence (docs/PLANO-DE-ENTREGA.md V2-T2, item 3), pure — no Electron, no
 * `SessionProvider` I/O here, just the matching rule over data both sides already have in hand.
 *
 * **By pid, and only by pid** (spike M item 5: the harness registers its own pid in
 * `~/.claude/sessions/<pid>.json`, with `cwd` equal to the directory the tab launched it in — no
 * adaptation needed for a session opened through the embedded pty). No correspondence found is
 * never turned into a guess (D-025) — the known case is `codex` on Windows (`.cmd` via
 * `cmd.exe`, a DIFFERENT pid than the one `node-pty` reports for the tab, docs/PLANO-DE-ENTREGA.md
 * V2-T2's own "cuidados"): that limitation is left honest, not "fixed" by matching on `cwd`
 * instead, which would silently mismatch two different sessions that happen to share a directory.
 */
import type { DiscoveredSession } from '@seeya-ai/engine/core/types.js';
import { listTabs, type TabCollection } from '../tabs/tab-model.js';

/** `session.pid` narrowed out of the `hasPid` discriminated union (`core/types.ts`) — only a
 * `SessionWithPid` can ever match a tab; a `SessionWithoutPid` has no pid to compare. */
function pidOf(session: DiscoveredSession): number | null {
  return session.hasPid ? session.pid : null;
}

/**
 * The tab id matching `session`, or `null` if no open tab's pty pid equals the session's pid —
 * `null` is not "not yet matched", it's the honest answer when there is nothing to match (D-025).
 */
export function matchingTabId(tabs: TabCollection, session: DiscoveredSession): string | null {
  const sessionPid = pidOf(session);
  if (sessionPid === null) {
    return null;
  }
  for (const tab of listTabs(tabs)) {
    if (tab.pid === sessionPid) {
      return tab.id;
    }
  }
  return null;
}

/** One discovered session, with the tab id it corresponds to in this window (or `null`, D-025). */
export interface SessionWithTabMatch {
  readonly session: DiscoveredSession;
  readonly matchedTabId: string | null;
}

/** Every discovered session paired with its matching tab, if any — what the sidebar renders. */
export function matchSessionsToTabs(
  tabs: TabCollection,
  sessions: readonly DiscoveredSession[],
): readonly SessionWithTabMatch[] {
  return sessions.map((session) => ({ session, matchedTabId: matchingTabId(tabs, session) }));
}
