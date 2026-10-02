/**
 * Plain-text rendering for `seeya project add-repo|open` (D-028: CLI output is English; AGENTS.md
 * § "Registro e saída" — user-facing text stays concentrated here, not scattered through
 * `application/repository-association.ts`/`project-open.ts`'s own orchestration).
 *
 * V2-T76: split out of the former `format-project.ts` (Q-100) — this file covers the two commands
 * that acquire the project lock and (for `open`) spawn the harness, as opposed to the read-only
 * `format-project-lifecycle.ts` or the adoption-specific `format-project-adopt.ts`.
 */
import type { ProjectLockInfo } from '@seeya-ai/engine/core/project-lock.js';
import {
  formatLockHolderDescription,
  formatProjectLockWarningLines,
  renderLeftoverChangesLines,
  renderReadOnlyOpenQuestion,
} from '@seeya-ai/engine/core/project-lock-message.js';
import {
  formatPathNotFoundLine,
  formatProjectNotFoundLine,
  formatRepositoryAlreadyAssociatedLine,
  formatRepositoryLinkedLine,
} from '@seeya-ai/engine/core/project-management-message.js';
import type { AddRepositoryResult } from '@seeya-ai/engine/application/repository-association.js';
import type {
  MissingRepositoryRecord,
  OpenProjectResult,
} from '@seeya-ai/engine/application/project-open.js';
import type { ClaudeMdInstallOutcome } from '@seeya-ai/engine/application/claude-md-bridge.js';
import type { ProjectAuditReport } from '@seeya-ai/engine/application/project-audit.js';
import { formatSessionStateLabel } from '@seeya-ai/engine/core/session-state-label.js';
import { formatInvalidIdLine, formatLockStatusLine } from './format-project-shared.js';
import { formatEscapedCommitLine } from './format-project-audit.js';

export { formatProjectLockWarningLines };

/** `seeya project add-repo <id> <path>` (V2-T28). */
export function formatAddRepoReport(result: AddRepositoryResult): string {
  switch (result.kind) {
    case 'invalidId':
      return formatInvalidIdLine(result.projectId);
    case 'projectNotFound':
      return formatProjectNotFoundLine(result.projectId);
    case 'pathNotFound':
      return formatPathNotFoundLine(result.path);
    case 'alreadyAssociated':
      return formatRepositoryAlreadyAssociatedLine(result.name, result.projectId);
    case 'added':
      return formatRepositoryLinkedLine(result.name, result.projectId, result.hasRemote);
  }
}

/** One line per `MissingRepositoryRecord` (V2-T28 item 4) — `runProjectOpenCommand` prints these
 * BEFORE the harness spawns, so the warning is visible while the person can still act on it. */
function formatMissingRepositoryLine(projectId: string, missing: MissingRepositoryRecord): string {
  if (missing.reason === 'notInDeviceMap') {
    return (
      `Repository "${missing.name}" is not registered on this device — run "seeya project ` +
      `add-repo ${projectId} <path>" to add it. Continuing without it.`
    );
  }
  return (
    `Repository "${missing.name}" was registered at "${missing.path}", but that directory no ` +
    `longer exists — run "seeya project add-repo ${projectId} <new-path>" to update it. ` +
    'Continuing without it.'
  );
}

/** V2-T35 item 1: the question `open` asks, right after `formatProjectLockWarningLines`' own
 * warning, before it hands the terminal to the harness — reusing `formatLockHolderDescription` so
 * the answer names the same holder the warning just did. The holder description has no verb of its
 * own ("session <id> (pid <n>) since <time>"), so it goes after "locked by", never glued onto the
 * question — the first wording ("..., while session ...?") read as a sentence that stopped short. */
export function renderReadOnlyOpenConfirmation(heldBy: ProjectLockInfo): string {
  return `${renderReadOnlyOpenQuestion(heldBy)} [y/N] `;
}

/** Anything other than an explicit "y"/"yes" is a decline (D-025: never guess "yes" from a blank
 * or ambiguous answer) — unlike the richer pickers elsewhere in this package, there is no third
 * "invalid" state to report: a person who typed something else just as clearly meant no. */
