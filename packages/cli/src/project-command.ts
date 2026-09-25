/**
 * `seeya project create | list | show` (V2-T27, `docs/PLANO-DE-ENTREGA.md` § "Projetos — o
 * recorte"). Thin by design (AGENTS.md § "Registro e saída"): each function only calls
 * `application/workspace.ts`'s own orchestration and hands the result to `format-project.ts` —
 * the same split every other command module in this package already follows
 * (`autostart-command.ts`, `snooze-command.ts`).
 */
import { createInterface } from 'node:readline/promises';
import type { SessionProvider } from '@seeya-ai/engine/core/ports.js';
import {
  createProject,
  listProjects,
  showProject,
} from '@seeya-ai/engine/application/workspace.js';
import { addRepository } from '@seeya-ai/engine/application/repository-association.js';
import { openProject } from '@seeya-ai/engine/application/project-open.js';
import type {
  ConfirmLeftoverChanges,
  ConfirmReadOnlyOpen,
  ProjectOpenDeps,
} from '@seeya-ai/engine/application/project-open.js';
import { adoptSession } from '@seeya-ai/engine/application/project-adopt.js';
import type {
  AdoptSessionDeps,
  ConfirmAdoptionCommit,
  ConfirmAdoptionLaunch,
} from '@seeya-ai/engine/application/project-adopt.js';
import { auditProject } from '@seeya-ai/engine/application/project-audit.js';
import type { ProjectAuditDeps } from '@seeya-ai/engine/application/project-audit.js';
import { verifyCommit } from '@seeya-ai/engine/application/verify-commit.js';
import type { VerifyCommitDeps } from '@seeya-ai/engine/application/verify-commit.js';
import { decideBashCommandGuard } from '@seeya-ai/engine/core/harness-hook-config.js';
import { parseBashCommandFromHookPayload } from '@seeya-ai/engine/adapters/harness/bash-command-hook-payload-schema.js';
import type { SessionIdLookup } from '@seeya-ai/engine/core/ports.js';
import { resolveSessionReferenceForAdoption } from './session-reference.js';
import type { ProjectContext } from './composition.js';
import {
  formatAddRepoReport,
  formatAdoptAmbiguousMatchMessage,
  formatAdoptNoMatchMessage,
  formatAdoptSessionReport,
  formatAuditCommandReport,
  formatAuditLines,
  formatCreateProjectReport,
  formatMissingRepositoryLines,
  formatOpenProjectReport,
  formatProjectLockWarningLines,
  formatProjectsReport,
  formatShowProjectReport,
  parseAdoptionLaunchConfirmation,
  parseLeftoverChangesAnswer,
  parseReadOnlyOpenConfirmation,
  renderAdoptionCommitConfirmation,
  renderAdoptionLaunchConfirmation,
  renderLeftoverChangesConfirmation,
  renderReadOnlyOpenConfirmation,
} from './format-project.js';

export async function runProjectCreateCommand(
  context: ProjectContext,
  projectId: string,
): Promise<string> {
  const result = await createProject(context, projectId);
  return formatCreateProjectReport(result);
}

export async function runProjectListCommand(context: ProjectContext): Promise<string> {
  const result = await listProjects(context);
  return formatProjectsReport(result);
}

export async function runProjectShowCommand(
  context: ProjectContext,
  projectId: string,
): Promise<string> {
  const result = await showProject(context, projectId);
  return formatShowProjectReport(result);
}

export async function runProjectAddRepoCommand(
  context: ProjectContext,
  projectId: string,
  localPath: string,
): Promise<string> {
  const result = await addRepository(context, projectId, localPath);
  return formatAddRepoReport(result);
}

/** Where `runProjectOpenCommand` writes the missing-repository/lock warnings and, when the
 * project is locked, reads the confirmation answer — always the real `process.std{in,out}` in
 * production (`index.ts`), a `node:stream` `PassThrough`/fake `isTTY` in tests, same injection
 * `start-day-command.ts#StartDayIo` already uses for the identical reason: the harness itself
 * takes over stdio right after, so these lines have to be written for real, not returned as part
 * of a string this function's caller only prints once everything else is done. */
export interface ProjectOpenIo {
  readonly stdin: NodeJS.ReadableStream;
  readonly stdout: NodeJS.WritableStream;
  readonly isTTY: boolean;
}

