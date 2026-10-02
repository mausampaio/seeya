/**
 * V2-T70 (`docs/INTERFACE.md` § 7 item 2): the adoption review dialog's own per-file row — pure
 * mapping from `WorkspaceRepository.listChangedFilesWithStats`'s own `ChangedFileStatsEntry[]` to
 * the short text the dialog shows, kept out of `renderer/features/adoption/ReviewPane/` so the one
 * decision ("what does +12/-3 look like, what happens when a count is unknown") has its own test,
 * the same split `state/end-day-sessions.ts` already draws for a different list.
 */
import type { ChangedFileStatsEntry } from '@seeya-ai/engine/core/ports.js';

export interface AdoptionReviewRow {
  readonly path: string;
  readonly kind: ChangedFileStatsEntry['kind'];
  /** `undefined` exactly when `ChangedFileStatsEntry.lines` was `null` (D-025: a binary file, or a
   * read that failed) — never a fabricated `+0/-0` standing in for "unknown". */
  readonly linesSummary: string | undefined;
}

/**
 * @example
 * formatChangedFileLines({ added: 4, removed: 1 }) // '+4 −1'
 * formatChangedFileLines(null) // undefined
 */
export function formatChangedFileLines(lines: ChangedFileStatsEntry['lines']): string | undefined {
  return lines === null ? undefined : `+${lines.added} −${lines.removed}`;
}

/**
 * @example
 * buildAdoptionReviewRows([{ kind: 'added', path: 'context/know-how.md', lines: { added: 4, removed: 0 } }])
 * // [{ path: 'context/know-how.md', kind: 'added', linesSummary: '+4 −0' }]
 */
export function buildAdoptionReviewRows(
  entries: readonly ChangedFileStatsEntry[],
): readonly AdoptionReviewRow[] {
  return entries.map((entry) => ({
    path: entry.path,
    kind: entry.kind,
    linesSummary: formatChangedFileLines(entry.lines),
  }));
}
