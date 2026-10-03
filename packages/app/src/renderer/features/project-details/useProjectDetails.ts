/**
 * The "Project details" dialog's own data and actions (V2-T83, `docs/INTERFACE.md` § 4a).
 *
 * **Data.** `getProjectDetails` is fetched when the dialog opens and again (a) right after every
 * action, so the list the person just changed shows its new state at once ("aplica o resultado na
 * hora"), and (b) whenever the Projects panel pushes a new snapshot while the dialog is open (the
 * ambient 10s tick, or another action's own push) — that is how a lock taken or released by a
 * session elsewhere reaches an open dialog. A fetch that finishes after a newer one started is
 * dropped (`latestRequest`), never applied over fresher data; the previous details stay on screen
 * while a refetch is in flight, so the dialog never blinks empty.
 *
 * **Actions.** One `pending` value (D-024: a discriminated union, never a boolean per button) —
 * the engine takes the project lock for every write, so only one can run at a time, and every
 * other write button is disabled while one runs. Every action ends in either the engine's own
 * outcome (`result`, with its tone) or a rejected IPC call, which is shown as an error line, never
 * swallowed: `.catch` is what keeps a thrown engine error from leaving the dialog looking idle.
 */
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { getSeeyaApi } from '../../ipc/client.js';
import { useIpcSubscription } from '../../hooks/useIpcSubscription.js';
import type { ProjectsPanelData, ProjectPanelRow } from '../../../state/projects-panel.js';
import type { ProjectDetailsData } from '../../../state/project-details.js';
import type { ProjectActionResponse } from '../../../state/project-details-result.js';
import type { PathPlatformHint } from '@seeya-ai/engine/core/cwd-normalization.js';
import { MESSAGES } from '../../../text/messages.js';
import { registerProjectDetailsOpener } from './project-details-bridge.js';
import { openArchiveConfirm } from '../confirmations/archive-confirm-bridge.js';

const AWAITING_FIRST_PROJECTS_PANEL: ProjectsPanelData = {
  projects: [],
  otherSessionsByDirectory: [],
  ignoredProjects: [],
};

/** What is running right now, so the matching button can show `loading` and the others disable. */
export type PendingProjectAction =
  | { readonly kind: 'addRepository' }
  | { readonly kind: 'removeRepository'; readonly name: string }
  | { readonly kind: 'revertAdoption'; readonly forkSessionId: string }
  | { readonly kind: 'removeProject' }
  | { readonly kind: 'unarchiveProject' };

