/**
 * `~/.seeya/protocol-handler.json`'s shape (`core/ports.ts#Storage.readActiveProtocolScheme`,
 * V2-T5b item 5, upgraded by V2-T10 item 2). Same corruption policy as every other document under
 * `~/.seeya/`: a missing file means "never registered" (D-025); a present-but-malformed file
 * rejects loudly. One small, project-written record, same reasoning `daemon-lock-schema.ts`'s own
 * comment gives for skipping D-022's item-by-item validation.
 *
 * **V2-T10 item 2: `registered: boolean` (schemaVersion 1) became `activeScheme: ProtocolScheme`
 * (schemaVersion 2).** A plain boolean could only ever say "some window registered SOMETHING" —
 * once two worlds (`seeya`/`seeya-dev`, `core/types.ts#ProtocolScheme`) can each register their
 * own scheme, the marker has to say WHICH one is the currently active window, so the toast/click
 * backends (`adapters/notification/windows-toast.ts`, `linux-notify-send.ts`) know which URI to
 * offer. `migrateProtocolHandlerV1ToV2` below reads an old `registered: true` document as
 * `activeScheme: 'seeya'` — the only scheme that ever existed before this task — never a
 * migration that could invent `'seeya-dev'` out of a boolean that never distinguished worlds.
 */
import { z } from 'zod';
import type { ProtocolScheme } from '../../core/types.js';
import type { SchemaMigration } from './schema-version.js';

/** Current `schemaVersion` for `protocol-handler.json`. Passed to `resolveSchemaVersion` by the
 * adapter (`index.ts`) before this module ever sees the document. */
export const PROTOCOL_HANDLER_SCHEMA_VERSION = 2;

const protocolSchemeSchema = z.enum(['seeya', 'seeya-dev']);

const protocolHandlerDocumentSchema = z.object({
  activeScheme: protocolSchemeSchema,
});

/**
 * schemaVersion 1 → 2 (V2-T10 item 2): a v1 document only ever had `registered: boolean`, written
 * exclusively as `true` (`StorageAdapter#saveProtocolHandlerRegistered`'s own pre-V2-T10 contract —
 * this project never wrote `registered: false`). Read as `activeScheme: 'seeya'` regardless of the
 * old field's exact value: `'seeya'` was the only scheme this project's interface has EVER
 * registered before this task, so it is the only honest guess a migration can make (D-025 applied
 * to a migration instead of a freshly gathered fact) — never `'seeya-dev'`, which did not exist
 * yet when any v1 document could have been written.
 */
function migrateProtocolHandlerV1ToV2(document: Record<string, unknown>): Record<string, unknown> {
  void document;
  return { schemaVersion: PROTOCOL_HANDLER_SCHEMA_VERSION, activeScheme: 'seeya' };
}

export const PROTOCOL_HANDLER_SCHEMA_MIGRATIONS: Readonly<Record<number, SchemaMigration>> = {
  1: migrateProtocolHandlerV1ToV2,
};

/** Parses `raw` (the document, already past `resolveSchemaVersion`) into the active
 * `ProtocolScheme` — `readActiveProtocolScheme`'s own caller only cares about this one fact, never
 * the rest of the document's shape. */
export function parseProtocolHandlerDocument(raw: unknown): ProtocolScheme {
  const result = protocolHandlerDocumentSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`protocol-handler.json is malformed: ${z.prettifyError(result.error)}`);
  }
  return result.data.activeScheme;
}

/** What `StorageAdapter#saveActiveProtocolScheme` writes. */
export function serializeProtocolHandlerDocument(scheme: ProtocolScheme): Record<string, unknown> {
  return { schemaVersion: PROTOCOL_HANDLER_SCHEMA_VERSION, activeScheme: scheme };
}
