/**
 * V2-T70 (`docs/INTERFACE.md` § 7): the single adoption dialog's own data and actions.
 *
 * **Why `confirmLaunch` needs no round trip any more:** step 1 (`PickPane`) already shows the
 * exact `renderAdoptionLaunchExplanationLines` text (via `CHANNELS.previewAdoptionLaunch`, live as
 * the person picks/types a project id) BEFORE "Open the copy" is ever clicked. Clicking it submits
 * `adoptSession` directly — `main/project-ipc.ts`'s own `confirmLaunch` callback now answers
 * `'proceed'` immediately, because the person already confirmed via this exact dialog. Declining
 * is simply never calling `adoptSession` at all (`cancel` below never reaches main). This is what
 * `docs/INTERFACE.md` § 7 item 1 means by "não pergunte duas vezes."
 *
 * **Why the picker's own form state (mode/ids/preview/error) is local `useState`, not part of
 * `AdoptPanelState`:** that machine only tracks what crosses a process boundary (open/submit/the
 * commit round trip/the result) — the same "estado sempre no reducer, nunca espalhado" governs
 * what's IN the reducer, but a text field's own keystrokes were never main's concern to begin
 * with (D-041: no second source for the same fact, but also no THIRD state machine for a fact
 * that's genuinely only ever read by this one component).
 */
import { useEffect, useMemo, useState } from 'preact/hooks';
import { isValidProjectId } from '@seeya-ai/engine/core/project-id.js';
import type { PathPlatformHint } from '@seeya-ai/engine/core/cwd-normalization.js';
import { getSeeyaApi } from '../../ipc/client.js';
import { MESSAGES } from '../../../text/messages.js';
import type { AdoptPanelState } from '../../../state/adopt-panel.js';
import { resolveChosenAdoptProjectId } from '../../../state/adopt-picker.js';
import { buildAdoptionReviewRows, type AdoptionReviewRow } from '../../../state/adoption-review.js';
import { getLatestProjectsPanelData } from '../../legacy/projects-panel-cache.js';
import {
  dispatchAdoptPanel,
  getAdoptPanelState,
  subscribeAdoptPanel,
} from './adoption-dialog-bridge.js';
import type { ConfirmAdoptionCommitRequestEvent } from '../../../ipc/channels.js';

export type AdoptPickMode = 'existing' | 'new';

/** Same `platform === 'win32' ? 'win32' : 'posix'` mapping `useToday.ts`/`useSessions.ts` each
 * already duplicate locally for their own hook. */
function toPlatformHint(platform: NodeJS.Platform): PathPlatformHint {
  return platform === 'win32' ? 'win32' : 'posix';
}

export interface AdoptionExistingProjectOption {
  readonly value: string;
  readonly label: string;
}

export interface AdoptionControls {
  readonly state: AdoptPanelState;
  readonly homeDir: string;
  readonly platformHint: PathPlatformHint;
  readonly mode: AdoptPickMode;
  readonly setMode: (mode: AdoptPickMode) => void;
  readonly existingProjectOptions: readonly AdoptionExistingProjectOption[];
  readonly existingProjectId: string;
  readonly setExistingProjectId: (projectId: string) => void;
  readonly newProjectId: string;
  readonly setNewProjectId: (projectId: string) => void;
  readonly pickError: string | undefined;
  readonly explanationLines: readonly string[];
  readonly submitting: boolean;
  readonly submit: () => void;
  readonly cancel: () => void;
  readonly reviewRows: readonly AdoptionReviewRow[];
  readonly answerCommit: (decision: 'commit' | 'decline') => void;
  readonly closeResult: () => void;
}

/** The project id this attempt will actually submit — `mode === 'new'` reuses
 * `resolveChosenAdoptProjectId`'s own trimming (V2-T30), never a second trim here. */
function chosenProjectId(
  mode: AdoptPickMode,
  existingProjectId: string,
  newProjectId: string,
): string {
  return resolveChosenAdoptProjectId(mode === 'new', existingProjectId, newProjectId) ?? '';
}

