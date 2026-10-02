/**
 * The window's own one-letter badge for a `ChangedFileRow.status` (V2-T71,
 * `docs/INTERFACE.md` § 9's own "a lista de arquivos (M/A)") — the exact letters `git status
 * --short`/`seeya project show` already use, so a person who has seen either reads this
 * instantly. Pure, tested here instead of inline in `LeftoverChangesConfirmDialog.tsx`.
 */
import type { ChangedFileDisplayStatus } from '../ipc/channels.js';

const LETTER_BY_STATUS: Readonly<Record<ChangedFileDisplayStatus, string>> = {
  modified: 'M',
  added: 'A',
  deleted: 'D',
  renamed: 'R',
  other: '?',
};

/**
 * @example
 * formatChangedFileStatusLetter('added') // 'A'
 */
export function formatChangedFileStatusLetter(status: ChangedFileDisplayStatus): string {
  return LETTER_BY_STATUS[status];
}
