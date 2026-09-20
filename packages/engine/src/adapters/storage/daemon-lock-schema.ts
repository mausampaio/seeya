/**
 * `~/.seeya/daemon.lock`'s shape and its resolution into `DaemonLockInfo` (`core/daemon-lock.ts`,
 * D-005's own text names this exact file). S4-T3.
 *
 * Same corruption policy as every other document under `~/.seeya/`: a missing file means "no
 * daemon has ever run here" (D-025); a present-but-malformed file rejects loudly. Not validated
 * item-by-item (D-022 doesn't apply): the whole document is one small, project-written record, the
 * same reasoning `state-schema.ts`/`early-warning-schema.ts` already give for their own fields.
 */
import { z } from 'zod';
import type { DaemonLockInfo } from '../../core/daemon-lock.js';
import type { SchemaMigration } from './schema-version.js';

/** Current `schemaVersion` for `daemon.lock`. Passed to `resolveSchemaVersion` by the adapter
 * (`index.ts`) before this module ever sees the document. Bumped 1 → 2 in V2-T25 for `launchedBy`
 * — see `migrateDaemonLockV1ToV2` below for why the bump itself carries no data transformation. */
export const DAEMON_LOCK_SCHEMA_VERSION = 2;

/**
 * Validates everything BUT `schemaVersion` — see `state-schema.ts`'s sibling comment for why no
 * `.strict()` and no per-item validation.
 *
 * `procStart` is `.optional()` (S4-T3b): a lock written by an older `seeya` build never had this
 * field, and the honest read is "no tie-break value recorded" (`undefined`, D-025), not a rejected
 * file. No `schemaVersion` bump for this addition, same precedent `state-schema.ts`'s
 * `captureAttemptsToday` already set for an additive, optional field.
 *
 * `launchedBy` is `.optional()` too (V2-T25, D-045 item 1's bug fix), for the identical reason —
 * an older lock, or one whose capture failed, never had it. **This one DID get a `schemaVersion`
 * bump** (the plan's own explicit instruction), even though the field is additive and optional the
 * same way `procStart` is: `launchedBy` feeds a decision that offers to shut down someone's daemon
 * (`application/daemon-ownership.ts#shouldOfferDaemonOwnershipTransition`), so the bump exists to
 * leave a documented migration path if a future build ever needs to distinguish "this lock
 * predates `launchedBy`" from "this lock has it and it's genuinely absent" — `procStart`'s own
 * tie-break has no comparably sensitive caller.
 */
const daemonLockDocumentSchema = z.object({
  pid: z.number().int().positive(),
  startedAt: z.iso.datetime(),
  procStart: z.string().optional(),
  launchedBy: z.string().optional(),
});

/**
 * schemaVersion 1 → 2 (V2-T25): a v1 document never had `launchedBy` at all — there is nothing to
 * migrate INTO the field, only the version number itself needs to move forward so
 * `resolveSchemaVersion` accepts the document. Reads exactly like `procStart` already did for a
 * pre-S4-T3b lock: `launchedBy` comes back absent (D-025 — "don't know who", never "someone else",
 * see `core/daemon-lock.ts#DaemonLockInfo.launchedBy`'s own docstring).
 */
function migrateDaemonLockV1ToV2(document: Record<string, unknown>): Record<string, unknown> {
  return { ...document, schemaVersion: DAEMON_LOCK_SCHEMA_VERSION };
}

export const DAEMON_LOCK_SCHEMA_MIGRATIONS: Readonly<Record<number, SchemaMigration>> = {
  1: migrateDaemonLockV1ToV2,
};

/**
 * Parses `raw` (the document, already past `resolveSchemaVersion`) into `DaemonLockInfo`.
 *
 * **`launchedBy` is spread in conditionally, never assigned `undefined` directly** — unlike
 * `procStart`, which keeps its key with an `undefined` value even when absent. A lock with no
 * `launchedBy` on disk has to come back structurally IDENTICAL to a `DaemonLockInfo` literal that
 * never mentions the field at all (the type is `launchedBy?: string`, not `string | undefined`,
 * `core/daemon-lock.ts`'s own docstring), so a round trip through `Storage` never introduces a key
 * that wasn't there before.
 */
export function parseDaemonLockDocument(raw: unknown): DaemonLockInfo {
  const result = daemonLockDocumentSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`daemon.lock is malformed: ${z.prettifyError(result.error)}`);
  }
  const { pid, startedAt, procStart, launchedBy } = result.data;
  return {
    pid,
    startedAt: new Date(startedAt),
    procStart,
    ...(launchedBy === undefined ? {} : { launchedBy }),
  };
}

/** The inverse of `parseDaemonLockDocument` — what `StorageAdapter#writeDaemonLock` writes.
 * `procStart`/`launchedBy` being `undefined` (the latter simply absent from `lock`, since it's an
 * optional field) is dropped by `JSON.stringify` on its own (no key written at all), which is
 * exactly what an older-build reader expects to see missing. */
export function serializeDaemonLock(lock: DaemonLockInfo): Record<string, unknown> {
  return {
    schemaVersion: DAEMON_LOCK_SCHEMA_VERSION,
    pid: lock.pid,
    startedAt: lock.startedAt.toISOString(),
    procStart: lock.procStart,
    launchedBy: lock.launchedBy,
  };
}
