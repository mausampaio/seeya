/**
 * Plain-English rendering of a project lock's state (V2-T35). Pure (`core/`), because it has
 * exactly two consumers on opposite sides of the layer matrix that are never allowed to import
 * from each other (`docs/ARQUITETURA.md`): `cli/format-project.ts` prints these lines to the
 * terminal before `open` hands the screen to the harness (V2-T33 item 4, V2-T35 items 1/3), and
 * `application/project-open.ts` feeds the SAME text to the launched session itself via
 * `--append-system-prompt` (V2-T35 item 2) — one source of truth for "what does the lock's
 * warning say," never two wordings drifting apart on the next edit to one of them.
 */
import type { ProjectLockInfo } from './project-lock.js';
import type { ProjectOpenLockOutcome } from './project-lock.js';

/** "session &lt;id&gt;" when the lock's holder is known, "an unidentified session" otherwise (D-025:
 * `ProjectLockInfo.sessionId` is absent, not a guessed identity — see that field's own docstring).
 * Shared by `cli/format-project.ts#formatLockStatusLine` (`seeya project show`) and
 * `formatProjectLockWarningLines` below. */
export function formatLockHolderDescription(lock: ProjectLockInfo): string {
  const holder =
    lock.sessionId === undefined ? 'an unidentified session' : `session ${lock.sessionId}`;
  return `${holder} (pid ${lock.pid}) since ${lock.acquiredAt.toISOString()}`;
}

/** `seeya project open`'s own lock warning (V2-T33 D-047 item 4, V2-T35 items 1-2) — `acquired`
 * with no `reclaimedStale` prints nothing (the ordinary case: a genuinely free lock needs no
 * comment); `acquired` with `reclaimedStale` set names the stale lock it just took over, so a
 * silently-abandoned lock never looks like nothing happened. `readOnly` is the one that matters
 * most: this session did NOT get the lock, so it can look but "não escreve" — the guard that
 * enforces that is V2-T34's, this is only the warning half (`ProjectOpenLockOutcome`'s own
 * docstring).
 *
 * @example
 * formatProjectLockWarningLines('auth-hardening', { kind: 'acquired', reclaimedStale: null })
 * // [] — nothing to warn about
 */
export function formatProjectLockWarningLines(
  projectId: string,
  lock: ProjectOpenLockOutcome,
): string[] {
  if (lock.kind === 'readOnly') {
    return [
      `Project "${projectId}" is locked by ${formatLockHolderDescription(lock.heldBy)} — ` +
        'opening for reading only. Work in your own code, but changes to this project itself ' +
        'will not be recorded here until that session releases the lock.',
    ];
  }
  if (lock.reclaimedStale === null) {
    return [];
  }
  return [
    `Project "${projectId}"'s lock was stale (last held by ` +
      `${formatLockHolderDescription(lock.reclaimedStale)}) — reclaimed.`,
  ];
}
