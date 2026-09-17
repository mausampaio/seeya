/**
 * `~/.seeya/protocol-handler.json`'s shape (`core/ports.ts#Storage.readProtocolHandlerRegistered`,
 * V2-T5b item 5). Same corruption policy as every other document under `~/.seeya/`: a missing file
 * means "never registered" (D-025); a present-but-malformed file rejects loudly. One small,
 * project-written boolean record, same reasoning `daemon-lock-schema.ts`'s own comment gives for
 * skipping D-022's item-by-item validation.
 */
import { z } from 'zod';

/** Current `schemaVersion` for `protocol-handler.json`. Passed to `resolveSchemaVersion` by the
 * adapter (`index.ts`) before this module ever sees the document. */
export const PROTOCOL_HANDLER_SCHEMA_VERSION = 1;

const protocolHandlerDocumentSchema = z.object({
  registered: z.boolean(),
});

/** Parses `raw` (the document, already past `resolveSchemaVersion`) into the `registered`
 * boolean — `readProtocolHandlerRegistered`'s own caller only cares about this one fact, never the
 * rest of the document's shape. */
export function parseProtocolHandlerDocument(raw: unknown): boolean {
  const result = protocolHandlerDocumentSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`protocol-handler.json is malformed: ${z.prettifyError(result.error)}`);
  }
  return result.data.registered;
}

/** What `StorageAdapter#saveProtocolHandlerRegistered` writes — always `registered: true` (this
 * port has no "unregister" method, `core/ports.ts`'s own docstring explains why). */
export function serializeProtocolHandlerDocument(): Record<string, unknown> {
  return { schemaVersion: PROTOCOL_HANDLER_SCHEMA_VERSION, registered: true };
}
