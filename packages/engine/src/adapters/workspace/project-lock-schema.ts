/**
 * `.seeya-lock`'s on-disk shape (D-047 item 1, `core/project-lock.ts#ProjectLockInfo`). Same
 * corruption policy as `adapters/storage/daemon-lock-schema.ts`'s own sibling file: missing means
 * "no lock taken yet" (D-025), present-but-malformed rejects loudly — a hand-edited or truncated
 * lock is a real problem, never silently read as "free".
 */
import { z } from 'zod';
import type { ProjectLockInfo } from '../../core/project-lock.js';

/** Current `schemaVersion` for `.seeya-lock`. Passed to `resolveSchemaVersion` by
 * `adapters/workspace/project-lock.ts` before this module ever sees the document. */
export const PROJECT_LOCK_SCHEMA_VERSION = 1;

/**
 * `sessionId`/`procStart` both `.optional()` — same "absence, not corruption" discipline
 * `daemon-lock-schema.ts` already applies to its own `procStart`/`launchedBy`: a lock taken outside
 * a Claude Code session never had a `sessionId` to record, and a `procStart` capture can fail for
 * reasons unrelated to whether the lock itself is valid (`core/project-lock.ts#ProjectLockInfo`'s
 * own docstring on both fields).
 */
const projectLockDocumentSchema = z.object({
  sessionId: z.string().optional(),
  pid: z.number().int().positive(),
  procStart: z.string().optional(),
  acquiredAt: z.iso.datetime(),
});

/** Parses `raw` (already past `resolveSchemaVersion`) into `ProjectLockInfo` — throws with the
 * field path on any mismatch (AGENTS.md § "Mensagens de erro"), never silently drops or invents a
 * value. */
export function parseProjectLockDocument(raw: unknown): ProjectLockInfo {
  const result = projectLockDocumentSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`.seeya-lock is malformed: ${z.prettifyError(result.error)}`);
  }
  const { sessionId, pid, procStart, acquiredAt } = result.data;
  return { sessionId, pid, procStart, acquiredAt: new Date(acquiredAt) };
}

/** The inverse of `parseProjectLockDocument` — what `FsProjectLock#write` writes. `sessionId`/
 * `procStart` being `undefined` is dropped by `JSON.stringify` on its own (no key written at all),
 * same round-trip discipline `serializeDaemonLock` already follows. */
export function serializeProjectLockDocument(lock: ProjectLockInfo): Record<string, unknown> {
  return {
    schemaVersion: PROJECT_LOCK_SCHEMA_VERSION,
    sessionId: lock.sessionId,
    pid: lock.pid,
    procStart: lock.procStart,
    acquiredAt: lock.acquiredAt.toISOString(),
  };
}
