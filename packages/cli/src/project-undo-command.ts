/**
 * `seeya project remove | remove-repo | revert-adoption` (V2-T32) — the "desfazer" side of
 * `project`, split from `project-command.ts` (AGENTS.md § "Arquivo: abaixo de 500 linhas") the same
 * way `format-project-undo.ts` is split from `format-project.ts`. Reuses `project-command.ts`'s own
 * `openConfirmationReader`/`askQuestion`/`ProjectOpenIo` — one `readline.Interface` per invocation,
 * never one per question (that module's own docstring on why).
 */
import { removeProject } from '@seeya-ai/engine/application/project-remove.js';
import type {
  ConfirmRemoveProject,
  RemoveProjectDeps,
} from '@seeya-ai/engine/application/project-remove.js';
import { removeRepository } from '@seeya-ai/engine/application/project-remove-repo.js';
import type { RemoveRepositoryDeps } from '@seeya-ai/engine/application/project-remove-repo.js';
import { revertAdoption } from '@seeya-ai/engine/application/project-revert-adoption.js';
import type {
  ConfirmDeleteAdoptedCopy,
  ConfirmRevertAdoption,
  RevertAdoptionDeps,
} from '@seeya-ai/engine/application/project-revert-adoption.js';
import { askQuestion, openConfirmationReader, type ProjectOpenIo } from './project-command.js';
import {
  formatRemoveProjectReport,
  formatRemoveRepositoryReport,
  formatRevertAdoptionReport,
  parseUndoConfirmation,
  renderDeleteAdoptedCopyConfirmation,
  renderRemoveProjectConfirmation,
  renderRevertAdoptionConfirmation,
} from './format-project-undo.js';

function makeRemoveConfirmer(
  reader: ReturnType<typeof openConfirmationReader>,
): ConfirmRemoveProject {
  return async ({ name, fileCount }) => {
    const answer = await askQuestion(reader, renderRemoveProjectConfirmation(name, fileCount));
    if (answer === null) {
      return 'unavailable';
    }
    return parseUndoConfirmation(answer) ? 'proceed' : 'decline';
  };
}

/** `seeya project remove <id>` — item 1. Only ever asks one question, but still opened/closed
 * through the same `openConfirmationReader` every other `project` confirmation uses (AGENTS.md:
 * "nada de duplicação"). */
export async function runProjectRemoveCommand(
  deps: RemoveProjectDeps,
  projectId: string,
  io: ProjectOpenIo,
): Promise<number> {
  const reader = openConfirmationReader(io);
  let result;
  try {
    result = await removeProject(deps, projectId, { confirmRemove: makeRemoveConfirmer(reader) });
  } finally {
    reader?.close();
  }
  io.stdout.write(`${formatRemoveProjectReport(result)}\n`);
  return result.kind === 'removed' || result.kind === 'confirmationDeclined' ? 0 : 1;
}

/** `seeya project remove-repo <id> <name>` — item 2. No confirmation (same precedent `add-repo`
 * already sets: reversible via the workspace's own git history, like every `project` write). */
export async function runProjectRemoveRepoCommand(
  deps: RemoveRepositoryDeps,
  projectId: string,
  name: string,
): Promise<string> {
  const result = await removeRepository(deps, projectId, name);
  return formatRemoveRepositoryReport(result);
}

function makeRevertConfirmer(
  reader: ReturnType<typeof openConfirmationReader>,
): ConfirmRevertAdoption {
  return async ({ originalSessionId, forkSessionId, commitsNewestFirst }) => {
    const answer = await askQuestion(
      reader,
      renderRevertAdoptionConfirmation(originalSessionId, forkSessionId, commitsNewestFirst),
    );
    if (answer === null) {
      return 'unavailable';
    }
    return parseUndoConfirmation(answer) ? 'proceed' : 'decline';
  };
}

/** Item 6: blank/anything other than an explicit "y"/"yes" keeps the copy — "resposta padrão é
 * manter" applied on top of the SAME y/N parsing every other confirmation in this package uses. */
function makeDeleteCopyConfirmer(
  reader: ReturnType<typeof openConfirmationReader>,
): ConfirmDeleteAdoptedCopy {
  return async (info) => {
    const answer = await askQuestion(reader, renderDeleteAdoptedCopyConfirmation(info));
    if (answer === null) {
      return 'unavailable';
    }
    return parseUndoConfirmation(answer) ? 'delete' : 'keep';
  };
}

/**
 * `seeya project revert-adoption <id> [<session>]` — items 3/5/6/8. Up to two questions in
 * sequence (the revert itself, then — only when reached — whether to delete the adopted copy), so
 * this shares ONE reader for the whole invocation, same discipline `runProjectAdoptCommand`
 * (`project-command.ts`) already established for its own two questions.
 */
export async function runProjectRevertAdoptionCommand(
  deps: RevertAdoptionDeps,
  projectId: string,
  sessionRef: string | undefined,
  io: ProjectOpenIo,
): Promise<number> {
  const reader = openConfirmationReader(io);
  let result;
  try {
    result = await revertAdoption(deps, projectId, sessionRef, {
      confirmRevert: makeRevertConfirmer(reader),
      confirmDeleteCopy: makeDeleteCopyConfirmer(reader),
    });
  } finally {
    reader?.close();
  }
  io.stdout.write(`${formatRevertAdoptionReport(result)}\n`);
  return result.kind === 'reverted' || result.kind === 'confirmationDeclined' ? 0 : 1;
}
