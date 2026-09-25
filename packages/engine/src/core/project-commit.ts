/**
 * D-047 item 4: "todo commit diz de quem é e de qual projeto" — the two git trailers every commit
 * `seeya` makes in the workspace carries, so reverting a session's own commits inside one project
 * (V2-T32) can find exactly the right ones later. Pure: builds the full commit message text;
 * `adapters/workspace/index.ts#FsWorkspaceRepository.commitAll` only ever receives the finished
 * string and never assembles a trailer itself.
 */

/** Trailer keys, fixed here for `AGENTS.md`'s glossary before any caller uses them (D-047). */
export const PROJECT_ID_TRAILER_KEY = 'Seeya-Project-Id';
export const SESSION_ID_TRAILER_KEY = 'Seeya-Session-Id';

/**
 * What `Seeya-Session-Id` reads when `sessionId` is `undefined` — D-025 applied to a commit
 * trailer that has to exist on every commit regardless: the literal word "unknown" is the least
 * specific TRUE statement ("this session's identity wasn't available"), never a guessed or
 * fabricated identifier standing in for it.
 */
export const UNKNOWN_SESSION_TRAILER_VALUE = 'unknown';

/**
 * `subject` plus a blank line plus both trailers, git's own trailer convention (a blank line
 * separating the subject/body from a block of `Key: value` lines, no blank line between the two
 * trailers themselves).
 *
 * @example
 * buildProjectCommitMessage('Create project auth-hardening', 'auth-hardening', 'abc123')
 * // "Create project auth-hardening\n\nSeeya-Project-Id: auth-hardening\nSeeya-Session-Id: abc123"
 */
export function buildProjectCommitMessage(
  subject: string,
  projectId: string,
  sessionId: string | undefined,
): string {
  const sessionValue = sessionId ?? UNKNOWN_SESSION_TRAILER_VALUE;
  return (
    `${subject}\n\n` +
    `${PROJECT_ID_TRAILER_KEY}: ${projectId}\n` +
    `${SESSION_ID_TRAILER_KEY}: ${sessionValue}`
  );
}

/**
 * Reads one trailer's value out of a full commit message — shared by
 * `core/workspace-commit-guard.ts` (V2-T34 item 1, deciding what a commit-in-progress is missing)
 * and `core/project-audit.ts` (V2-T34 item 3, deciding what a commit already in history is missing)
 * so the same trailer syntax is parsed in exactly one place (AGENTS.md: "nada de duplicação").
 * `null` when the key never appears as its own `Key: value` line (D-025) — never mistaken for an
 * empty-string value, which this pattern can't produce anyway (`.+` requires at least one
 * character).
 *
 * @example
 * extractCommitTrailer('Fix bug\n\nSeeya-Project-Id: auth\nSeeya-Session-Id: unknown', 'Seeya-Project-Id')
 * // 'auth'
 */
export function extractCommitTrailer(message: string, key: string): string | null {
  const pattern = new RegExp(`^${key}:\\s*(.+)$`, 'm');
  const match = message.match(pattern);
  if (match === null || match[1] === undefined) {
    return null;
  }
  return match[1].trim();
}
