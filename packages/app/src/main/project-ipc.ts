/**
 * IPC wiring for the "Projects" section (V2-T30) — kept OUT of `electron/main.ts` so that already
 * thousand-line file doesn't grow (the task's own "renderer.ts e main.ts não crescem"). Same
 * "electron/ has no logic of its own, D-041" discipline as `main.ts` itself: every decision here
 * delegates to `application/workspace.ts#createProject/listProjects`,
 * `application/project-open.ts#openProject`, `application/project-adopt.ts#adoptSession`, or a
 * pure `state/`/`sidebar/` module. Excluded from this package's coverage floor along with the rest
 * of `electron/` (it cannot run without a display) — every one of those functions it calls is
 * unit/integration-tested on its own.
 *
 * **`openProject`/`adoptSession` are never awaited by the IPC handler's own return** (Q-087 item
 * 3's own "o `open` deixa de bloquear"): both block for as long as their harness tab stays open,
 * so `ipcMain.handle`'s promise for `CHANNELS.openProject`/`CHANNELS.adoptSession` can legitimately
 * take hours to settle — that's fine, because nothing in the renderer blocks waiting for it either
 * (`renderer/features/projects/useProjects.ts`/`adopt-flow-view.ts`'s own click handlers fire-and-forget them). What makes a tab
 * appear immediately is the reused `CHANNELS.resumeTabOpened` push
 * (`resume/project-tab-launcher.ts`'s own `TabResumeOpener`, the SAME mechanism V2-T4's resume flow
 * already uses) — mounting a tab UI for an already-spawned pty has never been resume-specific.
 */
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ipcMain, type BrowserWindow } from 'electron';
import {
  resolveWorkspaceRoot,
  createProject,
  listProjects,
} from '@seeya-ai/engine/application/workspace.js';
import {
  describeProjectLockStatus,
  type ProjectLockStatus,
} from '@seeya-ai/engine/application/project-lock.js';
import { openProject, SUPPORTED_HARNESS } from '@seeya-ai/engine/application/project-open.js';
import { adoptSession } from '@seeya-ai/engine/application/project-adopt.js';
import type { RejectedDiscoveryRecord } from '@seeya-ai/engine/core/ports.js';
import {
  renderLeftoverChangesLines,
  renderReadOnlyOpenQuestion,
} from '@seeya-ai/engine/core/project-lock-message.js';
import {
  renderAdoptionCommitChangedFilesLines,
  renderAdoptionLaunchExplanationLines,
} from '@seeya-ai/engine/core/project-adoption-message.js';
import { CHANNELS } from '../ipc/channels.js';
import type {
  AdoptSessionRequest,
  AdoptSessionResponse,
  AnswerAdoptionCommitConfirmRequest,
  AnswerAdoptionLaunchConfirmRequest,
  AnswerLeftoverChangesOpenConfirmRequest,
  AnswerProjectLockOpenConfirmRequest,
  ConfirmAdoptionCommitRequestEvent,
  ConfirmAdoptionLaunchRequestEvent,
  ConfirmLeftoverChangesOpenRequestEvent,
  ConfirmProjectLockOpenRequestEvent,
  CreateProjectRequest,
  CreateProjectResponse,
  OpenProjectRequest,
  OpenProjectResponse,
  ToggleFavoriteProjectRequest,
} from '../ipc/channels.js';
import { toggleFavoriteProjectId } from '@seeya-ai/engine/core/favorite-projects.js';
import {
  buildProjectAdoptDeps,
  buildProjectOpenDeps,
  buildProjectWorkspaceDeps,
  type AppContext,
} from '../composition/index.js';
import { ProjectAdoptTabLauncher, ProjectOpenTabLauncher } from '../resume/project-tab-launcher.js';
import type { TabResumeOpener } from '../resume/tab-session-resumer.js';
import { PendingConfirmations } from '../resume/pending-confirmations.js';
import {
  buildProjectsPanelData,
  type ProjectsPanelData,
  type ProjectWithDirectory,
} from '../state/projects-panel.js';
import { formatProjectOpenOutcomeText } from '../state/project-open-result.js';
import { formatManifestRestoreSuffix } from '../state/manifest-restore-suffix.js';
import {
  formatAdoptSessionOutcomeText,
  formatSessionNotDiscoverableText,
  isAdoptedResult,
} from '../state/adopt-session-result.js';
import type { SidebarRow } from '../sidebar/sidebar-data.js';

