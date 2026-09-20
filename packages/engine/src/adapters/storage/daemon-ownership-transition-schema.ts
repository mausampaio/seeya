/**
 * `~/.seeya/daemon-ownership-transition.json`'s shape (`core/ports.ts#Storage.
 * readDaemonOwnershipTransitionAnswer`, V2-T13, D-045 item 1). Same corruption policy as every
 * other document under `~/.seeya/`: a missing file means "the question was never asked/answered
 * yet" (D-025); a present-but-malformed file rejects loudly. One small, project-written record,
 * same reasoning `protocol-handler-schema.ts`'s own comment gives for skipping D-022's
 * item-by-item validation (this is not an external collection).
 */
import { z } from 'zod';
import type { DaemonOwnershipTransitionAnswer } from '../../core/types.js';

/** Current `schemaVersion` for `daemon-ownership-transition.json`. Passed to
 * `resolveSchemaVersion` by the adapter (`index.ts`) before this module ever sees the document. */
export const DAEMON_OWNERSHIP_TRANSITION_SCHEMA_VERSION = 1;

const daemonOwnershipTransitionDocumentSchema = z.object({
  answer: z.enum(['accepted', 'declined']),
});

/** Parses `raw` (the document, already past `resolveSchemaVersion`) into the persisted
 * `DaemonOwnershipTransitionAnswer` — `readDaemonOwnershipTransitionAnswer`'s own caller only
 * cares about this one fact, never the rest of the document's shape. */
export function parseDaemonOwnershipTransitionDocument(
  raw: unknown,
): DaemonOwnershipTransitionAnswer {
  const result = daemonOwnershipTransitionDocumentSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `daemon-ownership-transition.json is malformed: ${z.prettifyError(result.error)}`,
    );
  }
  return result.data.answer;
}

/** What `StorageAdapter#saveDaemonOwnershipTransitionAnswer` writes. */
export function serializeDaemonOwnershipTransitionDocument(
  answer: DaemonOwnershipTransitionAnswer,
): Record<string, unknown> {
  return { schemaVersion: DAEMON_OWNERSHIP_TRANSITION_SCHEMA_VERSION, answer };
}
