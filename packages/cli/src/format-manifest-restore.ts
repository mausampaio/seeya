/**
 * Plain-text rendering for `WorkspaceRepository.restoreProjectManifestIfChanged`'s own outcome
 * (V2-T73 item 2) — shared by `seeya project open`'s pre-launch warning
 * (`project-command.ts#runProjectOpenCommand`) and `seeya project adopt`'s own report
 * (`format-project.ts#formatAdoptSessionReport`). Kept in its own module rather than added to
 * `format-project.ts`, which was already over AGENTS.md's own ~500-line ceiling before this task
 * (`docs/QUESTOES.md` Q-100) — one small file for this feature's text instead of growing that one
 * further.
 */
import type { ManifestRestoreOutcome } from '@seeya-ai/engine/core/ports.js';

/**
 * `[]` for `unchanged`/`noCommittedVersion` — nothing was discarded, so nothing to say (D-025's
 * own "least specific true statement": a workspace with no commits at all is unreachable for an
 * existing project, and reporting it here would only ever be noise). Never silent about a real
 * restore, per the task's own "sem silêncio, com o que foi descartado resumido" — `diffSummary` IS
 * that summary, one line per file `git diff --stat` reported.
 *
 * @example
 * formatManifestRestoreLines({ kind: 'restored', diffSummary: 'auth-hardening/seeya.json | 2 +-' })
 * // ['seeya: "seeya.json" had uncommitted changes — restored to the last committed version:',
 * //   '  auth-hardening/seeya.json | 2 +-']
 */
export function formatManifestRestoreLines(outcome: ManifestRestoreOutcome): string[] {
  if (outcome.kind !== 'restored') {
    return [];
  }
  return [
    'seeya: "seeya.json" had uncommitted changes — restored to the last committed version. ' +
      'Discarded:',
    ...outcome.diffSummary
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => `  ${line}`),
  ];
}