/** Same default this file's own `main.ts` resolves `claude` to for every other tab-backed
 * launcher (`TabSessionResumer`'s own `CLAUDE_COMMAND` constant) — a plain string literal, not
 * worth importing across files for. */
const CLAUDE_COMMAND = 'claude';

export interface ProjectIpcHandle {
  /** Recomputes and pushes `CHANNELS.projectsUpdate` — called once per ambient refresh tick
   * (`main.ts`'s own `onTick`, reusing that same cycle's `SidebarRow[]`) and once more right after
   * "New project…"/"Open"/"Adopt…" resolve, so the lateral never waits up to
   * `REFRESH_INTERVAL_MS` to reflect what the person just did. */
  readonly pushProjectsUpdate: () => Promise<void>;
}

/** Every project's manifest plus its own directory, and its lock status keyed by id — read once
 * per `pushProjectsUpdate` call, shared by the push itself and by `openProject`/`adoptSession`'s
 * own need to know a project's directory before launching into it.
 *
 * V2-T72 item 2: also returns `rejected` (`listProjects`'s own D-022 half this function used to
 * drop) — a `seeya.json` that fails to parse/validate no longer just "disappears" from the window
 * the way it used to; `computeProjectsPanelData` below folds it into `ProjectsPanelData
 * .ignoredProjects`, the same fact the CLI's own "Ignored entries:" already shows. */
async function readProjectsWithLockStatus(context: AppContext): Promise<{
  readonly root: string;
  readonly projects: readonly ProjectWithDirectory[];
  readonly lockStatusByProjectId: ReadonlyMap<string, ProjectLockStatus>;
  readonly rejected: readonly RejectedDiscoveryRecord[];
}> {
  const root = await resolveWorkspaceRoot(context.storage, context.home.seeyaHome);
  const { manifests, rejected } = await listProjects(buildProjectWorkspaceDeps(context));
  const projects = manifests.map((manifest) => ({ manifest, dir: path.join(root, manifest.id) }));
  const lockStatusByProjectId = new Map(
    await Promise.all(
      manifests.map(
        async (manifest) =>
          [
            manifest.id,
            await describeProjectLockStatus(
              { projectLock: context.projectLock, processControl: context.processControl },
              root,
              manifest.id,
            ),
          ] as const,
      ),
    ),
  );
  return { root, projects, lockStatusByProjectId, rejected };
}

