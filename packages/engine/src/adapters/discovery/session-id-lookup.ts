/**
 * `SessionIdLookup`'s implementation (V2-T55 item 1, `core/ports.ts`): an on-demand session lookup
 * by `sessionId` or a prefix of it, ignoring `relevanceHours` entirely. `TranscriptScanOptions`'s
 * own window (`transcript-scan.ts`) exists to keep the ambient, unasked-for discovery
 * (`seeya sessions`, the sidebar's 10s tick) cheap and current-day-focused; a person who already
 * has an id — handed to them by `claude` on exit, pasted from a teammate, read in
 * `docs/QUESTOES.md` — has ALREADY made the choice `relevanceHours` exists to make FOR them. This
 * module exists so that choice isn't overridden by a time window that was never about "which
 * session do you want", only "which sessions should show up unasked".
 *
 * **The registry is never re-read here.** `discoverSessionsFromRegistry` (`registry.ts`) already
 * has no time window of its own — a Claude Code session's `~/.claude/sessions/<pid>.json` entry
 * lives exactly as long as the process does, regardless of when it started (D-016) — so a session
 * with a live or recently-live registry entry is ALWAYS already in `SessionProvider.list()`'s own
 * result, no matter how old. Every real caller of this module (`cli/session-reference.ts`,
 * `application/session-id-search.ts`) only reaches it after that normal, already-known list came
 * up empty for the id typed. What only this module can find is a session whose registry entry is
 * gone (the process exited and Claude Code removed it) and whose transcript's mtime already fell
 * outside `relevanceHours` — exactly "adopt a session closed more than 12 hours ago", the case
 * V2-T55 was written for.
 *
 * **Cost**, per `docs/DESEMPENHO.md`'s own discipline (this never runs on a periodic cycle — see
 * `core/ports.ts#SessionIdLookup`'s own docstring on why it's a separate port): a prefix that
 * matches nothing costs one `readdir` per Claude Code project directory
 * (`collectCandidateFiles`, reused unchanged from `transcript-scan.ts`) plus one string comparison
 * per `.jsonl` file name — no `stat`, no file content read, for anything that doesn't already
 * match by NAME. Only a candidate whose file name starts with the prefix pays for a `stat` and a
 * transcript read (`processTranscriptFile`). See this task's own delivery notes
 * (`backlog/tasks/task-45...md`) for a measurement against a synthetic `~/.claude` tree with many
 * project directories.
 */
import path from 'node:path';
import type { SessionIdLookup } from '../../core/ports.js';
import type { SessionWithoutPid, SessionIdLookupOutcome } from '../../core/types.js';
import { readForkRegistry } from './fork-registry.js';
import {
  collectCandidateFiles,
  statMtimeMs,
  processTranscriptFile,
  TRANSCRIPT_EXTENSION,
} from './transcript-scan.js';

export interface SessionIdLookupOptions {
  /** Injectable root standing in for `~/.claude` (never read from `os.homedir()` here). */
  readonly claudeHome: string;
  /** Injectable root standing in for `~/.seeya`, only used to find `forks.json` (D-012). */
  readonly seeyaHome: string;
}

/** Whether `filePath`'s own transcript file name starts with `idPrefix` — checked before any
 * `stat` or content read, so a prefix that matches nothing costs one `readdir` per slug and
 * nothing more (see this module's own "Cost" docstring above). */
function fileNameMatchesPrefix(filePath: string, idPrefix: string): boolean {
  const sessionId = path.basename(filePath, TRANSCRIPT_EXTENSION);
  return sessionId.startsWith(idPrefix);
}

/**
 * The `SessionIdLookup` port's core logic, as a plain function (`DiscoverySessionIdLookup` below
 * only wraps it with constructor-injected options — same split `session-provider.ts` doesn't
 * bother with because `DiscoverySessionProvider.list()` has no meaningful "just the function" form
 * without a class holding its five constructor fields; this port only needs two).
 *
 * @example
 * findSessionByIdPrefix('a1b2c3d4', { claudeHome, seeyaHome })
 * // { kind: 'found', session: {...} } — exactly one transcript's file name started with the prefix
 */
export async function findSessionByIdPrefix(
  idPrefix: string,
  options: SessionIdLookupOptions,
): Promise<SessionIdLookupOutcome> {
  const projectsDir = path.join(options.claudeHome, 'projects');
  const [forkRegistry, candidates] = await Promise.all([
    readForkRegistry(options.seeyaHome),
    collectCandidateFiles(projectsDir),
  ]);

  const matchingFiles = candidates.files.filter((file) => fileNameMatchesPrefix(file, idPrefix));

  const sessions: SessionWithoutPid[] = [];
  for (const filePath of matchingFiles) {
    const mtimeOrRejection = await statMtimeMs(filePath);
    // A `stat` failure here is the same "couldn't check" case `transcript-scan.ts` already treats
    // as a per-file rejection elsewhere — this module has no summary line to surface it on (it
    // only ever answers found/ambiguous/notFound), so a candidate it couldn't verify is silently
    // excluded rather than crashing the whole lookup (D-025: "couldn't check" isn't "doesn't
    // exist", but a lookup with only three possible answers can't say that either).
    if (typeof mtimeOrRejection !== 'number') {
      continue;
    }
    const outcome = await processTranscriptFile(
      filePath,
      mtimeOrRejection,
      forkRegistry.sessionIds,
    );
    if (outcome.kind === 'accepted') {
      sessions.push(outcome.session);
    }
  }

  const [first, second] = sessions;
  if (second !== undefined) {
    return { kind: 'ambiguous', candidates: sessions };
  }
  return first === undefined ? { kind: 'notFound' } : { kind: 'found', session: first };
}

/** `SessionIdLookup`'s concrete implementation — the class `cli/composition.ts` and
 * `packages/app/src/composition/index.ts` (the two composition roots, D-020) instantiate. */
export class DiscoverySessionIdLookup implements SessionIdLookup {
  constructor(private readonly options: SessionIdLookupOptions) {}

  async findByIdPrefix(idPrefix: string): Promise<SessionIdLookupOutcome> {
    return findSessionByIdPrefix(idPrefix, this.options);
  }
}
