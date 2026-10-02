/**
 * The window's own text for `ConfirmProjectLockOpenRequestEvent` (V2-T71, `docs/INTERFACE.md` §
 * 9's own "quem segura o lock e desde quando"): pure, tested here instead of inline in
 * `ProjectLockConfirmDialog.tsx`, same split every other `state/` module in this package already
 * draws between "what the data says" and "how a component renders it."
 */
import type { ConfirmProjectLockOpenRequestEvent } from '../ipc/channels.js';

/**
 * `toLocaleString()` for the "since" instant — the same date+time rendering
 * `state/projects-panel.ts#formatSessionLastActivityText` already uses for a lock's own
 * `acquiredAt`, so the window never shows two different date formats for the same kind of fact.
 *
 * @example
 * formatLockHolderLine({ heldBySessionId: 'abc123', heldByPid: 456, heldByAcquiredAt: new Date(0) })
 * // 'Session abc123 (pid 456) has held this lock since 1/1/1970, 12:00:00 AM.'
 */
export function formatLockHolderLine(
  event: Pick<
    ConfirmProjectLockOpenRequestEvent,
    'heldBySessionId' | 'heldByPid' | 'heldByAcquiredAt'
  >,
): string {
  const holder =
    event.heldBySessionId === null ? 'An unidentified session' : `Session ${event.heldBySessionId}`;
  return (
    `${holder} (pid ${event.heldByPid}) has held this lock since ` +
    `${event.heldByAcquiredAt.toLocaleString()}.`
  );
}
