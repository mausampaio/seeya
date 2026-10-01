/**
 * Plain-text rendering for `seeya project audit` (D-028: CLI output is English). V2-T76: split out
 * of the former `format-project.ts` (Q-100/Q-101's own sibling for the CLI side).
 *
 * `formatEscapedCommitLine` is exported (not just used here) because `format-project-open.ts`'s own
 * `formatAuditLines` — `open`'s pre-launch warning — shares the exact same wording for the exact
 * same `CommitEscapeReason` union (V2-T34 item 3's own design: "the two never drift into two
 * different wordings for the same fact").
 */
import type { CommitEscapeReason } from '@seeya-ai/engine/core/project-audit.js';
import type {
  AuditProjectOutcome,
  ProjectAuditReport,
} from '@seeya-ai/engine/application/project-audit.js';
import { formatInvalidIdLine } from './format-project-shared.js';

export function describeCommitEscapeReason(reason: CommitEscapeReason): string {
  switch (reason.kind) {
    case 'missingOrWrongProjectTrailer':
      return reason.found === null
        ? 'missing Seeya-Project-Id trailer'
        : `wrong Seeya-Project-Id trailer ("${reason.found}")`;
    case 'missingSessionTrailer':
      return 'missing Seeya-Session-Id trailer';
    case 'touchesOtherProjects':
      return `also touches: ${reason.otherProjects.join(', ')}`;
    case 'includesLockFile':
      return 'includes the project lock file';
  }
}

export function formatEscapedCommitLine(commit: ProjectAuditReport['escaped'][number]): string {
  const reasons = commit.reasons.map(describeCommitEscapeReason).join('; ');
  return `  ${commit.hash.slice(0, 12)} — ${reasons}`;
}

/** `seeya project audit <id>` (V2-T34 item 3) — the standalone command's own report, sharing
 * `describeCommitEscapeReason`/`formatEscapedCommitLine` with the `open`-time warning in
 * `format-project-open.ts#formatAuditLines`. */
export function formatAuditCommandReport(outcome: AuditProjectOutcome): string {
  switch (outcome.kind) {
    case 'invalidId':
      return formatInvalidIdLine(outcome.projectId);
    case 'notFound':
      return `Project "${outcome.projectId}" not found.`;
    case 'audited': {
      const { report } = outcome;
      if (report.escaped.length === 0) {
        return (
          `Project "${report.projectId}": ${report.commitsChecked} commit(s) checked since the ` +
          'last audit, none escaped the commit-msg hook.'
        );
      }
      return [
        `Project "${report.projectId}": ${report.commitsChecked} commit(s) checked since the ` +
          `last audit, ${report.escaped.length} escaped the commit-msg hook:`,
        ...report.escaped.map(formatEscapedCommitLine),
      ].join('\n');
    }
  }
}
