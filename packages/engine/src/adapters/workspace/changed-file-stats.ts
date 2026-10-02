/**
 * `WorkspaceRepository.listChangedFilesWithStats`'s own mechanics (V2-T70, `docs/INTERFACE.md`
 * § 7 item 2) — a sibling of `revert.ts`/`audit.ts`/`manifest-restore.ts`, split out of `index.ts`
 * the same way those three already were (V2-T76, Q-101's own ~500-line ceiling).
 *
 * Three git calls, all scoped with `-- projectId` the same way `commitAll`/`listChangedFiles`
 * already scope their own: `status --porcelain --untracked-files=all` for WHICH files changed and
 * how (added/modified/deleted); `diff --numstat` and `diff --cached --numstat` for how many lines
 * a TRACKED file's own change added/removed (unstaged and staged respectively — a session that
 * ran `git add` without committing is still possible, even though D-047 item 6's own interactive
 * approval never runs `git add` itself). An untracked (`??`) file has no tracked history for
 * `diff --numstat` to compare against at all — its own line count comes from reading the file
 * directly and counting newlines, `null` (never a fabricated `0`, D-025) for anything that looks
 * binary (a NUL byte, the same heuristic git itself uses) or that fails to read.
 *
 * **V2-T73 rebase (PO coordination, 2026-10-02): the status parsing itself is V2-T71's
 * `core/changed-file-status.ts#parseChangedFileStatusLine`, not a second, locally-grown parser of
 * the same two-letter porcelain code** — this module still owns the ONE `git status --porcelain`
 * call a listing makes (never a second status read: `WorkspaceRepository.listChangedFilesWithStatus`,
 * V2-T71's own sibling method, is a SEPARATE call site with a different caller, not something this
 * function invokes), but the parsing itself is shared, so the two methods can never silently
 * disagree on what a given porcelain line means.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ChangedFileStatsEntry, ChangedFileLineCounts } from '../../core/ports.js';
import {
  parseChangedFileStatusLine,
  type ChangedFileStatus,
} from '../../core/changed-file-status.js';
import { runGit } from '../git/run-git.js';

/** V2-T71's own `ChangedFileStatus` → this module's own narrower `kind` (D-024's three members,
 * `added`/`modified`/`deleted`) — `renamed` and `other` both collapse into `modified`, with
 * `lines: null` always (Q-108: a rename's `"old -> new"` path never re-matches `diff --numstat`'s
 * differently-spelled `old => new`, and `other` is the same "a porcelain combination this project
 * doesn't try to be more specific about than it can honestly be" shape). */
function toKind(status: ChangedFileStatus): ChangedFileStatsEntry['kind'] {
  if (status === 'added') {
    return 'added';
  }
  if (status === 'deleted') {
    return 'deleted';
  }
  return 'modified';
}

/** Built via a `switch` on a LITERAL, never a cast (AGENTS.md: "`!`/`as`... sinal de que o tipo
 * está errado") — the three members of `ChangedFileStatsEntry` are structurally identical apart
 * from `kind`, but a plain object literal with a WIDENED `kind` variable doesn't satisfy a
 * discriminated union on its own, so this is what actually proves the match to the compiler. */
function buildEntry(
  kind: ChangedFileStatsEntry['kind'],
  filePath: string,
  lines: ChangedFileLineCounts | null,
): ChangedFileStatsEntry {
  switch (kind) {
    case 'added':
      return { kind: 'added', path: filePath, lines };
    case 'modified':
      return { kind: 'modified', path: filePath, lines };
    case 'deleted':
      return { kind: 'deleted', path: filePath, lines };
  }
}

/** `git diff --numstat`'s own line shape: `<added>\t<removed>\t<path>` — `-\t-\t<path>` for a
 * binary file. A tab is also valid INSIDE a path in theory, which is why the path is rejoined from
 * every part after the first two columns, instead of a `split('\t', 3)`-style cap this runtime
 * doesn't actually offer. */
function parseNumstatLine(line: string): readonly [string, ChangedFileLineCounts | null] | null {
  const [addedRaw, removedRaw, ...pathParts] = line.split('\t');
  if (addedRaw === undefined || removedRaw === undefined || pathParts.length === 0) {
    return null;
  }
  const filePath = pathParts.join('\t');
  if (addedRaw === '-' || removedRaw === '-') {
    return [filePath, null];
  }
  const added = Number.parseInt(addedRaw, 10);
  const removed = Number.parseInt(removedRaw, 10);
  if (!Number.isInteger(added) || !Number.isInteger(removed)) {
    return [filePath, null];
  }
  return [filePath, { added, removed }];
}

