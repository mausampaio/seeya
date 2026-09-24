/**
 * `~/.seeya/adoptions.json`'s shape (V2-T29, `core/ports.ts#Storage.readAdoptions`/
 * `saveAdoptions`). Same corruption policy as every other document under `~/.seeya/`: a missing
 * file means "nothing adopted on this device yet" (D-025), never an error; a present-but-malformed
 * file rejects loudly. **Not validated item-by-item (D-022)** — same reasoning
 * `repository-map-schema.ts`/`resumed-sessions-schema.ts` already give: every entry here was
 * written by `StorageAdapter#saveAdoptions` itself, never an external, unfamiliar source.
 */
import { z } from 'zod';
import type { AdoptionRecord } from '../../core/types.js';

/** Current `schemaVersion` for `adoptions.json`. Passed to `resolveSchemaVersion` by the adapter
 * (`index.ts`) before this module ever sees the document. */
export const ADOPTION_REGISTRY_SCHEMA_VERSION = 1;

const adoptionRecordSchema = z.object({
  originalSessionId: z.string().min(1),
  forkSessionId: z.string().min(1),
  projectId: z.string().min(1),
  adoptedAt: z.iso.datetime(),
});

const adoptionRegistryDocumentSchema = z.object({
  adoptions: z.array(adoptionRecordSchema).optional(),
});

function toAdoptionRecord(raw: z.infer<typeof adoptionRecordSchema>): AdoptionRecord {
  return {
    originalSessionId: raw.originalSessionId,
    forkSessionId: raw.forkSessionId,
    projectId: raw.projectId,
    // `new Date(value)` WITH an argument is a deterministic transform, not a read of "now" (D-019
    // allows it outside `adapters/clock/`) — the raw ISO string was already confirmed by the schema
    // above.
    adoptedAt: new Date(raw.adoptedAt),
  };
}

function serializeAdoptionRecord(record: AdoptionRecord): Record<string, unknown> {
  return {
    originalSessionId: record.originalSessionId,
    forkSessionId: record.forkSessionId,
    projectId: record.projectId,
    adoptedAt: record.adoptedAt.toISOString(),
  };
}

/** Parses `raw` (the document, already past `resolveSchemaVersion`) into the adoption registry. */
export function parseAdoptionRegistryDocument(raw: unknown): AdoptionRecord[] {
  const result = adoptionRegistryDocumentSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`adoptions.json is malformed: ${z.prettifyError(result.error)}`);
  }
  return (result.data.adoptions ?? []).map(toAdoptionRecord);
}

/** What `StorageAdapter#saveAdoptions` writes. */
export function serializeAdoptionRegistryDocument(
  records: readonly AdoptionRecord[],
): Record<string, unknown> {
  return {
    schemaVersion: ADOPTION_REGISTRY_SCHEMA_VERSION,
    adoptions: records.map(serializeAdoptionRecord),
  };
}
