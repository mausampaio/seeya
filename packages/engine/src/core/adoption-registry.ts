/**
 * Pure lookups over `~/.seeya/adoptions.json` (V2-T29, D-047 item 6). `Storage.readAdoptions()`
 * (`core/ports.ts`) is the I/O; this module only ever compares already-loaded records — no clock,
 * no disk, so it belongs in `core/` like every other pure decision in this project.
 */
import type { AdoptionRecord } from './types.js';

/**
 * Whether `originalSessionId` was already adopted — `application/project-adopt.ts#adoptSession`'s
 * own refusal check ("para não ser adotada de novo"). `null` when no record matches (D-025: no
 * adoption on record, not "definitely never adopted anywhere" — this only ever reflects what THIS
 * device's `adoptions.json` says).
 *
 * @example
 * findAdoptionRecord(records, '11111111-1111-4111-8111-111111111111')
 */
export function findAdoptionRecord(
  records: readonly AdoptionRecord[],
  originalSessionId: string,
): AdoptionRecord | null {
  return records.find((record) => record.originalSessionId === originalSessionId) ?? null;
}

/**
 * `seeya project revert-adoption <id> [<session>]`'s own selection (V2-T32, item 5): a project can
 * have more than one adopted session (D-047 only forbids one session in TWO projects), so the
 * session argument is required whenever there is more than one to choose from — optional only when
 * there is exactly one. `session`, when given, matches either `originalSessionId` or
 * `forkSessionId`, by exact value first and then by prefix (same two-stage precedent
 * `cli/session-reference.ts#resolveSessionReference` already sets for `adopt`'s own session
 * argument) — never flattened into a boolean or a bare `AdoptionRecord | null` (D-024): a caller
 * needs to tell "nothing adopted here at all" apart from "that reference matched nothing" apart
 * from "that reference matched more than one".
 *
 * **Matches by id/prefix only, never by display name or `cwd`.** `adoptions.json` itself only ever
 * carries the two session ids (`core/types.ts#AdoptionRecord`'s own fields) — resolving a name or
 * `cwd` would mean cross-referencing live discovery, which can miss an original session that has
 * since aged out of `Config.relevanceHours` even though its adoption record is still on file
 * (docs/QUESTOES.md Q-095's own reasoning for this deliberately narrower match).
 *
 * @example
 * selectProjectAdoption(records, 'auth-hardening', '2063') // prefix match against either id
 */
export function selectProjectAdoption(
  records: readonly AdoptionRecord[],
  projectId: string,
  sessionRef: string | undefined,
): AdoptionSelection {
  const forProject = records.filter((record) => record.projectId === projectId);
  if (forProject.length === 0) {
    return { kind: 'noneForProject' };
  }
  if (sessionRef === undefined) {
    return forProject.length === 1
      ? { kind: 'found', record: forProject[0] as AdoptionRecord }
      : { kind: 'ambiguous', matches: forProject };
  }
  const exact = forProject.filter(
    (record) => record.originalSessionId === sessionRef || record.forkSessionId === sessionRef,
  );
  const staged = exact.length > 0 ? exact : matchByPrefix(forProject, sessionRef);
  return resolveStagedMatches(staged);
}

/** D-025: three answers, never flattened — see `selectProjectAdoption`'s own docstring. */
export type AdoptionSelection =
  | { readonly kind: 'noneForProject' }
  | { readonly kind: 'notFound' }
  | { readonly kind: 'found'; readonly record: AdoptionRecord }
  | { readonly kind: 'ambiguous'; readonly matches: readonly AdoptionRecord[] };

function matchByPrefix(
  records: readonly AdoptionRecord[],
  sessionRef: string,
): readonly AdoptionRecord[] {
  if (sessionRef.length === 0) {
    return [];
  }
  return records.filter(
    (record) =>
      record.originalSessionId.startsWith(sessionRef) ||
      record.forkSessionId.startsWith(sessionRef),
  );
}

function resolveStagedMatches(staged: readonly AdoptionRecord[]): AdoptionSelection {
  if (staged.length === 0) {
    return { kind: 'notFound' };
  }
  if (staged.length === 1) {
    return { kind: 'found', record: staged[0] as AdoptionRecord };
  }
  return { kind: 'ambiguous', matches: staged };
}
