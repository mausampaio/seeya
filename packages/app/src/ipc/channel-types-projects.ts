/**
 * Payload shapes of the projects panel, project open/create/adopt and confirmation channels (V2-T51: split out of `ipc/channels.ts`, which still re-exports every
 * one of them, so no importer changed). Pure types — no `electron` import.
 */
import type { ChangedFileStatsEntry } from '@seeya-ai/engine/core/ports.js';
import type { ProjectsPanelData } from '../state/projects-panel.js';

/** `CHANNELS.toggleFavoriteProject`'s payload (V2-T63). */
export interface ToggleFavoriteProjectRequest {
  readonly projectId: string;
  readonly favorite: boolean;
}

/** `CHANNELS.projectsUpdate`'s payload (V2-T30 item 1) — the exact shape
 * `state/projects-panel.ts#buildProjectsPanelData` produces. */
export type ProjectsUpdateEvent = ProjectsPanelData;

/** `CHANNELS.getProjectsPanel`'s response — same shape as `ProjectsUpdateEvent`, fetched instead
 * of pushed. */
export type ProjectsPanelResponse = ProjectsPanelData;

/** `CHANNELS.createProject`'s payload (V2-T30 item 4). `projectId` is the lowercase-hyphen
 * identifier `seeya project create <id>` takes — the window never asks for a separate display
 * name, same as the CLI. */
export interface CreateProjectRequest {
  readonly projectId: string;
}

/** `CHANNELS.createProject`'s response — the same three outcomes
 * `@seeya-ai/engine/application/workspace.js#CreateProjectResult` has, minus `root` (nothing in
 * the window shows a filesystem path back). */
export type CreateProjectResponse =
  | { readonly kind: 'created'; readonly projectId: string }
  | { readonly kind: 'invalidId'; readonly projectId: string }
  | { readonly kind: 'alreadyExists'; readonly projectId: string };

/** `CHANNELS.openProject`'s payload (V2-T30 item 3). */
export interface OpenProjectRequest {
  readonly projectId: string;
}

/** `CHANNELS.openProject`'s response — `state/project-open-result.ts
 * #formatProjectOpenOutcomeText`'s own short rendering of `OpenProjectResult`, resolved only once
 * the harness tab has closed (`resume/project-tab-launcher.ts#ProjectOpenTabLauncher`'s own
 * docstring on why that's still fine for the window). */
export interface OpenProjectResponse {
  readonly outcomeText: string;
}

/** `CHANNELS.resumeProjectSession`'s payload (V2-T77) — by `sessionId`; the handler resolves the
 * full session itself (window first, then the direct id lookup past `relevanceHours`, same as
 * `adoptSession`'s). */
export interface ResumeProjectSessionRequest {
  readonly projectId: string;
  readonly sessionId: string;
}

/** `CHANNELS.resumeProjectSession`'s response (V2-T77): `outcomeText` is `state/
 * project-open-result.ts#formatProjectOpenOutcomeText`'s own sentence — and unlike a plain
 * `openProject` click (which has no result area, Q-105), a resume ALWAYS shows it: a refusal
 * (`resumed: false` — session running, not in the project, locked and declined, ...) must never be
 * silent. `resumed: true` only when the harness tab actually opened and later closed. */
export interface ResumeProjectSessionResponse {
  readonly outcomeText: string;
  readonly resumed: boolean;
}

/** `CHANNELS.confirmProjectLockOpenRequest`'s payload (V2-T71,`docs/INTERFACE.md` § 9's own
 * "quem segura o lock e desde quando"): the raw facts `@seeya-ai/engine/core/project-lock.js
 * #ProjectLockInfo` carries, not a pre-rendered sentence — `renderer/features/confirmations/
 * ProjectLockConfirmDialog.tsx` composes the title/context-line split § 9 asks for itself, the
 * same "the window formats, the engine only supplies facts" split `state/
 * projects-panel.ts#formatSessionLastActivityText` already draws for a `Date`. `heldBySessionId`
 * is `null` exactly when `ProjectLockInfo.sessionId` is absent (D-025: an unidentified holder,
 * never a guessed one) — `Date` crosses this IPC boundary natively, the same as `TodayPanelData
 * .capturedAt`. Replaces the pre-V2-T71 `questionText` field (was `@seeya-ai/engine/core/
 * project-lock-message.js#renderReadOnlyOpenQuestion`'s own sentence — still used verbatim by the
 * CLI's own `readline` question, untouched by this task). */
export interface ConfirmProjectLockOpenRequestEvent {
  readonly requestId: string;
  readonly projectId: string;
  readonly heldBySessionId: string | null;
  readonly heldByPid: number;
  readonly heldByAcquiredAt: Date;
}

/** `CHANNELS.answerProjectLockOpenConfirm`'s payload. */
export interface AnswerProjectLockOpenConfirmRequest {
  readonly requestId: string;
  readonly decision: 'proceed' | 'decline';
}

/** The exact shape `@seeya-ai/engine/core/changed-file-status.js#ChangedFileEntry` has —
 * redeclared here rather than imported, same "ipc/channels.ts is pure, no engine-adjacent app
 * module imports it back" reasoning `FallbackConfirmRequestEvent`'s own docstring already gives. */