/** A `readline.Interface` reader, or `null` when there's no TTY to ask through at all — the same
 * shape `askQuestion` below reads from. Exported for `project-undo-command.ts`'s own confirmations
 * (`remove`/`revert-adoption`), which share this exact "one reader per invocation" discipline. */
export type ConfirmationReader = ReturnType<typeof createInterface> | null;

/**
 * Opens ONE `readline` interface for a WHOLE command invocation, never one per question — a
 * command that can ask more than one question in sequence (`runProjectAdoptCommand`: the launch
 * confirmation, then, only if it proceeds, the commit confirmation) needs the SAME interface
 * throughout. Measured: closing an interface after one question and opening a second one on the
 * same stream loses whatever was already buffered past the first line — the second `question()`
 * then hangs forever waiting for input that already arrived and was discarded. `null` when
 * `io.isTTY` is false, so every confirmation reads the same "no way to ask" signal from one place
 * (AGENTS.md: "nada de duplicação") instead of each checking `io.isTTY` on its own.
 */
export function openConfirmationReader(io: ProjectOpenIo): ConfirmationReader {
  return io.isTTY ? createInterface({ input: io.stdin, output: io.stdout }) : null;
}

/** Asks one question through the SHARED reader `openConfirmationReader` opened — `null` (no TTY)
 * always resolves `null` here too, never a guessed answer (D-025); the caller decides what `null`
 * means for its own question. */
export async function askQuestion(
  reader: ConfirmationReader,
  prompt: string,
): Promise<string | null> {
  if (reader === null) {
    return null;
  }
  return reader.question(`\n${prompt}`);
}

/** V2-T35 item 1: `openProject`'s own `ConfirmReadOnlyOpen` — never falls back to a default answer
 * when there's no way to ask: `askQuestion` returning `null` becomes `'unavailable'`, and
 * `openProject` refuses ("sem entrada interativa, recusa dizendo o porquê"). */
function makeReadOnlyOpenConfirmer(reader: ConfirmationReader): ConfirmReadOnlyOpen {
  return async (heldBy) => {
    const answer = await askQuestion(reader, renderReadOnlyOpenConfirmation(heldBy));
    if (answer === null) {
      return 'unavailable';
    }
    return parseReadOnlyOpenConfirmation(answer) ? 'proceed' : 'decline';
  };
}

/** V2-T34 item 4: `openProject`'s own `ConfirmLeftoverChanges` — a bad/blank answer folds into
 * `'unavailable'` exactly like no terminal at all, the same "never guess" discipline
 * `parseLeftoverChangesAnswer`'s own docstring gives for why `null` isn't a fourth case of its own
 * here. */
function makeLeftoverChangesConfirmer(reader: ConfirmationReader): ConfirmLeftoverChanges {
  return async (changedFiles) => {
    const answer = await askQuestion(reader, renderLeftoverChangesConfirmation(changedFiles));
    if (answer === null) {
      return 'unavailable';
    }
    return parseLeftoverChangesAnswer(answer) ?? 'unavailable';
  };
}

/**
 * `seeya project open <id> [--with <harness>]` — unlike the other four commands, `open` spawns a
 * real interactive session (`stdio: 'inherit'`, `core/ports.ts#HarnessLauncher`'s own docstring).
 * Any "repository X is missing"/lock warning is written to `io.stdout` BEFORE the harness launches
 * (V2-T28 item 4: the person needs to see it while they can still act, not after `claude` has
 * already exited) — `openProject`'s own `onBeforeLaunch` callback is what makes that possible
 * without this function polling the result for it after the fact. Returns an exit code, same
 * convention `start-day-command.ts#runStartDayCommand` already uses for a command that writes
 * progressively instead of returning one final string.
 *
 * **Takes `ProjectOpenDeps` directly, not `ProjectContext` like the other four commands** —
 * `deps.pid`/`deps.procStart` need a real, per-invocation capture (`composition.ts
 * #buildProjectOpenDeps`, S4-T3b's own `powershell.exe` cost on Windows), which only `index.ts`'s
 * own `.action()` for `open` should ever pay for; the four commands above never need it at all.
 * Keeping that capture OUT of this function is what lets this command's own tests inject a fully
 * fake `ProjectOpenDeps` with no real process I/O, same as every other command in this file.
 */
