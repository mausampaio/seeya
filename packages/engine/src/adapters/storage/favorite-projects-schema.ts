/**
 * `~/.seeya/favorite-projects.json`'s shape (V2-T63, `core/ports.ts#Storage.readFavoriteProjectIds`/
 * `saveFavoriteProjectIds`). Same corruption policy as every other document under `~/.seeya/`: a
 * missing file means "nothing starred on this device yet" (D-025), never an error; a
 * present-but-malformed file rejects loudly. **Not validated item-by-item (D-022)** — same
 * reasoning `adoption-registry-schema.ts` already gives: every entry here was written by
 * `StorageAdapter#saveFavoriteProjectIds` itself (a star click), never an external, unfamiliar
 * source.
 */
import { z } from 'zod';

/** Current `schemaVersion` for `favorite-projects.json`. Passed to `resolveSchemaVersion` by the
 * adapter (`index.ts`) before this module ever sees the document. */
export const FAVORITE_PROJECTS_SCHEMA_VERSION = 1;

const favoriteProjectsDocumentSchema = z.object({
  projectIds: z.array(z.string().min(1)).optional(),
});

/** Parses `raw` (the document, already past `resolveSchemaVersion`) into the favorite project id
 * list. */
export function parseFavoriteProjectsDocument(raw: unknown): string[] {
  const result = favoriteProjectsDocumentSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`favorite-projects.json is malformed: ${z.prettifyError(result.error)}`);
  }
  return result.data.projectIds ?? [];
}

/** What `StorageAdapter#saveFavoriteProjectIds` writes. */
export function serializeFavoriteProjectsDocument(
  projectIds: readonly string[],
): Record<string, unknown> {
  return {
    schemaVersion: FAVORITE_PROJECTS_SCHEMA_VERSION,
    projectIds: [...projectIds],
  };
}
