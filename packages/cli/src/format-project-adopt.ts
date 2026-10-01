/**
 * Plain-text rendering for `seeya project adopt` (D-028: CLI output is English; AGENTS.md §
 * "Registro e saída" — user-facing text stays concentrated here, not scattered through
 * `application/project-adopt.ts`'s own orchestration).
 *
 * V2-T76: split out of the former `format-project.ts` (Q-100) — this file is what's left after
 * `create`/`list`/`show` moved to `format-project-lifecycle.ts`, `add-repo`/`open` to
 * `format-project-open.ts`, and `audit` to `format-project-audit.ts`; it inherited the original
 * file's name (the pure-move commit) because adoption was the single largest command's own report
 * by line count.
 */
import type { DiscoveredSession } from '@seeya-ai/engine/core/types.js';
import { formatLockHolderDescription } from '@seeya-ai/engine/core/project-lock-message.js';
import {
  renderAdoptionCommitChangedFilesLines,
  renderAdoptionLaunchExplanationLines,
} from '@seeya-ai/engine/core/project-adoption-message.js';
import type { AdoptSessionResult } from '@seeya-ai/engine/application/project-adopt.js';
import { formatManifestRestoreLines } from './format-manifest-restore.js';
import { formatInvalidIdLine } from './format-project-shared.js';

/** `seeya project adopt <session> <projectId>` (V2-T29) — `--session`-style resolution, same
 * message shape `end-day-command.ts#formatNoMatchMessage` already established for the identical
 * "your positional value didn't match anything discovered" case, minus the `--session` flag name
 * (this command's session argument is positional, never a flag). */
export function formatAdoptNoMatchMessage(session: string, discoveredCount: number): string {
  const discovered = `${discoveredCount} ${discoveredCount === 1 ? 'session was' : 'sessions were'}`;
  return (
    `No discovered session matches "${session}" (checked against sessionId, a sessionId prefix, ` +
    `the display name, and cwd). ${discovered} discovered in total — see "seeya sessions" to ` +
    'list them.'
  );
}

/** Same "never guess which one" rule `end-day-command.ts#formatAmbiguousMatchMessage` already
 * enforces for `--session` — adoption can create a project and take its lock, real consequences
 * exactly like `end-day --session`'s own D-002 termination, so an ambiguous match refuses here too. */
export function formatAdoptAmbiguousMatchMessage(
  session: string,
  matches: readonly DiscoveredSession[],
): string {
  const lines = [
    `"${session}" matches ${matches.length} discovered sessions — refusing to guess which one:`,
    ...matches.map((match) => `  - ${match.name} (${match.cwd}) — sessionId ${match.sessionId}`),
    'Retype the session argument with the full sessionId shown above to pick one.',
  ];
  return lines.join('\n');
}

/**
 * V2-T29 item 8 (added after the maintainer's second acceptance round, task-23 comment): the
 * explanation `adopt` shows and waits on BEFORE creating anything — same "explain, then pause for
 * an answer" shape `renderReadOnlyOpenConfirmation` already gives a locked `open`, now for a
 * problem the acceptance run itself found: the interactive harness takes over the terminal right
 * after this, so whatever it says has to be read before that happens, not printed and immediately
 * scrolled past. Says, in order: where the copy opens and why (its own directory's instructions
 * and memory — the reasoning the maintainer gave, 2026-09-24, for choosing that directory over the
 * project's own); where the project lives, since that's where it will write; and the follow-up for
 * AFTER adoption (`seeya project open`, where the project's own memory is what applies).
 */
export function renderAdoptionLaunchConfirmation(
  originalCwd: string,
  projectDir: string,
  projectId: string,
): string {
  const lines = [
    ...renderAdoptionLaunchExplanationLines(originalCwd, projectDir, projectId),
    'Continue? [Y/n] ',
  ];
  return lines.join('\n');
}

/** Blank (pressing Enter) means "continue" here — the opposite default of
 * `parseReadOnlyOpenConfirmation`'s blank-means-no: that question gates opening a project someone
 * else already holds, this one gates the very thing `seeya project adopt` was invoked to do, so
 * silence defaults to the action already requested. Only an explicit "n"/"no" declines. */
export function parseAdoptionLaunchConfirmation(raw: string): boolean {
  const normalized = raw.trim().toLowerCase();
  return normalized !== 'n' && normalized !== 'no';
}

/** V2-T29 item 4: the question `adopt` asks once the fork's interactive session has closed and
 * something inside the project actually changed — one line per changed file, same "show, then
 * ask" order the task's own spec requires ("a CLI mostra os arquivos que mudaram... e pergunta"). */
export function renderAdoptionCommitConfirmation(changedFiles: readonly string[]): string {
  const lines = [
    ...renderAdoptionCommitChangedFilesLines(changedFiles),
    'Commit these changes? [y/N] ',
  ];
  return lines.join('\n');
}

function formatAdoptSessionRunning(
  result: Extract<AdoptSessionResult, { readonly kind: 'sessionRunning' }>,
): string {
  return (
    `seeya: session "${result.name}" is running right now (${result.state}) — resuming it here ` +
    'would open a second copy. Wait for it to end, or capture and adopt it afterward.'
  );
}

function formatAdoptAlreadyAdopted(
  result: Extract<AdoptSessionResult, { readonly kind: 'alreadyAdopted' }>,
): string {
  return (
    `seeya: session ${result.sessionId} was already adopted into project "${result.projectId}" ` +
    `on ${result.adoptedAt.toISOString()} — refusing to adopt it a second time.`
  );
}

