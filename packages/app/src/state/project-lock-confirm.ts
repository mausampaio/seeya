/**
 * The window's own text for `ConfirmProjectLockOpenRequestEvent` (V2-T71, `docs/INTERFACE.md` §
 * 9's own "quem segura o lock e desde quando"): pure, tested here instead of inline in
 * `ProjectLockConfirmDialog.tsx`, same split every other `state/` module in this package already
 * draws between "what the data says" and "how a component renders it."
 */
import { computeDisplaySessionIds } from '@seeya-ai/engine/application/session-id-display.js';
import type { ConfirmProjectLockOpenRequestEvent } from '../ipc/channels.js';

/**
 * The SAME short-id scheme `state/projects-panel.ts#formatProjectRowLockText` already uses for
 * the Projects tab's own "Locked by session 33333333" lock column (PO review, round 1: the two
 * screens showed a different id for the identical lock — the full one here, the short one
 * there). A batch of one never collides with itself, so this is just
 * `computeDisplaySessionIds`'s own single-id case, never a second shortening scheme.
 *
 * @example
 * shortLockHolderSessionId('33333333-3333-4333-8333-333333333333') // '33333333'
 */
export function shortLockHolderSessionId(sessionId: string): string {
  return computeDisplaySessionIds([sessionId]).get(sessionId) ?? sessionId;
}

/**
 * `toLocaleString()` for the "since" instant — the same date+time rendering
 * `state/projects-panel.ts#formatSessionLastActivityText` already uses for a lock's own
 * `acquiredAt`, so the window never shows two different date formats for the same kind of fact.
 * The full `sessionId` is never dropped — `ProjectLockConfirmDialog.tsx` puts it on this line's
 * own `title` attribute (a hover tooltip), the same "short text, full fact on hover" shape
 * `sidebar/directory-label.ts#shortenDirectoryPath` already established for a truncated path.
 *
 * @example
 * formatLockHolderLine({ heldBySessionId: '33333333-3333-4333-8333-333333333333', heldByPid: 456, heldByAcquiredAt: new Date(0) })
 * // 'Session 33333333 (pid 456) has held this lock since 1/1/1970, 12:00:00 AM.'
 */
export function formatLockHolderLine(
  event: Pick<
    ConfirmProjectLockOpenRequestEvent,
    'heldBySessionId' | 'heldByPid' | 'heldByAcquiredAt'
  >,
): string {
  const holder =
    event.heldBySessionId === null
      ? 'An unidentified session'
      : `Session ${shortLockHolderSessionId(event.heldBySessionId)}`;
  return (
    `${holder} (pid ${event.heldByPid}) has held this lock since ` +
    `${event.heldByAcquiredAt.toLocaleString()}.`
  );
}
