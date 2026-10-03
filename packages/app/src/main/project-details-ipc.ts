/**
 * IPC wiring for the "Project details" dialog (V2-T83, `docs/INTERFACE.md` § 4a) — its own module,
 * same "`main.ts`/`project-ipc.ts` don't grow" split `directory-picker-ipc.ts` and
 * `session-search-ipc.ts` already follow. Every decision delegates to an engine function the CLI
 * also calls (`addRepository`, `removeRepository`, `revertAdoption`, `removeProject`) or to a pure
 * `state/` module — nothing here is a rule of its own (D-041). Excluded from the coverage floor
 * with the rest of `main/` (it cannot run without a display); each function it calls is tested on
 * its own.
 *
 * **The confirmations are callbacks, not renderer pre-checks.** `revertAdoption` only knows how
 * many commits it will revert, and whether the adopted copy kept writing, after it has taken the
 * project lock and planned — so the renderer's confirmation dialogs answer questions the engine
 * itself asks, through the same `PendingConfirmations` request/answer pair the "open" flow uses
 * (`project-ipc.ts`). The lock is therefore held while a confirmation is on screen, exactly as the
 * CLI holds it while it waits at a prompt.
 */
import { ipcMain, type BrowserWindow } from 'electron';
import { addRepository } from '@seeya-ai/engine/application/repository-association.js';
import { removeRepository } from '@seeya-ai/engine/application/project-remove-repo.js';
import { removeProject } from '@seeya-ai/engine/application/project-remove.js';
import { archiveProject, unarchiveProject } from '@seeya-ai/engine/application/project-archive.js';
import { revertAdoption } from '@seeya-ai/engine/application/project-revert-adoption.js';
import { renderDeleteAdoptedCopyQuestionLine } from '@seeya-ai/engine/core/project-management-message.js';
import { CHANNELS } from '../ipc/channels.js';
import type {
  AddProjectRepositoryRequest,
  ArchiveProjectRequest,
  UnarchiveProjectRequest,
  AnswerDeleteAdoptedCopyConfirmRequest,
  AnswerRemoveProjectConfirmRequest,
  AnswerRevertAdoptionConfirmRequest,
  ConfirmDeleteAdoptedCopyRequestEvent,
  ConfirmRemoveProjectRequestEvent,
  ConfirmRevertAdoptionRequestEvent,
  GetProjectDetailsRequest,
  GetProjectDetailsResponse,
  ProjectDetailsActionResponse,
  RemoveProjectRepositoryRequest,
  RemoveProjectRequest,
  RevertProjectAdoptionRequest,
} from '../ipc/channels.js';
import {
  buildAddRepositoryDeps,
  buildArchiveProjectDeps,
  buildRemoveProjectDeps,
  buildRemoveRepositoryDeps,
  buildRevertAdoptionDeps,
  type AppContext,
} from '../composition/index.js';
import { readProjectDetails } from '../composition/project-details-reader.js';
import { computeDisplaySessionIds } from '@seeya-ai/engine/application/session-id-display.js';
import { PendingConfirmations } from '../resume/pending-confirmations.js';
import {
  formatAddRepositoryActionResult,
  formatArchiveProjectActionResult,
  formatUnarchiveProjectActionResult,
  formatRemoveProjectActionResult,
  formatRemoveRepositoryActionResult,
  formatRevertAdoptionActionResult,
} from '../state/project-details-result.js';

function shortSessionId(sessionId: string): string {
  return computeDisplaySessionIds([sessionId]).get(sessionId) ?? sessionId;
}