function formatAdoptedChangedFiles(changedFiles: readonly string[]): string {
  return changedFiles.map((file) => `  ${file}`).join('\n');
}

/** V2-T73 item 2: appended to every `AdoptSessionResult` case that reaches
 * `application/project-adopt-outcome.ts#finishAdoption` (the only ones carrying
 * `manifestRestore`) — `''` when nothing was restored, so the ordinary case reads exactly like
 * before this task. */
function appendManifestRestoreLines(
  text: string,
  manifestRestore: Extract<AdoptSessionResult, { readonly kind: 'noChanges' }>['manifestRestore'],
): string {
  const lines = formatManifestRestoreLines(manifestRestore);
  return lines.length === 0 ? text : `${text}\n${lines.join('\n')}`;
}

export function formatAdoptSessionReport(result: AdoptSessionResult): string {
  switch (result.kind) {
    case 'invalidId':
      return formatInvalidIdLine(result.projectId);
    case 'sessionRunning':
      return formatAdoptSessionRunning(result);
    case 'alreadyAdopted':
      return formatAdoptAlreadyAdopted(result);
    // Item 8: the person was asked, and either said no or had no way to answer — nothing was
    // created (no project, no lock, no fork registered), so neither case has anything else to
    // report.
    case 'launchConfirmationDeclined':
      return `Project "${result.projectId}": adoption cancelled — you chose not to continue.`;
    case 'launchConfirmationUnavailable':
      return (
        `seeya: refusing to adopt into project "${result.projectId}" without a way to ask for ` +
        'confirmation (no interactive terminal attached). Run this from a real terminal.'
      );
    case 'projectLocked':
      return (
        `seeya: project "${result.projectId}" is locked by ` +
        `${formatLockHolderDescription(result.heldBy)} — refusing to adopt into it while it's ` +
        'held by another live session.'
      );
    case 'failedToStart':
      return `seeya: could not start claude to adopt session into project "${result.projectId}".`;
    case 'noChanges':
      return appendManifestRestoreLines(
        `Project "${result.projectId}": the session (fork ${result.forkSessionId}) didn't write ` +
          'anything inside the project — nothing to commit, nothing kept.',
        result.manifestRestore,
      );
    case 'declined':
      return appendManifestRestoreLines(
        `Project "${result.projectId}": adoption declined — the fork (${result.forkSessionId}) ` +
          `was discarded and nothing was committed. It had written:\n` +
          formatAdoptedChangedFiles(result.changedFiles),
        result.manifestRestore,
      );
    case 'confirmationUnavailable':
      return appendManifestRestoreLines(
        `seeya: project "${result.projectId}" — the fork (${result.forkSessionId}) wrote changes, ` +
          'but there was no interactive terminal to confirm the commit. Nothing was committed or ' +
          'discarded; run "seeya project adopt" again from a real terminal to decide. It had ' +
          `written:\n${formatAdoptedChangedFiles(result.changedFiles)}`,
        result.manifestRestore,
      );
    // Item 9: repeats the same follow-up the launch confirmation already offered — the person saw
    // it once before the harness took the terminal; this is the reminder for when they're looking
    // at the terminal again, after the fact.
    //
    // V2-T72 item 1: three separate lists, never merged — `alreadyCommittedFiles` (what the copy
    // committed itself, while it held the project lock, D-047 item 4), `changedFiles` (what THIS
    // call committed, if anything was left pending and confirmed), and `pendingFiles` (what's
    // still uncommitted, with the reason when seeya's own attempt at it failed). The report has to
    // say what was already committed, not just what this call did — each list only prints when it
    // has something to say, so the ordinary case (nothing already committed, nothing left pending)
    // reads exactly like before this task.
    case 'adopted': {
      const sections = [
        `Project "${result.projectId}": adopted. The fork (${result.forkSessionId}) is now this ` +
          "project's own session.",
      ];
      if (result.alreadyCommittedFiles.length > 0) {
        sections.push(
          `The session had already committed this itself:\n` +
            formatAdoptedChangedFiles(result.alreadyCommittedFiles),
        );
      }
      if (result.changedFiles.length > 0) {
        sections.push(`Committed:\n${formatAdoptedChangedFiles(result.changedFiles)}`);
      }
      if (result.pendingFiles.length > 0) {
        const failureNote =
          result.pendingCommitFailedReason === undefined
            ? ''
            : ` (committing them failed: ${result.pendingCommitFailedReason})`;
        sections.push(
          `Still uncommitted${failureNote}:\n${formatAdoptedChangedFiles(result.pendingFiles)}`,
        );
      }
      sections.push(`Continue the work with: seeya project open ${result.projectId}`);
      return appendManifestRestoreLines(sections.join('\n'), result.manifestRestore);
    }
    // V2-T34 production defect (PO review, 2026-09-25): the commit itself failed (most often the
    // workspace's own git hook refusing it) — `result.reason` carries git's own stderr
    // (`adapters/workspace/commit.ts#commitAll`'s own fix, same PO review). Nothing was discarded:
    // the fork (`${result.forkSessionId}`) stays registered as pending and its written files stay
    // on disk, exactly like `confirmationUnavailable` above — a later "seeya project adopt" on the
    // same original session finds the fork exactly as it was left.
    case 'commitFailed':
      return appendManifestRestoreLines(
        `seeya: project "${result.projectId}" — the fork (${result.forkSessionId}) wrote changes, ` +
          `but committing them failed: ${result.reason}\nNothing was discarded — the fork is ` +
          `still registered, and it had written:\n${formatAdoptedChangedFiles(result.changedFiles)}`,
        result.manifestRestore,
      );
  }
}
