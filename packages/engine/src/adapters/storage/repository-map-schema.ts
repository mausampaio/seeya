/**
 * `~/.seeya/repository-map.json`'s shape (V2-T28, `core/ports.ts#Storage.readRepositoryMap`/
 * `saveRepositoryMap`). Same corruption policy as every other document under `~/.seeya/`: a
 * missing file means "nothing registered on this device yet" (D-025), never an error; a
 * present-but-malformed file rejects loudly. **Not validated item-by-item (D-022)** — same
 * reasoning `resumed-sessions-schema.ts`/`workspace-root-schema.ts` already give: every entry here
 * was written by `StorageAdapter#saveRepositoryMap` itself, never an external, unfamiliar source.
 */
import { z } from 'zod';
import type { RepositoryMapEntry } from '../../core/types.js';

/** Current `schemaVersion` for `repository-map.json`. Passed to `resolveSchemaVersion` by the
 * adapter (`index.ts`) before this module ever sees the document. */
export const REPOSITORY_MAP_SCHEMA_VERSION = 1;

const repositoryIdentitySchema = z
  .object({
    host: z.string().min(1),
    owner: z.string().min(1),
    repository: z.string().min(1),
  })
  .passthrough();

/** `identity` present (with-identity entry) XOR `projectId`+`name` present (without-identity
 * entry) — `.refine()` rejects a document that has neither or both, the one shape zod's own
 * object schema can't express on its own (same technique
 * `adapters/workspace/project-manifest-schema.ts#associatedRepositorySchema` already uses). */
const repositoryMapEntrySchema = z
  .object({
    identity: repositoryIdentitySchema.optional(),
    projectId: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    path: z.string().min(1),
  })
  .passthrough()
  .refine(
    (value) =>
      (value.identity !== undefined) !==
      (value.projectId !== undefined && value.name !== undefined),
    { message: 'exactly one of identity, or projectId+name, must be present' },
  );

const repositoryMapDocumentSchema = z.object({
  entries: z.array(repositoryMapEntrySchema).optional(),
});

function toRepositoryMapEntry(raw: z.infer<typeof repositoryMapEntrySchema>): RepositoryMapEntry {
  if (raw.identity !== undefined) {
    return { hasIdentity: true, identity: raw.identity, path: raw.path };
  }
  if (raw.projectId === undefined || raw.name === undefined) {
    // Unreachable in practice: the schema's own `.refine()` above already guarantees this branch
    // only runs with both present. A throw here documents that invariant instead of silently
    // defaulting to an invented `projectId`/`name` (D-025) — zod's inference doesn't narrow across
    // a sibling `.refine()`, so TypeScript alone can't rule this branch out.
    throw new Error('repository-map.json entry is missing both identity and projectId/name');
  }
  return { hasIdentity: false, projectId: raw.projectId, name: raw.name, path: raw.path };
}

function serializeRepositoryMapEntry(entry: RepositoryMapEntry): Record<string, unknown> {
  return entry.hasIdentity
    ? { identity: entry.identity, path: entry.path }
    : { projectId: entry.projectId, name: entry.name, path: entry.path };
}

/** Parses `raw` (the document, already past `resolveSchemaVersion`) into the repository map. */
export function parseRepositoryMapDocument(raw: unknown): RepositoryMapEntry[] {
  const result = repositoryMapDocumentSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`repository-map.json is malformed: ${z.prettifyError(result.error)}`);
  }
  return (result.data.entries ?? []).map(toRepositoryMapEntry);
}

/** What `StorageAdapter#saveRepositoryMap` writes. */
export function serializeRepositoryMapDocument(
  entries: readonly RepositoryMapEntry[],
): Record<string, unknown> {
  return {
    schemaVersion: REPOSITORY_MAP_SCHEMA_VERSION,
    entries: entries.map(serializeRepositoryMapEntry),
  };
}
