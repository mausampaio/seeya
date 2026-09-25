/**
 * IPC wiring for the id-search field (V2-T55 item 4) — kept out of `electron/project-ipc.ts` for
 * the same single-responsibility reason that file's own docstring gives for splitting `main.ts`
 * (`renderer.ts`/`main.ts` "não crescem"). D-041: no decision of its own — every lookup delegates
 * to `@seeya-ai/engine/application/session-id-search.js#findSessionByIdOrPrefix`, the SAME
 * two-phase order `cli/session-reference.ts#resolveSessionReferenceForAdoption` uses for the CLI:
 * a plain `sessionId` prefix match against a fresh `sessionProvider.list()` first (a registry-backed
 * session is never time-windowed at all, `core/ports.ts#SessionIdLookup`'s own docstring), and only
 * once THAT comes up empty, `context.sessionIdLookup` — the direct, unwindowed transcript scan,
 * never called from the ambient refresh cycle, only from this handler on an explicit request.
 *
 * **A fresh `sessionProvider.list()` call, not the sidebar's own cached rows.** The sidebar's own
 * "one `list()` call per 10s tick, shared" discipline (`sidebar/sidebar-data.ts`'s own docstring)
 * exists to not pay that cost TEN TIMES A MINUTE; an id search is an explicit, occasional click,
 * not a periodic tick, and paying the cost once for a fresh, complete list is the more honest
 * answer than searching a possibly several-seconds-stale cache for something the person is
 * actively looking for right now.
 */
import { ipcMain } from 'electron';
import { findSessionByIdOrPrefix } from '@seeya-ai/engine/application/session-id-search.js';
import { CHANNELS } from '../ipc/channels.js';
import type { FindSessionByIdRequest, FindSessionByIdResponse } from '../ipc/channels.js';
import { buildSessionSearchRows } from '../state/session-search.js';
import type { AppContext } from '../composition/index.js';

export function wireSessionSearchIpc(context: AppContext): void {
  ipcMain.handle(
    CHANNELS.findSessionById,
    async (_event, request: FindSessionByIdRequest): Promise<FindSessionByIdResponse> => {
      const discovery = await context.sessionProvider.list();
      const outcome = await findSessionByIdOrPrefix(
        discovery.sessions,
        request.idOrPrefix,
        context.sessionIdLookup,
      );
      if (outcome.kind === 'notFound') {
        return { kind: 'notFound' };
      }
      const config = await context.storage.readConfig();
      const adoptions = await context.storage.readAdoptions();
      const now = context.clock.now();
      if (outcome.kind === 'found') {
        const [row] = buildSessionSearchRows([outcome.session], now, config.idleMinutes, adoptions);
        return row === undefined ? { kind: 'notFound' } : { kind: 'found', session: row };
      }
      return {
        kind: 'ambiguous',
        candidates: buildSessionSearchRows(outcome.candidates, now, config.idleMinutes, adoptions),
      };
    },
  );
}
