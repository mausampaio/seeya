/**
 * A long directory path used to stretch the sidebar and force a horizontal scrollbar (PO
 * acceptance of V2-T55, correction 1, 2026-09-25). This shows the END of the path — the part
 * that actually distinguishes one directory from another; a person recognizes
 * "…\projeto-alpha", not the drive/parent chain leading to it — with an ellipsis PREFIX when it
 * doesn't fit in `maxLength` characters. The full path is never lost: the caller
 * (`renderer/legacy/other-sessions-and-ignored-view.ts`) still puts it in the row's own `title`
 * attribute.
 *
 * A fixed character budget, not a live pixel measurement (`element.scrollWidth` etc.): the
 * sidebar's own CSS (`#sidebar-content { overflow-x: hidden }`, `index.css`) is the hard backstop
 * against a horizontal scrollbar even if this number is ever wrong for someone's font or zoom —
 * this function only has to keep the common case short, not be pixel-exact.
 *
 * Works the same for a Windows (`\`) or POSIX (`/`) path — it operates on characters, not path
 * segments, so it never needs to know which separator style `cwd` used.
 */
import type { PathPlatformHint } from '@seeya-ai/engine/core/cwd-normalization.js';

const DEFAULT_MAX_LENGTH = 32;

/**
 * `formatDirectoryPathForDisplay`'s own default budget (PO review of V2-T66, third round) —
 * deliberately NOT `DEFAULT_MAX_LENGTH` above. That 32 was tuned for the sidebar's own narrow
 * column (`shortenDirectoryPath`'s own docstring, V2-T55 correction 1); the Today tab's session
 * card and "Resume in" selector are surfaces over 1000px wide, where 32 characters truncated a
 * `~`-abbreviated path down to its last segment or two ("…do-mesmo-de-verdade\pasta-atual") even
 * though it would have fit whole at a wider budget. 80 is generous enough that a real `~`-relative
 * path fits untruncated in the common case, while still bounding the rare pathological one — the
 * full, untruncated path is always in the element's own `title` regardless.
 */
const TODAY_TAB_DIRECTORY_MAX_LENGTH = 80;

/**
 * @example
 * shortenDirectoryPath('C:\\code\\seeya') // 'C:\\code\\seeya' — fits, unchanged
 * shortenDirectoryPath('C:\\ProvaSeeya\\um-projeto-com-nome-bem-comprido-mesmo')
 * // '…nome-bem-comprido-mesmo' — the last DEFAULT_MAX_LENGTH-1 characters, ellipsis prefixed
 */
export function shortenDirectoryPath(path: string, maxLength: number = DEFAULT_MAX_LENGTH): string {
  if (path.length <= maxLength) {
    return path;
  }
  // Room for the leading ellipsis character itself within the budget.
  return `…${path.slice(path.length - (maxLength - 1))}`;
}

function withForwardSlashes(path: string): string {
  return path.replace(/\\/g, '/');
}

function stripTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

/**
 * Abbreviates the person's own home directory, when `path` is inside it, to `~` — the other half
 * of what made a real `cwd` unreadable in the Today tab (PO review of V2-T66, item 2:
 * `C:\code\seeya\.claude\worktrees\…\new-directory`, the full absolute path, shown everywhere).
 * `path` and `homeDir` are compared on FORWARD-slash form so a path recorded with either
 * separator style still matches; `platformHint` (never `process.platform` read here, D-019's own
 * discipline extended to platform) only controls case-folding — a Windows path's drive/segment
 * casing is not meaningful for comparison, a POSIX one's is. `homeDir` empty (never resolved, or
 * this hook's own fetch hasn't landed yet) is the least-specific case (D-025): `path` is returned
 * unchanged, never a guess.
 *
 * @example
 * collapseHomeDirectory('C:\\Users\\<usuario>\\code\\seeya', 'C:\\Users\\<usuario>', 'win32')
 * // '~\\code\\seeya'
 * @example
 * collapseHomeDirectory('/home/<usuario>/code/seeya', '/home/<usuario>', 'posix') // '~/code/seeya'
 * @example
 * collapseHomeDirectory('/var/data', '/home/<usuario>', 'posix') // '/var/data' — not under home
 */
export function collapseHomeDirectory(
  path: string,
  homeDir: string,
  platformHint: PathPlatformHint,
): string {
  if (homeDir === '') {
    return path;
  }
  const comparableHome = stripTrailingSlash(withForwardSlashes(homeDir));
  if (comparableHome === '') {
    return path;
  }
  const comparablePath = withForwardSlashes(path);
  const fold = (value: string): string => (platformHint === 'win32' ? value.toLowerCase() : value);
  const foldedPath = fold(comparablePath);
  const foldedHome = fold(comparableHome);
  if (foldedPath === foldedHome) {
    return '~';
  }
  if (!foldedPath.startsWith(`${foldedHome}/`)) {
    return path;
  }
  // `comparableHome.length` lands exactly on the separator between the home prefix and the rest —
  // slicing the ORIGINAL `path` (not the forward-slashed copy) there keeps whichever separator
  // character that position actually used.
  return `~${path.slice(comparableHome.length)}`;
}

/**
 * The combined formatting a `cwd` gets anywhere the Today tab shows one (PO review of V2-T66,
 * item 2): home abbreviated to `~` first, then end-shortened to `maxLength` — the full,
 * unabbreviated `path` always belongs in the element's own `title`, never dropped.
 */
export function formatDirectoryPathForDisplay(
  path: string,
  homeDir: string,
  platformHint: PathPlatformHint,
  maxLength: number = TODAY_TAB_DIRECTORY_MAX_LENGTH,
): string {
  return shortenDirectoryPath(collapseHomeDirectory(path, homeDir, platformHint), maxLength);
}
