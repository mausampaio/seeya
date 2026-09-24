/**
 * `seeya project create | list | show` (V2-T27, `docs/PLANO-DE-ENTREGA.md` § "Projetos — o
 * recorte"). Thin by design (AGENTS.md § "Registro e saída"): each function only calls
 * `application/workspace.ts`'s own orchestration and hands the result to `format-project.ts` —
 * the same split every other command module in this package already follows
 * (`autostart-command.ts`, `snooze-command.ts`).
 */
import { createInterface } from 'node:readline/promises';
import {
  createProject,
  listProjects,
  showProject,
} from '@seeya-ai/engine/application/workspace.js';
import { addRepository } from '@seeya-ai/engine/application/repository-association.js';
import { openProject } from '@seeya-ai/engine/application/project-open.js';
import type {
  ConfirmReadOnlyOpen,
  ProjectOpenDeps,
} from '@seeya-ai/engine/application/project-open.js';
import type { ProjectContext } from './composition.js';
import {
  formatAddRepoReport,
  formatCreateProjectReport,
  formatMissingRepositoryLines,
  formatOpenProjectReport,
  formatProjectLockWarningLines,
  formatProjectsReport,
  formatShowProjectReport,
  parseReadOnlyOpenConfirmation,
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

/** V2-T35 item 1: `openProject`'s own `ConfirmReadOnlyOpen` — asks over `node:readline/promises`
 * exactly like `start-day-command.ts#makeFallbackConfirmer` does, but never falls back to a
 * default answer when `io.isTTY` is false: it resolves `'unavailable'` and lets `openProject`
 * refuse ("sem entrada interativa, recusa dizendo o porquê"), the one confirmation in this project
 * that does not guess. */
function makeReadOnlyOpenConfirmer(io: ProjectOpenIo): ConfirmReadOnlyOpen {
  return async (heldBy) => {
    if (!io.isTTY) {
      return 'unavailable';
    }
    const rl = createInterface({ input: io.stdin, output: io.stdout });
    let answer: string;
    try {
      answer = await rl.question(`\n${renderReadOnlyOpenConfirmation(heldBy)}`);
    } finally {
      rl.close();
    }
    return parseReadOnlyOpenConfirmation(answer) ? 'proceed' : 'decline';
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
  const result = await openProject(deps, projectId, harness, {
    onBeforeLaunch: ({ missing, lock }) => {
      const lines = [
        ...formatMissingRepositoryLines(projectId, missing),
        ...formatProjectLockWarningLines(projectId, lock),
      ];
      for (const line of lines) {
        io.stdout.write(`${line}\n`);
      }
    },
    confirmReadOnlyOpen: makeReadOnlyOpenConfirmer(io),
  });
  io.stdout.write(`${formatOpenProjectReport(result)}\n`);
  // V2-T35 item 1: a deliberate decline is not a failure ("Nothing selected — nothing resumed"'s
  // own precedent in `start-day-command.ts`) — everything else non-`opened` is.
  return result.kind === 'opened' || result.kind === 'lockConfirmationDeclined' ? 0 : 1;
}