export async function runProjectOpenCommand(
  deps: ProjectOpenDeps,
  projectId: string,
  harness: string | undefined,
  io: ProjectOpenIo,
): Promise<number> {
  const reader = openConfirmationReader(io);
  let result;
  try {
    result = await openProject(deps, projectId, harness, {
      onBeforeLaunch: ({ missing, lock, audit }) => {
        const lines = [
          ...formatAuditLines(audit),
          ...formatMissingRepositoryLines(projectId, missing),
          ...formatProjectLockWarningLines(projectId, lock),
        ];
        for (const line of lines) {
          io.stdout.write(`${line}\n`);
        }
      },
      confirmReadOnlyOpen: makeReadOnlyOpenConfirmer(reader),
      confirmLeftoverChanges: makeLeftoverChangesConfirmer(reader),
    });
  } finally {
    reader?.close();
  }
  io.stdout.write(`${formatOpenProjectReport(result)}\n`);
  // V2-T35 item 1: a deliberate decline is not a failure ("Nothing selected — nothing resumed"'s
  // own precedent in `start-day-command.ts`) — everything else non-`opened` is.
  return result.kind === 'opened' || result.kind === 'lockConfirmationDeclined' ? 0 : 1;
}

/** V2-T29 item 4: `adoptSession`'s own `ConfirmAdoptionCommit` — same "no TTY, no silent guess"
 * contract `makeReadOnlyOpenConfirmer` above already established, reusing its y/N parsing
 * (`parseReadOnlyOpenConfirmation`): the convention ("anything other than y/yes is a decline") is
 * generic, not specific to the read-only-open question it was first written for. */
function makeAdoptionCommitConfirmer(reader: ConfirmationReader): ConfirmAdoptionCommit {
  return async (changedFiles) => {
    const answer = await askQuestion(reader, renderAdoptionCommitConfirmation(changedFiles));
    if (answer === null) {
      return 'unavailable';
    }
    return parseReadOnlyOpenConfirmation(answer) ? 'commit' : 'decline';
  };
}

/** V2-T29 item 8: `adoptSession`'s own `ConfirmAdoptionLaunch` — asked BEFORE anything is created,
 * with its own y/N default (`parseAdoptionLaunchConfirmation`'s own docstring on why blank means
 * "continue" here, unlike every other confirmation in this file). Shares the SAME `reader` the
 * (possible) later `makeAdoptionCommitConfirmer` question uses — `openConfirmationReader`'s own
 * docstring on why one command invocation never opens more than one. */
function makeAdoptionLaunchConfirmer(reader: ConfirmationReader): ConfirmAdoptionLaunch {
  return async ({ originalCwd, projectDir, projectId }) => {
    const answer = await askQuestion(
      reader,
      renderAdoptionLaunchConfirmation(originalCwd, projectDir, projectId),
    );
    if (answer === null) {
      return 'unavailable';
    }
    return parseAdoptionLaunchConfirmation(answer) ? 'proceed' : 'decline';
  };
}

/**
 * `seeya project adopt <session> <projectId>` (V2-T29) — resolves `session` against real
 * discovery first (`resolveSessionReferenceForAdoption`, the same ambiguity-refusing match
 * `--session` uses on `end-day`/`start-day`, extended by V2-T55 item 1: an id/prefix that matches
 * nothing in the current `relevanceHours` window falls through to a direct, unwindowed transcript
 * search via `sessionIdLookup`), then hands the resolved `DiscoveredSession` to `adoptSession`.
 * Takes `SessionProvider`/`SessionIdLookup`/`AdoptSessionDeps` directly rather than a single
 * `ProjectContext`-shaped bag, same reasoning `runProjectOpenCommand` above already gives for its
 * own `ProjectOpenDeps`: the per-invocation pieces (`forkSessionId`, `pid`, `procStart`) are
 * composition-root concerns (`composition.ts#buildProjectAdoptDeps`), not this function's.
 */