export function wireProjectIpc(
  window: BrowserWindow,
  context: AppContext,
  tabOpener: TabResumeOpener,
  getSidebarRows: () => readonly SidebarRow[],
): ProjectIpcHandle {
  // V2-T30 item 3: one question at a time in practice (a person only ever has one "Open" dialog
  // up), but keyed independently by requestId anyway — same defensive shape
  // `PendingFallbackRequests` already takes for `resumeSessions`' own sequential loop.
  const pendingLockConfirmations = new PendingConfirmations<'proceed' | 'decline'>('open-lock');
  // V2-T34 production defect (PO review, 2026-09-25): the window never asked this question at all
  // before — every leftover-changes `open` hit the flat `leftoverChangesConfirmationUnavailable`
  // refusal. Same shape as `pendingLockConfirmations` above, for the OTHER question `openProject`
  // can ask.
  const pendingLeftoverChangesConfirmations = new PendingConfirmations<
    'commitNow' | 'proceedWithoutCommitting'
  >('open-leftover-changes');
  const pendingLaunchConfirmations = new PendingConfirmations<'proceed' | 'decline'>(
    'adopt-launch',
  );
  const pendingCommitConfirmations = new PendingConfirmations<'commit' | 'decline'>('adopt-commit');

  async function computeProjectsPanelData(): Promise<ProjectsPanelData> {
    const { projects, lockStatusByProjectId, rejected } = await readProjectsWithLockStatus(context);
    const adoptions = await context.storage.readAdoptions();
    // V2-T63: read fresh every push (never cached on `AppContext`) — same "storage.readConfig() at
    // the moment it's needed" precedent every other live-reread value in this window follows,
    // since a star click from this same window (or, in principle, another `seeya` process) can
    // change the file between ticks.
    const favoriteProjectIds = new Set(await context.storage.readFavoriteProjectIds());
    return buildProjectsPanelData(
      getSidebarRows(),
      projects,
      adoptions,
      lockStatusByProjectId,
      context.platformHint,
      rejected,
      favoriteProjectIds,
    );
  }

  async function pushProjectsUpdate(): Promise<void> {
    window.webContents.send(CHANNELS.projectsUpdate, await computeProjectsPanelData());
  }

  // V2-T30 item 1: fetched once, at startup (`renderer/features/projects/useProjects.ts`),
  // the same "explicit request-response for the FIRST paint, push for every refresh after that"
  // shape `CHANNELS.getTodayPanel`/`onTodayUpdate` already establish. Needed because the ambient
  // refresh loop's own FIRST tick starts as soon as `wireIpc` runs — before the renderer's own
  // `<script type="module">` has necessarily finished loading and called `onProjectsUpdate` — so a
  // push-only design could leave the "Projects" section empty for up to `REFRESH_INTERVAL_MS`
  // after the window opens (measured while implementing this task: the renderer's first
  // `console-message` landed roughly 2.6s after this file's own first ambient
  // `computeProjectsPanelData` call in one real run on this machine).
  ipcMain.handle(CHANNELS.getProjectsPanel, async (): Promise<ProjectsPanelData> =>
    computeProjectsPanelData(),
  );

  // V2-T63: the star, clicked either from the lateral's own Favorites section or from a row in
  // the Projects tab (`docs/INTERFACE.md` § 1 item 3) — both call this one channel with the
  // project's own current `favorite` flag flipped, never re-derive it here (D-041: the renderer
  // already knows what it's toggling FROM). Read-modify-write, like every other `~/.seeya/`
  // document this window mutates; the push right after is what lets BOTH places (lateral and the
  // Projects tab) reflect the change without a second round trip of their own.
  ipcMain.handle(
    CHANNELS.toggleFavoriteProject,
    async (_event, request: ToggleFavoriteProjectRequest): Promise<void> => {
      const current = await context.storage.readFavoriteProjectIds();
      const next = toggleFavoriteProjectId(current, request.projectId, request.favorite);
      await context.storage.saveFavoriteProjectIds(next);
      await pushProjectsUpdate();
    },
  );

  ipcMain.handle(
    CHANNELS.createProject,
    async (_event, request: CreateProjectRequest): Promise<CreateProjectResponse> => {
      const result = await createProject(buildProjectWorkspaceDeps(context), request.projectId);
      await pushProjectsUpdate();
      return result.kind === 'created' ? { kind: 'created', projectId: result.projectId } : result;
    },
  );

  ipcMain.handle(
    CHANNELS.openProject,
    async (_event, request: OpenProjectRequest): Promise<OpenProjectResponse> => {
      const processIdentity = await context.resolveProcessIdentity();
      const launcher = new ProjectOpenTabLauncher({
        claudeCommand: CLAUDE_COMMAND,
        opener: tabOpener,
        label: request.projectId,
      });
      const deps = buildProjectOpenDeps(context, processIdentity, launcher, randomUUID());
      // V2-T73 item 2: `openProject` only ever reports `manifestRestore` through this callback
      // (the same pre-launch channel the CLI already prints through) — captured here so the
      // window's own single "how it ended" text can mention it too, never silently.
      let manifestRestoreSuffix = '';
      const result = await openProject(deps, request.projectId, SUPPORTED_HARNESS, {
        onBeforeLaunch: ({ manifestRestore }) => {
          manifestRestoreSuffix = formatManifestRestoreSuffix(manifestRestore);
        },
        confirmReadOnlyOpen: async (heldBy) => {
          const { requestId, answer } = pendingLockConfirmations.create();
          const event: ConfirmProjectLockOpenRequestEvent = {
            requestId,
            projectId: request.projectId,
            questionText: renderReadOnlyOpenQuestion(heldBy),
          };
          window.webContents.send(CHANNELS.confirmProjectLockOpenRequest, event);
          return answer;
        },
        confirmLeftoverChanges: async (changedFiles) => {
          const { requestId, answer } = pendingLeftoverChangesConfirmations.create();
          const event: ConfirmLeftoverChangesOpenRequestEvent = {
            requestId,
            projectId: request.projectId,
            questionLines: renderLeftoverChangesLines(changedFiles),
          };
          window.webContents.send(CHANNELS.confirmLeftoverChangesOpenRequest, event);
          return answer;
        },
      });
      await pushProjectsUpdate();
      return { outcomeText: formatProjectOpenOutcomeText(result) + manifestRestoreSuffix };
    },
  );

  ipcMain.on(
    CHANNELS.answerProjectLockOpenConfirm,
    (_event, answer: AnswerProjectLockOpenConfirmRequest) => {
      pendingLockConfirmations.resolve(answer.requestId, answer.decision);
    },
  );

  ipcMain.on(
    CHANNELS.answerLeftoverChangesOpenConfirm,
    (_event, answer: AnswerLeftoverChangesOpenConfirmRequest) => {
      pendingLeftoverChangesConfirmations.resolve(answer.requestId, answer.decision);
    },
  );

  ipcMain.handle(
    CHANNELS.adoptSession,
    async (_event, request: AdoptSessionRequest): Promise<AdoptSessionResponse> => {
      const discovery = await context.sessionProvider.list();
      const windowedMatch = discovery.sessions.find(
        (session) => session.sessionId === request.sessionId,
      );
      // V2-T55 item 1: a click can name a session the window already found only through the
      // id-search field's own direct, unwindowed lookup (`session.sessionId` here is always a
      // FULL id, never a prefix — the click carried the exact row's own id, so `found` is the
      // only outcome this ever reasonably produces). Mirrors `cli/session-reference.ts
      // #resolveSessionReferenceForAdoption`'s own fallback for the identical reason: a session
      // closed longer ago than `relevanceHours` has no entry in `discovery.sessions` at all.
      const fallback =
        windowedMatch === undefined
          ? await context.sessionIdLookup.findByIdPrefix(request.sessionId)
          : null;
      const original = windowedMatch ?? (fallback?.kind === 'found' ? fallback.session : undefined);
      if (original === undefined) {
        // D-025: the session this click referred to is no longer discoverable (aged past
        // relevanceHours AND not found by a direct id lookup, or the record vanished) — never
        // guessed, reported as its own outcome rather than thrown, so a stray click never crashes
        // the handler.
        return {
          outcomeText: formatSessionNotDiscoverableText(request.sessionId),
          adopted: false,
          projectId: request.projectId,
        };
      }
      const config = await context.storage.readConfig();
      const processIdentity = await context.resolveProcessIdentity();
      const launcher = new ProjectAdoptTabLauncher({
        claudeCommand: CLAUDE_COMMAND,
        opener: tabOpener,
        label: original.name,
      });
      const deps = buildProjectAdoptDeps(
        context,
        processIdentity,
        launcher,
        randomUUID(),
        config.idleMinutes,
      );
      const result = await adoptSession(deps, original, request.projectId, {
        confirmLaunch: async ({ originalCwd, projectDir, projectId }) => {
          const { requestId, answer } = pendingLaunchConfirmations.create();
          const event: ConfirmAdoptionLaunchRequestEvent = {
            requestId,
            explanationLines: renderAdoptionLaunchExplanationLines(
              originalCwd,
              projectDir,
              projectId,
            ),
          };
          window.webContents.send(CHANNELS.confirmAdoptionLaunchRequest, event);
          return answer;
        },
        confirmCommit: async (changedFiles) => {
          const { requestId, answer } = pendingCommitConfirmations.create();
          const event: ConfirmAdoptionCommitRequestEvent = {
            requestId,
            changedFilesLines: renderAdoptionCommitChangedFilesLines(changedFiles),
          };
          window.webContents.send(CHANNELS.confirmAdoptionCommitRequest, event);
          return answer;
        },
      });
      await pushProjectsUpdate();
      return {
        outcomeText: formatAdoptSessionOutcomeText(result),
        adopted: isAdoptedResult(result),
        projectId: request.projectId,
      };
    },
  );

  ipcMain.on(
    CHANNELS.answerAdoptionLaunchConfirm,
    (_event, answer: AnswerAdoptionLaunchConfirmRequest) => {
      pendingLaunchConfirmations.resolve(answer.requestId, answer.decision);
    },
  );

  ipcMain.on(
    CHANNELS.answerAdoptionCommitConfirm,
    (_event, answer: AnswerAdoptionCommitConfirmRequest) => {
      pendingCommitConfirmations.resolve(answer.requestId, answer.decision);
    },
  );

  return { pushProjectsUpdate };
}