export type ChangedFileDisplayStatus = 'modified' | 'added' | 'deleted' | 'renamed' | 'other';

export interface ChangedFileRow {
  readonly path: string;
  readonly status: ChangedFileDisplayStatus;
}

/** `CHANNELS.confirmLeftoverChangesOpenRequest`'s payload (V2-T71, `docs/INTERFACE.md` § 9's own
 * "a lista de arquivos (M/A)"): `changedFiles` carries each file's own status now, read through
 * `@seeya-ai/engine/core/ports.js#WorkspaceRepository.listChangedFilesWithStatus` — replaces the
 * pre-V2-T71 `questionLines` field (was `@seeya-ai/engine/core/project-lock-message.js
 * #renderLeftoverChangesLines`'s own plain lines, still used verbatim by the CLI's own `readline`
 * question, untouched by this task). */
export interface ConfirmLeftoverChangesOpenRequestEvent {
  readonly requestId: string;
  readonly projectId: string;
  readonly changedFiles: readonly ChangedFileRow[];
}

/** `CHANNELS.answerLeftoverChangesOpenConfirm`'s payload — the same three answers
 * `ConfirmLeftoverChanges` itself returns (D-024, never flattened to a boolean). */
export interface AnswerLeftoverChangesOpenConfirmRequest {
  readonly requestId: string;
  readonly decision: 'commitNow' | 'proceedWithoutCommitting';
}

/** `CHANNELS.adoptSession`'s payload (V2-T30 item 5). `sessionId` is the ORIGINAL discovered
 * session's own id (never a name/`cwd` — same D-025 reasoning `core/adoption-registry.ts
 * #selectProjectAdoption`'s own docstring gives for `revert-adoption`'s session argument): the
 * window already has it from the sidebar row it built the "Adopt…" button from, so there's no
 * ambiguous reference to resolve the way the CLI's positional argument needs
 * `session-reference.ts` for. `projectId` may name a project that doesn't exist yet — `adoptSession`
 * creates it (`ensureProjectExists`), same as the CLI. */
export interface AdoptSessionRequest {
  readonly sessionId: string;
  readonly projectId: string;
}

/** `CHANNELS.adoptSession`'s response — `state/adopt-session-result.ts
 * #formatAdoptSessionOutcomeText`'s own short rendering, plus whether the "Open project" button
 * should show (`isAdoptedResult`'s own discriminant, computed once in `electron/project-ipc.ts`
 * rather than re-derived in the DOM layer, D-041). */
export interface AdoptSessionResponse {
  readonly outcomeText: string;
  readonly adopted: boolean;
  readonly projectId: string;
}

/** `CHANNELS.previewAdoptionLaunch`'s request — the same two facts
 * `renderAdoptionLaunchExplanationLines` needs beyond the workspace root it resolves itself
 * (`main/project-ipc.ts`): the session's own original `cwd` (known client-side, from the row the
 * "Adopt…" button was clicked from) and the project id the person has picked or typed so far. */
export interface PreviewAdoptionLaunchRequest {
  readonly originalCwd: string;
  readonly projectId: string;
}

/** One line of `CHANNELS.previewAdoptionLaunch`'s own explanation — `text` is what's shown ON
 * SCREEN (`main/project-ipc.ts` computes it against `~`-abbreviated paths, PO review round 2:
 * the raw absolute path, with the real machine's own username in it, was both a privacy leak and
 * what forced the dialog wider than every other one); `fullText` is the SAME line against the raw,
 * unabbreviated path — `@seeya-ai/engine/core/project-adoption-message.js
 * #renderAdoptionLaunchExplanationLines`'s own output unmodified, so the CLI's identical call
 * (`cli/format-project-adopt.ts#renderAdoptionLaunchConfirmation`) never changes. Equal to `text`
 * when abbreviation had nothing to shorten (same "only when it would actually differ" convention
 * `IgnoredProjectsSection.tsx`/`ResultPane.tsx#summarizeErrorReason` already use) — a caller never
 * needs a third comparison to decide whether a `title` tooltip would say anything new. */
export interface AdoptionExplanationLine {
  readonly text: string;
  readonly fullText: string;
}

/** `CHANNELS.previewAdoptionLaunch`'s response — computed against a `projectId` that may not
 * exist as a project yet (this is only a preview — nothing is created by this call). */
export interface PreviewAdoptionLaunchResponse {
  readonly explanationLines: readonly AdoptionExplanationLine[];
}

/** `CHANNELS.confirmAdoptionCommitRequest`'s payload — `changedFileEntries` is
 * `@seeya-ai/engine/core/ports.js#ChangedFileStatsEntry[]`, from `WorkspaceRepository
 * .listChangedFilesWithStats` (V2-T70) — a type (`added`/`modified`/`deleted`) and a line-count per
 * file, not the plain path lines this event used to carry. */
export interface ConfirmAdoptionCommitRequestEvent {
  readonly requestId: string;
  readonly projectId: string;
  readonly changedFileEntries: readonly ChangedFileStatsEntry[];
}

/** `CHANNELS.answerAdoptionCommitConfirm`'s payload. */
export interface AnswerAdoptionCommitConfirmRequest {
  readonly requestId: string;
  readonly decision: 'commit' | 'decline';
}
