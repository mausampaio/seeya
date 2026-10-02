/**
 * PO review round 1 (V2-T69, item 5): a `CaptureFailure.reason` is the raw `Error.message` the
 * capture pipeline threw (`application/end-day.ts#captureSessionOutcome`'s own `catch`) — often a
 * stack-trace-adjacent sentence with an absolute path baked in (e.g. a corrupted handoff file's own
 * `ENOENT`/`SyntaxError` text, `adapters/storage/index.ts`'s own `${filePath} is not valid JSON:
 * ${error}`). The PO's own instruction: the list shows a short, legible line with any home-relative
 * path abbreviated by `~`, and the COMPLETE message stays reachable — chosen here via the row's
 * native `title` attribute (a tooltip), never hidden outright. `ineligible`/`closed` reasons are
 * hand-written short sentences with no path in them — running them through this function is a
 * no-op (nothing to abbreviate, well under the length threshold), so every reason this app shows
 * goes through the same function rather than a kind-specific branch.
 *
 * PO review round 2 (V2-T69, item 2): the `~` abbreviation reuses `sidebar/directory-label.ts
 * #collapseHomeDirectory` — the same function the Today tab uses, never a third implementation.
 * **Where this guard rail ends:** `collapseHomeDirectory` only matches when `homeDir` is a
 * PREFIX of the WHOLE string (or the whole string, exactly) — true for every `CaptureFailure`
 * shape this codebase currently produces (the path always leads the message), but a future error
 * whose path is embedded mid-sentence instead of at the start would pass through unabbreviated,
 * never garbled — `collapseHomeDirectory` returns a non-matching string unchanged (D-025).
 *
 * Pure: no I/O. `homeDir`/`platform` are passed in, same discipline as `collapseHomeDirectory`
 * itself.
 */
import type { PathPlatformHint } from '@seeya-ai/engine/core/cwd-normalization.js';
import { collapseHomeDirectory } from '../sidebar/directory-label.js';

/** A short, legible line is more useful than the complete message in a list row — past this many
 * characters the row would wrap awkwardly or push the badge off-screen; the full text is still one
 * hover away via `title`. */
const MAX_SUMMARY_LENGTH = 100;

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
  platform: PathPlatformHint,
): SummarizedFailureReason {
  const abbreviated = collapseHomeDirectory(reason, homeDir, platform);
  const text =
    abbreviated.length > MAX_SUMMARY_LENGTH
      ? `${abbreviated.slice(0, MAX_SUMMARY_LENGTH - 1)}…`
      : abbreviated;
  return { text, fullText: reason };
}