export function useAdoption(): AdoptionControls {
  const api = getSeeyaApi();
  const [state, setState] = useState<AdoptPanelState>(getAdoptPanelState());
  useEffect(() => subscribeAdoptPanel(setState), []);

  const [homeDir, setHomeDir] = useState('');
  useEffect(() => {
    void api.getHomeDir().then(setHomeDir);
  }, [api]);
  const platformHint = toPlatformHint(api.platform);

  // V2-T70: the structured commit question — the one IPC round trip this flow still has, since
  // the file list genuinely doesn't exist until the fork's own tab has closed.
  useEffect(() => {
    api.onConfirmAdoptionCommitRequest((event: ConfirmAdoptionCommitRequestEvent) => {
      dispatchAdoptPanel({
        kind: 'commitRequestReceived',
        requestId: event.requestId,
        entries: event.changedFileEntries,
      });
    });
  }, [api]);

  const [mode, setMode] = useState<AdoptPickMode>('existing');
  const [existingProjectId, setExistingProjectId] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [pickError, setPickError] = useState<string | undefined>(undefined);
  const [explanationLines, setExplanationLines] = useState<readonly string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const existingProjectOptions = useMemo<readonly AdoptionExistingProjectOption[]>(
    () =>
      getLatestProjectsPanelData().projects.map((project) => ({
        value: project.projectId,
        label: `${project.name} (${project.projectId})`,
      })),
    // Recomputed fresh every time the picker opens — a project created in an earlier adoption
    // (or from the Projects tab, in the same session) should show up without this hook having its
    // own second subscription to `onProjectsUpdate`.
    [state.kind === 'pickProject'],
  );

  // Resets the form every time a NEW picker opens (never on every render) — same discipline
  // `NewProjectDialog.tsx`'s own `registerNewProjectDialogOpener` callback already follows.
  useEffect(() => {
    if (state.kind !== 'pickProject') {
      return;
    }
    setMode('existing');
    setExistingProjectId(existingProjectOptions[0]?.value ?? '');
    setNewProjectId('');
    setPickError(undefined);
    setExplanationLines([]);
    setSubmitting(false);
    // Keyed on the session identity only, not `existingProjectOptions` (recomputed every open
    // anyway, read directly above rather than through a dependency this effect would otherwise
    // need to re-run for).
  }, [state.kind === 'pickProject' ? state.session.sessionId : null]);

  const projectId = chosenProjectId(mode, existingProjectId, newProjectId);

  // V2-T70's own live preview — recomputed as the person picks/types, so "Open the copy" submits
  // exactly the explanation already on screen (this hook's own top docstring).
  useEffect(() => {
    if (state.kind !== 'pickProject' || projectId === '') {
      setExplanationLines([]);
      return;
    }
    if (mode === 'new' && !isValidProjectId(projectId)) {
      setExplanationLines([]);
      return;
    }
    let active = true;
    void api
      .previewAdoptionLaunch({ originalCwd: state.session.cwd, projectId })
      .then((response) => {
        if (active) {
          setExplanationLines(response.explanationLines);
        }
      });
    return () => {
      active = false;
    };
  }, [api, state.kind === 'pickProject' ? state.session.cwd : null, mode, projectId]);

  function submit(): void {
    if (state.kind !== 'pickProject') {
      return;
    }
    if (mode === 'new' && newProjectId.trim() !== '' && !isValidProjectId(newProjectId.trim())) {
      setPickError(MESSAGES.adoptPickInvalidNewProjectId);
      return;
    }
    if (projectId === '') {
      setPickError(MESSAGES.adoptPickNoProjectChosen);
      return;
    }
    setPickError(undefined);
    setSubmitting(true);
    const { sessionId } = state.session;
    dispatchAdoptPanel({ kind: 'pickerSubmitted' });
    void api
      .adoptSession({ sessionId, projectId })
      .then((response) => {
        dispatchAdoptPanel({
          kind: 'resultReceived',
          outcomeText: response.outcomeText,
          adopted: response.adopted,
          projectId: response.projectId,
        });
      })
      .catch((error: unknown) => {
        // Same "a janela nunca fecha em silêncio numa falha inesperada" discipline V2-T34's own
        // production defect fixed for the legacy flow — `resultReceived` is accepted from ANY
        // state (`reduceAdoptPanel`'s own docstring), so this reopens the dialog with the error
        // instead of leaving it closed forever.
        dispatchAdoptPanel({
          kind: 'resultReceived',
          outcomeText: `seeya: adoption failed unexpectedly (${error instanceof Error ? error.message : String(error)}).`,
          adopted: false,
          projectId,
        });
      });
  }

  function cancel(): void {
    dispatchAdoptPanel({ kind: 'pickerCancelled' });
  }

  const reviewRows = useMemo(
    () => (state.kind === 'commitConfirm' ? buildAdoptionReviewRows(state.entries) : []),
    [state],
  );

  function answerCommit(decision: 'commit' | 'decline'): void {
    if (state.kind !== 'commitConfirm') {
      return;
    }
    api.answerAdoptionCommitConfirm({ requestId: state.requestId, decision });
    dispatchAdoptPanel({ kind: 'commitAnswered' });
  }

  function closeResult(): void {
    if (state.kind === 'result' && state.adopted) {
      // Fire-and-forget, same "the tab IS the feedback" shape `openProject`/`adoptSession`
      // themselves already are (Q-087 item 3) — never awaited by a click.
      void api.openProject({ projectId: state.projectId }).catch(() => {});
    }
    dispatchAdoptPanel({ kind: 'resultClosed' });
  }

  return {
    state,
    homeDir,
    platformHint,
    mode,
    setMode,
    existingProjectOptions,
    existingProjectId,
    setExistingProjectId,
    newProjectId,
    setNewProjectId,
    pickError,
    explanationLines,
    submitting,
    submit,
    cancel,
    reviewRows,
    answerCommit,
    closeResult,
  };
}

export type { AdoptPanelState };
