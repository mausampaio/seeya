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
/**
 * V2-T30 item 3: the question asked when `open` finds the project read-only-locked (V2-T35 item
 * 1), without any interface-specific prompt suffix attached — `cli/format-project.ts
 * #renderReadOnlyOpenConfirmation` appends its own `" [y/N] "` for `readline`, and the app's own
 * lock-confirmation dialog (`packages/app/src/resume/project-tab-launcher.ts` and its dialog in
 * `packages/app/src/electron/project-panel-view.ts`) shows this exact sentence above its own
 * Proceed/Decline buttons — one wording, two renderings, same "sai de `cli/` para um módulo que os
 * dois alcancem" movement V2-T35 already made for `formatProjectLockWarningLines` above.
 */
export function renderReadOnlyOpenQuestion(heldBy: ProjectLockInfo): string {
  return (
    `Continue and open this project for reading only? ` +
    `(It stays locked by ${formatLockHolderDescription(heldBy)}.)`
  );
}

/**
 * V2-T34 item 4, moved here from `cli/format-project.ts` (PO review, 2026-09-25 production
 * defect): the question `open` asks when it just acquired the lock and found changes a previous
 * session left uncommitted, as separate lines — one per changed file, same "list, then ask" shape
 * `core/project-adoption-message.ts#renderAdoptionCommitChangedFilesLines` already established,
 * so the window's own dialog (`electron/project-leftover-changes-confirm-dialog-view.ts`, one
 * paragraph per line via `electron/dialog-lines.ts#renderDialogLines`) can render it without
 * collapsing the list into a single run-on sentence. The window never asked this at all before
 * this fix; `cli/format-project.ts#renderLeftoverChangesConfirmation` joins these lines with `\n`
 * and appends its own `[c = commit now, p = proceed, ...]` suffix onto the last one, for
 * `readline`.
 *
 * @example
 * renderLeftoverChangesLines(['auth-hardening/status/current.md'])
 * // ['Project has 1 change(s) left uncommitted by a previous session:',
 * //  '  auth-hardening/status/current.md',
 * //  'Commit them now (attributed to an unidentified session), or continue without ' +
 * //    'committing (the new session will be told what is pending)?']
 */
export function renderLeftoverChangesLines(changedFiles: readonly string[]): string[] {
  return [
    `Project has ${changedFiles.length} change(s) left uncommitted by a previous session:`,
    ...changedFiles.map((file) => `  ${file}`),
    'Commit them now (attributed to an unidentified session), or continue without committing ' +
      '(the new session will be told what is pending)?',
  ];
}

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
