/**
 * V2-T55 item 4 — the window's own id-search field: "an id or the start of it, straight to the
 * session, even outside the 12-hour window". Unlike `cli/session-reference.ts`'s own two-phase
 * resolution for `seeya project adopt` (which also matches by name/cwd, because that command's
 * single argument has always accepted those), this field is DEDICATED to an id — so its own
 * "already known" phase only ever compares `sessionId` prefixes, never name or `cwd`.
 *
 * `candidates` is whatever the caller already has in hand (the window's own sidebar rows, refreshed
 * every 10s tick) — never a fresh `SessionProvider.list()` call just for a search (that ambient
 * discovery already covers every registry-backed session regardless of age, D-016; see
 * `core/ports.ts#SessionIdLookup`'s own docstring for why only the transcript-only, long-closed
 * case needs the second, on-demand lookup at all).
 */
import type { DiscoveredSession, SessionIdLookupOutcome } from '../core/types.js';
import type { SessionIdLookup } from '../core/ports.js';

/**
 * @example
 * const outcome = await findSessionByIdOrPrefix(sidebarRows, 'a1b2c3d4', sessionIdLookup);
 * // { kind: 'found', session: {...} } — matched a currently-known row, or (if none did) a
 * // direct, unwindowed transcript scan.
 */
export async function findSessionByIdOrPrefix(
  candidates: readonly DiscoveredSession[],
  idOrPrefix: string,
  sessionIdLookup: SessionIdLookup,
): Promise<SessionIdLookupOutcome> {
  const matches = candidates.filter((session) => session.sessionId.startsWith(idOrPrefix));
  // Destructuring narrows without a non-null assertion under `noUncheckedIndexedAccess`
  // (AGENTS.md: "`!` e `as` ... são sinal de que o tipo está errado") — same idiom
  // `cli/session-reference.ts#resolveSessionReference` already uses for the identical shape.
  const [first, second] = matches;
  if (second !== undefined) {
    return { kind: 'ambiguous', candidates: matches };
  }
  if (first !== undefined) {
    return { kind: 'found', session: first };
  }
  return sessionIdLookup.findByIdPrefix(idOrPrefix);
}
