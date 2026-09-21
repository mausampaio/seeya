/**
 * `~/.seeya/workspace.json`'s shape (`core/ports.ts#Storage.readWorkspaceRoot`, V2-T27). Same
 * corruption policy as every other document under `~/.seeya/`: a missing file means "no workspace
 * location resolved on this device yet" (D-025); a present-but-malformed file rejects loudly. One
 * small, project-written record — same reasoning `daemon-ownership-transition-schema.ts`'s own
 * comment gives for skipping D-022's item-by-item validation here (this is not an external
 * collection, it's one value this project's own code writes).
 */
import { z } from 'zod';

/** Current `schemaVersion` for `workspace.json`. Passed to `resolveSchemaVersion` by the adapter
 * (`index.ts`) before this module ever sees the document. */
export const WORKSPACE_ROOT_SCHEMA_VERSION = 1;

const workspaceRootDocumentSchema = z.object({
  root: z.string().min(1),
});

/** Parses `raw` (the document, already past `resolveSchemaVersion`) into the persisted workspace
 * root path — `readWorkspaceRoot`'s own caller only cares about this one fact, never the rest of
 * the document's shape. */
export function parseWorkspaceRootDocument(raw: unknown): string {
  const result = workspaceRootDocumentSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`workspace.json is malformed: ${z.prettifyError(result.error)}`);
  }
  return result.data.root;
}

/** What `StorageAdapter#saveWorkspaceRoot` writes. */
export function serializeWorkspaceRootDocument(root: string): Record<string, unknown> {
  return { schemaVersion: WORKSPACE_ROOT_SCHEMA_VERSION, root };
}
