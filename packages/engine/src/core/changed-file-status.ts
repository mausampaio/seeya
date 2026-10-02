/**
 * V2-T71 (`docs/INTERFACE.md` § 9's own "a lista de arquivos (M/A)"): a coarse, DISPLAY-ONLY
 * status for one changed file — parsed from a `git status --porcelain` line, but never fed back
 * into a `git add`/`git commit` call (that remains `WorkspaceRepository.listChangedFiles`'s own
 * plain path list, untouched by this task — `adapters/workspace/index.ts`'s own docstring already
 * explains why a raw-but-honest line beats a parser that has to get every porcelain edge case
 * right for no behavioural benefit). This module exists ONLY because the window's own leftover-
 * changes confirmation now shows each file's status next to its path; the handful of porcelain
 * combinations this doesn't distinguish (copied, both-modified, a rename's own `old -> new` form)
 * collapse into `'other'` rather than needing a parser that is never allowed to be wrong.
 */

export type ChangedFileStatus = 'modified' | 'added' | 'deleted' | 'renamed' | 'other';

export interface ChangedFileEntry {
  readonly path: string;
  readonly status: ChangedFileStatus;
}

const STATUS_BY_LETTER: Readonly<Record<string, ChangedFileStatus>> = {
  M: 'modified',
  A: 'added',
  D: 'deleted',
  R: 'renamed',
};

/**
 * `git status --porcelain`'s own `XY <path>` shape: two status characters (X = staged, Y =
 * unstaged), one space, then the path. `??` is the one two-character code that means something
 * different from "X then Y" — an untracked file, always shown as added here (there is no earlier
 * committed version to call it "modified" against).
 *
 * @example
 * parseChangedFileStatusLine('?? context/know-how.md')
 * // { path: 'context/know-how.md', status: 'added' }
 * parseChangedFileStatusLine(' M AGENTS.md')
 * // { path: 'AGENTS.md', status: 'modified' }
 */
export function parseChangedFileStatusLine(line: string): ChangedFileEntry {
  const code = line.slice(0, 2);
  const filePath = line.slice(3);
  if (code === '??') {
    return { path: filePath, status: 'added' };
  }
  const staged = code.charAt(0);
  const unstaged = code.charAt(1);
  const letter = staged !== ' ' && staged !== '' ? staged : unstaged;
  return { path: filePath, status: STATUS_BY_LETTER[letter] ?? 'other' };
}