export function wireProjectDetailsIpc(
  window: BrowserWindow,
  context: AppContext,
  pushProjectsUpdate: () => Promise<void>,
): void {
  const pendingRevert = new PendingConfirmations<'proceed' | 'decline'>('revert-adoption');
  const pendingDeleteCopy = new PendingConfirmations<'delete' | 'keep'>('delete-adopted-copy');
  const pendingRemove = new PendingConfirmations<'proceed' | 'decline'>('remove-project');

  ipcMain.handle(
    CHANNELS.getProjectDetails,
    (_event, request: GetProjectDetailsRequest): Promise<GetProjectDetailsResponse> =>
      readProjectDetails(context, request.projectId),
  );

  ipcMain.handle(
    CHANNELS.addProjectRepository,
    async (_event, request: AddProjectRepositoryRequest): Promise<ProjectDetailsActionResponse> => {
      const result = await addRepository(
        buildAddRepositoryDeps(context),
        request.projectId,
        request.path,
      );
      await pushProjectsUpdate();
      return formatAddRepositoryActionResult(result);
    },
  );

  ipcMain.handle(
    CHANNELS.removeProjectRepository,
    async (
      _event,
      request: RemoveProjectRepositoryRequest,
    ): Promise<ProjectDetailsActionResponse> => {
      const identity = await context.resolveProcessIdentity();
      const result = await removeRepository(
        buildRemoveRepositoryDeps(context, identity),
        request.projectId,
        request.name,
      );
      await pushProjectsUpdate();
      return formatRemoveRepositoryActionResult(result);
    },
  );

  ipcMain.handle(
    CHANNELS.revertProjectAdoption,
    async (
      _event,
      request: RevertProjectAdoptionRequest,
    ): Promise<ProjectDetailsActionResponse> => {
      const identity = await context.resolveProcessIdentity();
      const result = await revertAdoption(
        buildRevertAdoptionDeps(context, identity),
        request.projectId,
        request.forkSessionId,
        {
          confirmRevert: async (info) => {
            const { requestId, answer } = pendingRevert.create();
            const event: ConfirmRevertAdoptionRequestEvent = {
              requestId,
              projectId: info.projectId,
              originalSessionId: info.originalSessionId,
              forkSessionId: info.forkSessionId,
              commitCount: info.commitsNewestFirst.length,
            };
            window.webContents.send(CHANNELS.confirmRevertAdoptionRequest, event);
            return answer;
          },
          confirmDeleteCopy: async (info) => {
            const { requestId, answer } = pendingDeleteCopy.create();
            const event: ConfirmDeleteAdoptedCopyRequestEvent = {
              requestId,
              projectId: request.projectId,
              forkSessionId: info.forkSessionId,
              // Short id (the full one is the dialog's `title`) and the window's own locale
              // date and time, never ISO.
              question: renderDeleteAdoptedCopyQuestionLine({
                forkSessionIdText: shortSessionId(info.forkSessionId),
                adoptedAtText: info.adoptedAt.toLocaleString(),
                growth:
                  info.growth.kind === 'grew'
                    ? { kind: 'grew', lastWriteText: info.growth.lastWrite.toLocaleString() }
                    : { kind: 'unknown' },
              }),
            };
            window.webContents.send(CHANNELS.confirmDeleteAdoptedCopyRequest, event);
            return answer;
          },
        },
      );
      await pushProjectsUpdate();
      return formatRevertAdoptionActionResult(result);
    },
  );

  ipcMain.handle(
    CHANNELS.removeProject,
    async (_event, request: RemoveProjectRequest): Promise<ProjectDetailsActionResponse> => {
      const identity = await context.resolveProcessIdentity();
      const result = await removeProject(
        buildRemoveProjectDeps(context, identity),
        request.projectId,
        {
          confirmRemove: async (info) => {
            const { requestId, answer } = pendingRemove.create();
            const event: ConfirmRemoveProjectRequestEvent = {
              requestId,
              projectId: info.projectId,
              name: info.name,
              fileCount: info.fileCount,
            };
            window.webContents.send(CHANNELS.confirmRemoveProjectRequest, event);
            return answer;
          },
        },
      );
      await pushProjectsUpdate();
      return formatRemoveProjectActionResult(result);
    },
  );

  ipcMain.handle(
    CHANNELS.archiveProject,
    async (_event, request: ArchiveProjectRequest): Promise<ProjectDetailsActionResponse> => {
      const identity = await context.resolveProcessIdentity();
      const result = await archiveProject(
        buildArchiveProjectDeps(context, identity),
        request.projectId,
        request.note ?? undefined,
      );
      await pushProjectsUpdate();
      return formatArchiveProjectActionResult(result);
    },
  );

  ipcMain.handle(
    CHANNELS.unarchiveProject,
    async (_event, request: UnarchiveProjectRequest): Promise<ProjectDetailsActionResponse> => {
      const identity = await context.resolveProcessIdentity();
      const result = await unarchiveProject(
        buildArchiveProjectDeps(context, identity),
        request.projectId,
      );
      await pushProjectsUpdate();
      return formatUnarchiveProjectActionResult(result);
    },
  );

  ipcMain.on(
    CHANNELS.answerRevertAdoptionConfirm,
    (_event, answer: AnswerRevertAdoptionConfirmRequest) => {
      pendingRevert.resolve(answer.requestId, answer.decision);
    },
  );
  ipcMain.on(
    CHANNELS.answerDeleteAdoptedCopyConfirm,
    (_event, answer: AnswerDeleteAdoptedCopyConfirmRequest) => {
      pendingDeleteCopy.resolve(answer.requestId, answer.decision);
    },
  );
  ipcMain.on(
    CHANNELS.answerRemoveProjectConfirm,
    (_event, answer: AnswerRemoveProjectConfirmRequest) => {
      pendingRemove.resolve(answer.requestId, answer.decision);
    },
  );
}