export function parseReadOnlyOpenConfirmation(raw: string): boolean {
  const normalized = raw.trim().toLowerCase();
  return normalized === 'y' || normalized === 'yes';
}

/** V2-T77 (Q-069): `--append-system-prompt` never reaches a resumed session, so the working rules
 * and lock/leftover notes `open` normally delivers that way are NOT delivered on `--resume` — said
 * before the harness takes the screen, never silently dropped. */
export function formatResumeLimitLines(projectId: string): string[] {
  return [
    `seeya: resuming — the working rules and notes "seeya project open ${projectId}" normally ` +
      'passes to a NEW session (--append-system-prompt) do not reach a resumed one (measured, Q-069). ' +
      "The project's generated CLAUDE.md, which Claude Code reads again, still applies.",
  ];
}

export function formatMissingRepositoryLines(
  projectId: string,
  missing: readonly MissingRepositoryRecord[],
): string[] {
  return missing.map((entry) => formatMissingRepositoryLine(projectId, entry));
}

/** D-050/V2-T61: `open`'s own pre-launch `CLAUDE.md` note — `[]` when `open` just (re)generated it
 * (the ordinary case, nothing worth a line), one line when the project already has its own
 * versioned `CLAUDE.md` and `open` left it untouched (item 2: "avisa numa linha"). */
export function formatClaudeMdLines(projectId: string, claudeMd: ClaudeMdInstallOutcome): string[] {
  if (claudeMd.kind === 'written') {
    return [];
  }
  return [
    `seeya: project "${projectId}" already has its own CLAUDE.md (versioned) — leaving it as is, ` +
      'not generating one.',
  ];
}

/** V2-T34 item 3: `open`'s own pre-lock audit warning — `[]` when there's nothing to report
 * (nothing escaped, or the audit itself couldn't resolve — `application/project-open.ts`'s own
 * docstring on when that happens). */
export function formatAuditLines(audit: ProjectAuditReport | null): string[] {
  if (audit === null || audit.escaped.length === 0) {
    return [];
  }
  return [
    `seeya: audit found ${audit.escaped.length} commit(s) in "${audit.projectId}" that never went ` +
      'through the commit-msg hook:',
    ...audit.escaped.map(formatEscapedCommitLine),
  ];
}

/** V2-T34 item 4: the question `open` asks when it just acquired the lock and found changes a
 * previous session left uncommitted — same shape as `renderReadOnlyOpenConfirmation` above, but
 * three-way (D-024): anything other than an explicit "c" or "p" is read as "no way to act on this
 * safely," same as no terminal at all (`parseLeftoverChangesAnswer`'s own docstring).
 *
 * **The lines moved to `core/project-lock-message.ts#renderLeftoverChangesLines`** (PO review,
 * 2026-09-25 production defect) — this function now only joins them with `\n` and appends the
 * `readline`-specific prompt suffix onto the last one, same split `renderReadOnlyOpenConfirmation`
 * already has for the lock question. */
export function renderLeftoverChangesConfirmation(changedFiles: readonly string[]): string {
  const lines = renderLeftoverChangesLines(changedFiles);
  const lastLine = lines[lines.length - 1] ?? '';
  return [
    ...lines.slice(0, -1),
    `${lastLine} [c = commit now, p = proceed, anything else cancels] `,
  ].join('\n');
}

/** `null` for anything that isn't exactly "c"/"commit" or "p"/"proceed" — `null` is not itself one
 * of `LeftoverChangesAnswer`'s three cases; `cli/project-command.ts#makeLeftoverChangesConfirmer`
 * maps it to `'unavailable'` (D-025: an answer that doesn't parse is not an answer this project acts
 * on, the same discipline every other confirmation here already follows for a blank/garbled reply,
 * `parseReadOnlyOpenConfirmation`'s own "never guess yes"). */
