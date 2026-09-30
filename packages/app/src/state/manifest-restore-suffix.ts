/**
 * The one-sentence suffix the window appends whenever `WorkspaceRepository
 * .restoreProjectManifestIfChanged` actually restored `seeya.json` (V2-T73 item 2) — shared by
 * `state/adopt-session-result.ts` (the field already lives on `AdoptSessionResult`) and
 * `electron/project-ipc.ts`'s own `openProject` handler (which only learns the outcome through
 * `OpenProjectCallbacks.onBeforeLaunch`, never through the final result), so the two never drift
 * into two different wordings for the same fact.
 */
import type { ManifestRestoreOutcome } from '@seeya-ai/engine/core/ports.js';

/**
 * `''` for `unchanged`/`noCommittedVersion` — nothing was discarded, so nothing to say (D-025).
 * Never silent about a real restore, per the task's own "sem silêncio, com o que foi descartado
 * resumido" — `diffSummary` IS that summary.
 *
 * @example
 * formatManifestRestoreSuffix({ kind: 'restored', diffSummary: 'seeya.json | 2 +-' })
 * // ' seeya.json had uncommitted changes — restored to the last committed version: seeya.json | 2 +-'
 */
export function formatManifestRestoreSuffix(outcome: ManifestRestoreOutcome): string {
  if (outcome.kind !== 'restored') {
    return '';
  }
  const summary = outcome.diffSummary.replace(/\n/g, ' ');
  return ` seeya.json had uncommitted changes — restored to the last committed version: ${summary}`;
}