export interface ProjectDetailsControls {
  readonly open: boolean;
  readonly projectId: string | null;
  /** For abbreviating paths as `~/...` (`sidebar/directory-label.ts`) — `''` until the window's
   * own home directory arrives, which `collapseHomeDirectory` treats as "never abbreviate". */
  readonly homeDir: string;
  readonly platformHint: PathPlatformHint;
  /** The Projects panel row for this project, when it is still in the panel — carries the lock the
   * Projects tab shows, and whether the project is open in a tab of THIS window. */
  readonly row: ProjectPanelRow | null;
  readonly details: ProjectDetailsData | null;
  readonly loadError: string | null;
  readonly pending: PendingProjectAction | null;
  readonly result: ProjectActionResponse | null;
  /** Set once the project itself was removed — the dialog then shows only this. */
  readonly removed: ProjectActionResponse | null;
  readonly close: () => void;
  readonly onAddRepository: () => void;
  readonly onRemoveRepository: (name: string) => void;
  readonly onRevertAdoption: (forkSessionId: string) => void;
  readonly onRemoveProject: () => void;
  /** V2-T84: opens the archive confirmation (with the optional note) — the call itself runs in
   * that dialog. */
  readonly onArchiveProject: () => void;
  readonly onUnarchiveProject: () => void;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function errorResponse(error: unknown): ProjectActionResponse {
  return {
    tone: 'error',
    lines: [MESSAGES.projectDetailsActionError(describeError(error))],
    projectRemoved: false,
  };
}

export function useProjectDetails(): ProjectDetailsControls {
  const api = getSeeyaApi();
  const panel = useIpcSubscription<ProjectsPanelData>(
    (listener) => api.onProjectsUpdate(listener),
    AWAITING_FIRST_PROJECTS_PANEL,
    () => api.getProjectsPanel(),
  );
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [details, setDetails] = useState<ProjectDetailsData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingProjectAction | null>(null);
  const [result, setResult] = useState<ProjectActionResponse | null>(null);
  const [removed, setRemoved] = useState<ProjectActionResponse | null>(null);
  const latestRequest = useRef(0);
  const [homeDir, setHomeDir] = useState('');
  useEffect(() => {
    void api.getHomeDir().then(setHomeDir);
  }, [api]);

  const fetchDetails = useCallback(
    async (id: string): Promise<void> => {
      latestRequest.current += 1;
      const request = latestRequest.current;
      try {
        const next = await api.getProjectDetails({ projectId: id });
        if (request === latestRequest.current) {
          setDetails(next);
          setLoadError(null);
        }
      } catch (error: unknown) {
        if (request === latestRequest.current) {
          setLoadError(MESSAGES.projectDetailsLoadError(describeError(error)));
        }
      }
    },
    [api],
  );

  useEffect(() => {
    registerProjectDetailsOpener((id) => {
      setProjectId(id);
      setDetails(null);
      setLoadError(null);
      setResult(null);
      setRemoved(null);
      setPending(null);
      setOpen(true);
    });
  }, []);

  // `panel` is a dependency on purpose: every push (ambient tick, any action's own push) refetches
  // while the dialog is open. Skipped once the project is gone — there is nothing left to read.
  useEffect(() => {
    if (open && projectId !== null && removed === null) {
      void fetchDetails(projectId);
    }
  }, [open, projectId, panel, removed, fetchDetails]);

  const runAction = useCallback(
    async (
      next: PendingProjectAction,
      call: () => Promise<ProjectActionResponse | null>,
    ): Promise<void> => {
      if (projectId === null) {
        return;
      }
      setPending(next);
      setResult(null);
      try {
        const response = await call();
        if (response === null) {
          return;
        }
        setResult(response);
        if (response.projectRemoved) {
          setRemoved(response);
          return;
        }
        await fetchDetails(projectId);
      } catch (error: unknown) {
        setResult(errorResponse(error));
      } finally {
        setPending(null);
      }
    },
    [projectId, fetchDetails],
  );

  const onAddRepository = useCallback(() => {
    if (projectId === null) {
      return;
    }
    void runAction({ kind: 'addRepository' }, async () => {
      const picked = await api.pickDirectory();
      // A cancelled picker is not an outcome worth a message — nothing was asked of the engine.
      return picked.canceled ? null : api.addProjectRepository({ projectId, path: picked.path });
    });
  }, [api, projectId, runAction]);

  const onRemoveRepository = useCallback(
    (name: string) => {
      if (projectId === null) {
        return;
      }
      void runAction({ kind: 'removeRepository', name }, () =>
        api.removeProjectRepository({ projectId, name }),
      );
    },
    [api, projectId, runAction],
  );

  const onRevertAdoption = useCallback(
    (forkSessionId: string) => {
      if (projectId === null) {
        return;
      }
      void runAction({ kind: 'revertAdoption', forkSessionId }, () =>
        api.revertProjectAdoption({ projectId, forkSessionId }),
      );
    },
    [api, projectId, runAction],
  );

  const onRemoveProject = useCallback(() => {
    if (projectId === null) {
      return;
    }
    void runAction({ kind: 'removeProject' }, () => api.removeProject({ projectId }));
  }, [api, projectId, runAction]);

  const onArchiveProject = useCallback(() => {
    if (projectId === null || details === null || details.kind !== 'found') {
      return;
    }
    openArchiveConfirm({ projectId, name: details.name });
  }, [projectId, details]);

  const onUnarchiveProject = useCallback(() => {
    if (projectId === null) {
      return;
    }
    void runAction({ kind: 'unarchiveProject' }, () => api.unarchiveProject({ projectId }));
  }, [api, projectId, runAction]);

  return {
    open,
    projectId,
    homeDir,
    platformHint: api.platform === 'win32' ? 'win32' : 'posix',
    row: panel.projects.find((candidate) => candidate.projectId === projectId) ?? null,
    details,
    loadError,
    pending,
    result,
    removed,
    close: () => setOpen(false),
    onAddRepository,
    onRemoveRepository,
    onRevertAdoption,
    onRemoveProject,
    onArchiveProject,
    onUnarchiveProject,
  };
}
