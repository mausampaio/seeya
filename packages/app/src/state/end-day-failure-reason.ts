/**
 * PO review round 1 (V2-T69, item 5): a `CaptureFailure.reason` is the raw `Error.message` the
 * capture pipeline threw (`application/end-day.ts#captureSessionOutcome`'s own `catch`) — often a
 * stack-trace-adjacent sentence with an absolute path baked in (e.g. a corrupted handoff file's own
 * `ENOENT`/`SyntaxError` text). The PO's own instruction: the list shows a short, legible line with
 * any home-relative path abbreviated by `~`, and the COMPLETE message stays reachable — chosen here
 * via the row's native `title` attribute (a tooltip), never hidden outright. `ineligible`/`closed`
 * reasons are hand-written short sentences with no path in them — running them through this
 * function is a no-op (nothing to abbreviate, well under the length threshold), so every reason
 * this app shows goes through the same function rather than a kind-specific branch.
 *
 * Pure: no I/O. `homeDir`/`platform` are passed in, same discipline as
 * `sidebar/directory-label.ts#formatSessionDirectory` (which this module deliberately does NOT
 * reuse — that one replaces the home prefix of a WHOLE path string; a failure reason has the path
 * embedded inside a sentence, at an unknown offset, so this abbreviates every OCCURRENCE instead).
 */
export type EndDayFailureReasonPlatform = 'win32' | 'posix';

/** A short, legible line is more useful than the complete message in a list row — past this many
 * characters the row would wrap awkwardly or push the badge off-screen; the full text is still one
 * hover away via `title`. */
const MAX_SUMMARY_LENGTH = 100;

/** Escapes every regex metacharacter in `value` so it can be spliced into a `RegExp` literally —
 * needed because a Windows `homeDir` contains `\`, which is itself a regex escape character. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Replaces every occurrence of `homeDir` inside `text` with `~` — case-insensitive on `win32`
 * (same tolerance `formatSessionDirectory` already applies, since Windows paths are
 * case-insensitive), exact on `posix`. A plain `.split(homeDir).join('~')` would do for posix, but
 * `win32` needs a case-insensitive match, so both paths go through one `RegExp`-based
 * implementation rather than two different mechanisms for what's conceptually the same operation. */
function abbreviateHomeOccurrences(
  text: string,
  homeDir: string,
  platform: EndDayFailureReasonPlatform,
): string {
  if (homeDir.length === 0) {
    return text;
  }
  const flags = platform === 'win32' ? 'gi' : 'g';
  return text.replace(new RegExp(escapeRegExp(homeDir), flags), '~');
}

export interface SummarizedFailureReason {
  /** The short, `~`-abbreviated line to show directly in the row. */
  readonly text: string;
  /** The original, complete message — identical to `text` when nothing was abbreviated or
   * truncated, so a caller can decide whether a tooltip is even worth attaching by comparing the
   * two (`summary.text !== summary.fullText`), never a separate boolean this module would also
   * have to keep in sync. */
  readonly fullText: string;
}

/**
 * @example
 * summarizeFailureReason('ENOENT: no such file', '/home/x', 'posix')
 * // { text: 'ENOENT: no such file', fullText: 'ENOENT: no such file' }
 * summarizeFailureReason('/home/x/.seeya/days/x.json is not valid JSON', '/home/x', 'posix')
 * // { text: '~/.seeya/days/x.json is not valid JSON', fullText: '/home/x/.seeya/days/x.json is not valid JSON' }
 */
export function summarizeFailureReason(
  reason: string,
  homeDir: string,
  platform: EndDayFailureReasonPlatform,
): SummarizedFailureReason {
  const abbreviated = abbreviateHomeOccurrences(reason, homeDir, platform);
  const text =
    abbreviated.length > MAX_SUMMARY_LENGTH
      ? `${abbreviated.slice(0, MAX_SUMMARY_LENGTH - 1)}…`
      : abbreviated;
  return { text, fullText: reason };
}