export async function runProjectAdoptCommand(
  sessionProvider: SessionProvider,
  sessionIdLookup: SessionIdLookup,
  deps: AdoptSessionDeps,
  sessionRef: string,
  projectId: string,
  io: ProjectOpenIo,
): Promise<number> {
  const discovery = await sessionProvider.list();
  const match = await resolveSessionReferenceForAdoption(
    discovery.sessions,
    sessionIdLookup,
    sessionRef,
  );
  if (match.kind === 'notFound') {
    io.stdout.write(`${formatAdoptNoMatchMessage(sessionRef, discovery.sessions.length)}\n`);
    return 1;
  }
  if (match.kind === 'ambiguous') {
    io.stdout.write(`${formatAdoptAmbiguousMatchMessage(sessionRef, match.matches)}\n`);
    return 1;
  }

  const reader = openConfirmationReader(io);
  let result;
  try {
    result = await adoptSession(deps, match.item, projectId, {
      confirmLaunch: makeAdoptionLaunchConfirmer(reader),
      confirmCommit: makeAdoptionCommitConfirmer(reader),
    });
  } finally {
    reader?.close();
  }
  io.stdout.write(`${formatAdoptSessionReport(result)}\n`);
  // Same "deliberate outcome vs. refusal" split `runProjectOpenCommand` already draws for
  // `lockConfirmationDeclined`: a person explicitly saying no (here, `launchConfirmationDeclined`,
  // item 8) is a decision that completed cleanly, not a failure — everything else IS a refusal.
  return result.kind === 'adopted' ||
    result.kind === 'declined' ||
    result.kind === 'noChanges' ||
    result.kind === 'launchConfirmationDeclined'
    ? 0
    : 1;
}

/** `seeya project audit <id>` (V2-T34 item 3) — the standalone command; `openProject` already runs
 * the same check on every `open`, before ever taking the lock (that call site prints through
 * `formatAuditLines` instead, `runProjectOpenCommand`'s own `onBeforeLaunch`). */
export async function runProjectAuditCommand(
  deps: ProjectAuditDeps,
  projectId: string,
): Promise<string> {
  const outcome = await auditProject(deps, projectId);
  return formatAuditCommandReport(outcome);
}

/**
 * `seeya project verify-commit <messageFile>` (V2-T34 item 1) — the workspace's own `commit-msg`
 * git hook's one caller (`core/workspace-hooks.ts#buildCommitMsgHookScript`), never meant to be run
 * by hand. Silent on success (the standard git hook convention — nothing on stdout, exit 0);
 * writes the refusal reason to `stderr` and exits non-zero otherwise, which git shows verbatim and
 * aborts the commit for.
 */
export async function runProjectVerifyCommitCommand(
  deps: VerifyCommitDeps,
  root: string,
  messageFilePath: string,
  stderr: NodeJS.WritableStream,
): Promise<number> {
  const result = await verifyCommit(deps, root, messageFilePath);
  if (result.kind === 'refused') {
    stderr.write(`${result.reason}\n`);
    return 1;
  }
  return 0;
}

/** Reads `stream` to completion as UTF-8 text — `runProjectVerifyBashCommandCommand`'s own way of
 * collecting the `PreToolUse` payload Claude Code pipes to it on stdin (never a file path or an
 * argument, D-015: a hook payload is exactly the "variable-size context" that rule is about). */
function readWholeStream(stream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    let raw = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk: string) => {
      raw += chunk;
    });
    stream.on('end', () => resolve(raw));
    stream.on('error', (error: Error) => reject(error));
  });
}

/**
 * `seeya project verify-bash-command` (V2-T34 item 2, PO review) — the Claude Code project hook's
 * one caller (`core/harness-hook-config.ts#buildHarnessSettingsJson`), never meant to be run by
 * hand. Reads the `PreToolUse` payload from stdin (the same channel Claude Code itself uses to
 * hand it over), decides with `core/harness-hook-config.ts#decideBashCommandGuard`, and — only on a
 * block — writes the `permissionDecision: "deny"` JSON the docs describe to stdout and exits `2`
 * (the one exit code that blocks the tool call, `https://code.claude.com/docs/en/hooks.md`).
 * Anything else (unparseable payload, a call with no `tool_input.command`, an allowed command)
 * exits `0` silently — this hook never has an opinion beyond the two things it's here to refuse.
 */
export async function runProjectVerifyBashCommandCommand(
  stdin: NodeJS.ReadableStream,
  stdout: NodeJS.WritableStream,
): Promise<number> {
  const raw = await readWholeStream(stdin);
  const command = parseBashCommandFromHookPayload(raw);
  if (command === null) {
    return 0;
  }
  const decision = decideBashCommandGuard(command);
  if (decision.kind === 'allow') {
    return 0;
  }
  stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: decision.reason,
      },
    }),
  );
  return 2;
}
