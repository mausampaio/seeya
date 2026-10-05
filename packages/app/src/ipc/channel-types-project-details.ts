/**
 * Payload shapes of the Project details dialog channels (V2-T51: split out of `ipc/channels.ts`, which still re-exports every
 * one of them, so no importer changed). Pure types — no `electron` import.
 */
import type { ProjectDetailsData } from '../state/project-details.js';
import type { ProjectActionResponse } from '../state/project-details-result.js';

/** `CHANNELS.getProjectDetails`'s payload (V2-T83). */
export interface GetProjectDetailsRequest {
  readonly projectId: string;
}

export type GetProjectDetailsResponse = ProjectDetailsData;

/** `CHANNELS.addProjectRepository`'s payload — `path` is whatever `CHANNELS.pickDirectory`
 * returned, never typed by hand. */
export interface AddProjectRepositoryRequest {
  readonly projectId: string;
  readonly path: string;
}

export interface RemoveProjectRepositoryRequest {
  readonly projectId: string;
  readonly name: string;
}

/** `forkSessionId` identifies the adoption to revert — `selectProjectAdoption` matches it exactly
 * (a full id is a prefix of itself), so a project with several adoptions never needs a second
 * argument. */
export interface RevertProjectAdoptionRequest {
  readonly projectId: string;
  readonly forkSessionId: string;
}

export interface RemoveProjectRequest {
  readonly projectId: string;
}

/** `note` is `null` when the person left the optional field empty (`normalizeArchiveNote` trims
 * and drops a blank one on the main side as well). */
export interface ArchiveProjectRequest {
  readonly projectId: string;
  readonly note: string | null;
}

export interface UnarchiveProjectRequest {
  readonly projectId: string;
}

/** Every write action's response (V2-T83): the engine's own outcome, already rendered into the
 * CLI's own sentences (`state/project-details-result.ts`), with a `tone` the dialog colors it by. */
export type ProjectDetailsActionResponse = ProjectActionResponse;

export interface ConfirmRevertAdoptionRequestEvent {
  readonly requestId: string;
  readonly projectId: string;
  readonly originalSessionId: string;
  readonly forkSessionId: string;
  readonly commitCount: number;
}

export interface AnswerRevertAdoptionConfirmRequest {
  readonly requestId: string;
  readonly decision: 'proceed' | 'decline';
}

/** `question` is `core/project-management-message.ts#renderDeleteAdoptedCopyQuestionLine` — the
 * same first half of the sentence the CLI asks, rendered by the main process because it needs the
 * transcript's own last-write time and size, which only `ForkCleanup` knows. */
export interface ConfirmDeleteAdoptedCopyRequestEvent {
  readonly requestId: string;
  readonly projectId: string;
  readonly forkSessionId: string;
  readonly question: string;
}

export interface AnswerDeleteAdoptedCopyConfirmRequest {
  readonly requestId: string;
  readonly decision: 'delete' | 'keep';
}

export interface ConfirmRemoveProjectRequestEvent {
  readonly requestId: string;
  readonly projectId: string;
  readonly name: string;
  readonly fileCount: number;
}

export interface AnswerRemoveProjectConfirmRequest {
  readonly requestId: string;
  readonly decision: 'proceed' | 'decline';
}