async function readNumstatLineCounts(
  root: string,
  projectId: string,
  cachedFlag: readonly string[],
): Promise<ReadonlyMap<string, ChangedFileLineCounts | null>> {
  const result = await runGit(root, ['diff', '--numstat', ...cachedFlag, '--', projectId]);
  if (!result.ran || result.exitCode !== 0) {
    throw new Error(
      `git diff --numstat failed in workspace at "${root}": ` +
        `${result.ran ? `exit ${result.exitCode}` : result.reason}`,
    );
  }
  const map = new Map<string, ChangedFileLineCounts | null>();
  for (const line of result.stdout.split('\n')) {
    if (line.trim().length === 0) {
      continue;
    }
    const parsed = parseNumstatLine(line);
    if (parsed !== null) {
      map.set(parsed[0], parsed[1]);
    }
  }
  return map;
}

/** Counts newlines directly for a file git doesn't track yet — `diff --numstat` has nothing to
 * compare an untracked file against. */
async function countNewFileLines(absolutePath: string): Promise<ChangedFileLineCounts | null> {
  let buffer: Buffer;
  try {
    buffer = await readFile(absolutePath);
  } catch {
    // Permission denied, a symlink to nowhere, or the file vanished between `status` and this
    // read — D-025: unknown, never a guessed `0`.
    return null;
  }
  if (buffer.includes(0)) {
    return null; // Looks binary (a NUL byte) — the same heuristic git itself uses.
  }
  const text = buffer.toString('utf8');
  if (text.length === 0) {
    return { added: 0, removed: 0 };
  }
  const trailingNewline = text.endsWith('\n') ? 1 : 0;
  return { added: text.split('\n').length - trailingNewline, removed: 0 };
}

/** Line counts come from `diff --numstat`(`--cached` included) when git has an index/HEAD entry
 * to compare against — true for a STAGED new file too, not just a modification — and only fall
 * back to a direct file read for a path NEITHER numstat run even mentions, which is exactly what
 * a genuinely untracked (`??`) file looks like (nothing to diff against at all). Checking "is this
 * path missing from both maps" rather than re-deriving the untracked bit from the porcelain code
 * itself is what lets this module drop its own copy of that bit entirely, now that
 * `parseChangedFileStatusLine` (V2-T71) already folds `??` into `status: 'added'` upstream. */
async function resolveLines(
  root: string,
  entryPath: string,
  kind: ChangedFileStatsEntry['kind'],
  unstaged: ReadonlyMap<string, ChangedFileLineCounts | null>,
  staged: ReadonlyMap<string, ChangedFileLineCounts | null>,
): Promise<ChangedFileLineCounts | null> {
  const fromDiff = unstaged.get(entryPath) ?? staged.get(entryPath);
  if (fromDiff !== undefined) {
    return fromDiff;
  }
  if (kind === 'added') {
    return countNewFileLines(path.join(root, entryPath));
  }
  return null;
}

/**
 * @example
 * await listChangedFilesWithStats('/seeya/workspace', 'auth-hardening')
 * // [{ kind: 'added', path: 'auth-hardening/context/know-how.md', lines: { added: 4, removed: 0 } }]
 */
export async function listChangedFilesWithStats(
  root: string,
  projectId: string,
): Promise<readonly ChangedFileStatsEntry[]> {
  // The ONE `git status --porcelain` call this listing makes (PO coordination, V2-T73 rebase) —
  // `WorkspaceRepository.listChangedFilesWithStatus` (V2-T71) is a separate call site with its own
  // caller, never invoked from here, so there is still only ever one status read PER listing.
  const status = await runGit(root, [
    'status',
    '--porcelain',
    '--untracked-files=all',
    '--',
    projectId,
  ]);
  if (!status.ran || status.exitCode !== 0) {
    throw new Error(
      `git status failed in workspace at "${root}": ` +
        `${status.ran ? `exit ${status.exitCode}` : status.reason}`,
    );
  }
  const entries = status.stdout
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map(parseChangedFileStatusLine);
  const [unstaged, staged] = await Promise.all([
    readNumstatLineCounts(root, projectId, []),
    readNumstatLineCounts(root, projectId, ['--cached']),
  ]);
  return Promise.all(
    entries.map(async (entry) => {
      const kind = toKind(entry.status);
      const lines = await resolveLines(root, entry.path, kind, unstaged, staged);
      return buildEntry(kind, entry.path, lines);
    }),
  );
}
