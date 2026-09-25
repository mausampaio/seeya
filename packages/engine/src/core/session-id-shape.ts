/**
 * Whether `value` could plausibly be a `sessionId` (a full UUID) or a prefix of one — the
 * distinction V2-T55 item 1 needs between "an id reference", which bypasses `relevanceHours` via a
 * direct, unwindowed transcript search (`adapters/discovery/session-id-lookup.ts`), and a name/cwd
 * reference, which only ever matches inside the time-windowed discovery list — the task's own
 * acceptance: "a busca por nome continua na lista da janela de tempo".
 *
 * Deliberately permissive, not a strict UUID-prefix grammar (hyphen POSITION isn't checked): a real
 * `sessionId` is exactly hex digits and hyphens (`core/types.ts`'s own UUID), so restricting the
 * character set to that already excludes every `cwd` (always has a path separator) and nearly every
 * derived display name (`adapters/discovery/session-mapping.ts#deriveNameFromCwd`'s own "code-6d"
 * example already has a non-hex letter, `o`). A name that HAPPENS to be hex-and-hyphens-only only
 * costs one extra (already on-demand, never in the 10s cycle) transcript scan that then finds
 * nothing — never a WRONG match, since the direct lookup this gates only ever matches an actual
 * `sessionId`.
 *
 * `MIN_LENGTH` exists so a one-character search never triggers a full unwindowed transcript walk
 * for what's almost certainly a mistyped name.
 */
const HEX_AND_HYPHENS = /^[0-9a-f-]+$/i;
const MIN_LENGTH = 2;

export function looksLikeSessionIdReference(value: string): boolean {
  return value.length >= MIN_LENGTH && HEX_AND_HYPHENS.test(value);
}
