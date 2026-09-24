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