export function parseLeftoverChangesAnswer(
  raw: string,
): 'commitNow' | 'proceedWithoutCommitting' | null {
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'c' || normalized === 'commit') {
    return 'commitNow';
  }
  if (normalized === 'p' || normalized === 'proceed') {
    return 'proceedWithoutCommitting';
  }
  return null;
}

/** `seeya project open <id> [--with <harness>]` (V2-T28). V2-T35 item 3: the `opened` case never repeats the `missing` list (that already streamed via
 * `formatMissingRepositoryLines` before the harness launched, same as before this task) — it DOES
 * repeat the lock warning, because that one is the whole bug this task fixes: "o claude abre por
 * cima, não tem como ver." Followed by the lock's state read fresh, after the harness closed
 * (`result.finalLockStatus`, never the pre-launch `result.lock` re-described as if still current),
 * then the ordinary exit-code line. */
function formatOpenedReport(
  result: Extract<OpenProjectResult, { readonly kind: 'opened' }>,
): string {
  const repeatedWarning = formatProjectLockWarningLines(result.projectId, result.lock);
  const closedLine = `Project "${result.projectId}" closed (${result.harness} exited with code ${result.exitCode}).`;
  return [...repeatedWarning, formatLockStatusLine(result.finalLockStatus), closedLine].join('\n');
}

export function formatOpenProjectReport(result: OpenProjectResult): string {
  switch (result.kind) {
    case 'invalidId':
      return formatInvalidIdLine(result.projectId);
    case 'notFound':
      return `Project "${result.projectId}" not found.`;
    case 'noHarnessChosen':
      return (
        `Project "${result.projectId}" has no default harness set — pass --with <harness> ` +
        '(e.g. --with claude) to choose one for this session.'
      );
    case 'unsupportedHarness':
      return `seeya: harness "${result.harness}" is not supported yet — only "claude" is, for now.`;
    case 'failedToStart':
      return `seeya: could not start ${result.harness} for project "${result.projectId}".`;
    // V2-T35 item 1: the person was asked, and either said no or had no way to answer — the
    // warning that preceded the question is still on screen (it was never covered by the
    // harness, which never launched), so neither case repeats it.
    case 'lockConfirmationDeclined':
      return (
        `Project "${result.projectId}" was not opened — you chose not to continue while it is ` +
        `locked by ${formatLockHolderDescription(result.heldBy)}.`
      );
    case 'lockConfirmationUnavailable':
      return (
        `seeya: project "${result.projectId}" is locked by ` +
        `${formatLockHolderDescription(result.heldBy)} — refusing to open without a way to ask ` +
        'for confirmation (no interactive terminal attached). Run this from a real terminal, or ' +
        'wait for the lock to be released.'
      );
    // V2-T34 item 4: this attempt acquired the lock, then found changes a previous session left
    // uncommitted — same "no way to ask, refuse rather than guess" shape as the case above.
    case 'leftoverChangesConfirmationUnavailable':
      return (
        `seeya: project "${result.projectId}" has ${result.changedFiles.length} change(s) left ` +
        'uncommitted by a previous session — refusing to open without a way to ask whether to ' +
        'commit them now or proceed without committing (no interactive terminal attached). Run ' +
        'this from a real terminal.\n' +
        result.changedFiles.map((file) => `  ${file}`).join('\n')
      );
    // V2-T77: `--resume` refusals, both decided before anything was touched.
    case 'sessionRunning':
      return (
        `seeya: session "${result.name}" (${result.sessionId}) is running right now ` +
        `(${formatSessionStateLabel(result.state)}) — resuming it would open a second copy. Close ` +
        'it first, then run this again.'
      );
    case 'sessionNotInProject':
      return (
        `seeya: session "${result.name}" (${result.sessionId}) has no evidence of belonging to ` +
        `project "${result.projectId}" — it did not run in the project's directory (it ran in ` +
        `"${result.cwd}"), it was not adopted into it, and it does not hold its lock. Refusing ` +
        'to resume it here; use "seeya project adopt" to bring it into a project.'
      );
    case 'opened':
      return formatOpenedReport(result);
  }
}
