/**
 * Registers a fork `seeya` itself created (D-012) into `<seeyaHome>/forks.json` (Q-008's format).
 * Reuses `adapters/discovery/fork-registry.ts`'s reader (`readForkRegistryEntries`,
 * `forkRegistryPath`, `FORK_REGISTRY_SCHEMA_VERSION`) rather than re-implementing the same
 * JSON-parse-then-validate pipeline here (AGENTS.md: "nada de duplicação") — see that module's
 * top comment for why the two read functions exist side by side.
 */
import type { ForkRegistration } from '../../core/ports.js';
import { writeFileAtomic } from '../storage/atomic-write.js';
import {
  FORK_REGISTRY_SCHEMA_VERSION,
  forkRegistryPath,
  readForkRegistryEntries,
  type ForkRegistryEntry,
  type RejectedForkEntry,
} from '../discovery/fork-registry.js';

export interface RegisterForkResult {
  /** Entries from the existing file that failed validation and were dropped from the rewritten
   * document (D-022's "both sides") — `deep-generator.ts` doesn't act on this today, but it's
   * here instead of silently disappearing so a future caller (or a test) can see it happened. */
  readonly rejected: RejectedForkEntry[];
}

/**
 * Merges `{sessionId, createdAt}` into the existing registry and writes it back atomically —
 * read, append (unless already present), write, never overwrite blindly.
 *
 * **Called BEFORE the fork's `claude` call is spawned**, with a `sessionId` this module never
 * generates itself (`deep-generator.ts` picks it via `--session-id`, confirmed real in
 * `args.ts`'s docstring). D-012's registration has to survive a `claude` call that later times
 * out or exits non-zero: `--fork-session` can already have written the transcript file to disk by
 * the time either happens, and registering only after a SUCCESSFUL `generate()` would leak
 * exactly the unregistered fork D-012 exists to prevent — the feedback loop where `seeya`
 * discovers its own fork as a session and forks it again.
 *
 * A corrupted existing file (bad JSON, wrong root shape) has nothing valid left to merge with, so
 * this still writes a fresh file carrying just the new entry — refusing to register would leave
 * D-012's one guarantee unmet — and reports the corruption through `rejected` instead of losing
 * it silently.
 */
export async function registerFork(
  seeyaHome: string,
  sessionId: string,
  createdAt: Date,
): Promise<RegisterForkResult> {
  const { entries, rejected } = await readForkRegistryEntries(seeyaHome);
  const alreadyPresent = entries.some((entry) => entry.sessionId === sessionId);
  const nextEntries: ForkRegistryEntry[] = alreadyPresent
    ? entries
    : [...entries, { sessionId, createdAt: createdAt.toISOString() }];
  const document = { schemaVersion: FORK_REGISTRY_SCHEMA_VERSION, forks: nextEntries };
  await writeFileAtomic(forkRegistryPath(seeyaHome), JSON.stringify(document, null, 2));
  return { rejected };
}

/**
 * V2-T29: removes `sessionId` from `forks.json`, if present — the write side of
 * `ForkRegistration.unregister` (`core/ports.ts`), used by `application/project-adopt.ts
 * #adoptSession` on both ends of an adoption: a declined commit (nothing should stay registered,
 * item 2 of the task's spec) and an accepted one (the fork is promoted — `adoptions.json` tracks it
 * from then on, never `forks.json`). Symmetric with `registerFork` above: read, drop the one entry
 * if it's there, write the rest back atomically. A `sessionId` that isn't registered at all is a
 * no-op, not an error (D-025 — the caller may be cleaning up after a launch that never actually
 * wrote a transcript, `HarnessOpenResult.failedToStart`).
 */
export async function unregisterFork(seeyaHome: string, sessionId: string): Promise<void> {
  const { entries } = await readForkRegistryEntries(seeyaHome);
  const remaining = entries.filter((entry) => entry.sessionId !== sessionId);
  if (remaining.length === entries.length) {
    return;
  }
  const document = { schemaVersion: FORK_REGISTRY_SCHEMA_VERSION, forks: remaining };
  await writeFileAtomic(forkRegistryPath(seeyaHome), JSON.stringify(document, null, 2));
}

/**
 * V2-T29: `core/ports.ts#ForkRegistration`'s only implementation — a thin wrapper over
 * `registerFork`/`unregisterFork` above, so `application/project-adopt.ts` can depend on the port
 * instead of these two functions directly (the layer matrix forbids `application` → `adapters`,
 * D-020). `seeyaHome` is bound once at construction, same convention `StorageAdapter` already uses,
 * so every call site doesn't have to keep threading it through.
 */
export class GenerationForkRegistration implements ForkRegistration {
  constructor(private readonly seeyaHome: string) {}

  register(sessionId: string, createdAt: Date): Promise<void> {
    return registerFork(this.seeyaHome, sessionId, createdAt).then(() => undefined);
  }

  unregister(sessionId: string): Promise<void> {
    return unregisterFork(this.seeyaHome, sessionId);
  }
}
