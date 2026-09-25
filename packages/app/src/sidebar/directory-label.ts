/**
 * A long directory path used to stretch the sidebar and force a horizontal scrollbar (PO
 * acceptance of V2-T55, correction 1, 2026-09-25). This shows the END of the path — the part
 * that actually distinguishes one directory from another; a person recognizes
 * "…\projeto-alpha", not the drive/parent chain leading to it — with an ellipsis PREFIX when it
 * doesn't fit in `maxLength` characters. The full path is never lost: the caller
 * (`electron/projects-list-view.ts`) still puts it in the row's own `title` attribute.
 *
 * A fixed character budget, not a live pixel measurement (`element.scrollWidth` etc.): the
 * sidebar's own CSS (`#sidebar-content { overflow-x: hidden }`, `index.css`) is the hard backstop
 * against a horizontal scrollbar even if this number is ever wrong for someone's font or zoom —
 * this function only has to keep the common case short, not be pixel-exact.
 *
 * Works the same for a Windows (`\`) or POSIX (`/`) path — it operates on characters, not path
 * segments, so it never needs to know which separator style `cwd` used.
 */
const DEFAULT_MAX_LENGTH = 32;

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
