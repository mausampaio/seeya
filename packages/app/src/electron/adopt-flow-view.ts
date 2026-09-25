/**
 * The whole "Adopt…" flow (V2-T30 item 5) — split out of `electron/project-panel-view.ts` (PO
 * review, 2026-09-25: that file grew past the 500-line ceiling) into its own single responsibility.
 * Kept as ONE file (not one per dialog) because it's one cohesive interaction sharing one
 * `AdoptPanelState` — the picker, the two confirmations and the result are four faces of the same
 * state machine (`state/adopt-panel.ts`), not four independent features.
 */
import { MESSAGES } from '../text/messages.js';
import { reduceAdoptPanel, type AdoptPanelState } from '../state/adopt-panel.js';
import { resolveChosenAdoptProjectId } from '../state/adopt-picker.js';
import { getLatestProjectsPanelData, triggerProjectOpen } from './projects-list-view.js';
import { closeOtherSessionsDirDialog } from './other-sessions-dir-dialog-view.js';
import type {
  AnswerAdoptionCommitConfirmRequest,
  AnswerAdoptionLaunchConfirmRequest,
  ConfirmAdoptionCommitRequestEvent,
  ConfirmAdoptionLaunchRequestEvent,
} from '../ipc/channels.js';

/** Renders the adopt flow's four dialogs from `state` alone — called after every event the
 * handlers below feed into `reduceAdoptPanel`, same "one state machine, one render function"
 * discipline `renderEndDayDialog` already establishes in `renderer.ts`.
 *
 * **The dialog is deliberately CLOSED between `launchAnswered` and the next push** (`idle`) — a
 * `<dialog>` opened with `showModal()` blocks every other element on the page, including the very
 * tab the person needs to interact with while the fork session is open (`state/adopt-panel.ts`'s
 * own docstring has the full reasoning). */
function renderAdoptDialogs(state: AdoptPanelState): void {
  const pickDialog = document.getElementById('adopt-pick-dialog') as HTMLDialogElement;
  const launchDialog = document.getElementById('adopt-launch-confirm-dialog') as HTMLDialogElement;
  const commitDialog = document.getElementById('adopt-commit-confirm-dialog') as HTMLDialogElement;
  const resultDialog = document.getElementById('adopt-result-dialog') as HTMLDialogElement;

  if (state.kind !== 'pickProject' && pickDialog.open) {
    pickDialog.close();
  }
  if (state.kind !== 'launchConfirm' && launchDialog.open) {
    launchDialog.close();
  }
  if (state.kind !== 'commitConfirm' && commitDialog.open) {
    commitDialog.close();
  }
  if (state.kind !== 'result' && resultDialog.open) {
    resultDialog.close();
  }

  if (state.kind === 'pickProject') {
    renderAdoptPickDialog();
    if (!pickDialog.open) {
      pickDialog.showModal();
    }
    return;
  }
  if (state.kind === 'launchConfirm') {
    renderDialogLines('adopt-launch-confirm-lines', state.explanationLines);
    if (!launchDialog.open) {
      launchDialog.showModal();
    }
    return;
  }
  if (state.kind === 'commitConfirm') {
    renderDialogLines('adopt-commit-confirm-lines', state.changedFilesLines);
    if (!commitDialog.open) {
      commitDialog.showModal();
    }
    return;
  }
  if (state.kind === 'result') {
    (document.getElementById('adopt-result-text') as HTMLElement).textContent = state.outcomeText;
    const openProjectButton = document.getElementById(
      'adopt-result-open-project',
    ) as HTMLButtonElement;
    openProjectButton.hidden = !state.adopted;
    if (!resultDialog.open) {
      resultDialog.showModal();
    }
  }
}

/** One paragraph per line, into `containerId` — the shape both the launch and the commit
 * confirmations need for their own explanation/changed-files lines. */
function renderDialogLines(containerId: string, lines: readonly string[]): void {
  const container = document.getElementById(containerId) as HTMLElement;
  container.textContent = '';
  for (const line of lines) {
    const paragraph = document.createElement('p');
    paragraph.textContent = line;
    container.appendChild(paragraph);
  }
}

/** The picker's own "existing project" options, rebuilt from the lateral's latest known projects
 * (`electron/projects-list-view.ts#getLatestProjectsPanelData` — never a second IPC round trip). */
function renderAdoptPickDialog(): void {
  const select = document.getElementById('adopt-existing-select') as HTMLSelectElement;
  select.textContent = '';
  for (const project of getLatestProjectsPanelData().projects) {
    const option = document.createElement('option');
    option.value = project.projectId;
    option.textContent = `${project.name} (${project.projectId})`;
    select.appendChild(option);
  }
  (document.getElementById('adopt-pick-error') as HTMLElement).textContent = '';
}

/** Static labels, set once — every dialog's title/button text this flow owns. */
function wireAdoptFlowLabels(): void {
  (document.getElementById('adopt-pick-title') as HTMLElement).textContent =
    MESSAGES.adoptPickTitle;
  (document.getElementById('adopt-pick-submit') as HTMLButtonElement).textContent =
    MESSAGES.adoptPickSubmit;
  (document.getElementById('adopt-pick-cancel') as HTMLButtonElement).textContent =
    MESSAGES.adoptPickCancel;
  (document.getElementById('adopt-launch-confirm-title') as HTMLElement).textContent =
    MESSAGES.adoptLaunchConfirmTitle;
  (document.getElementById('adopt-launch-confirm-proceed') as HTMLButtonElement).textContent =
    MESSAGES.adoptLaunchConfirmProceed;
  (document.getElementById('adopt-launch-confirm-decline') as HTMLButtonElement).textContent =
    MESSAGES.adoptLaunchConfirmDecline;
  (document.getElementById('adopt-commit-confirm-title') as HTMLElement).textContent =
    MESSAGES.adoptCommitConfirmTitle;
  (document.getElementById('adopt-commit-confirm-commit') as HTMLButtonElement).textContent =
    MESSAGES.adoptCommitConfirmCommit;
  (document.getElementById('adopt-commit-confirm-decline') as HTMLButtonElement).textContent =
    MESSAGES.adoptCommitConfirmDecline;
  (document.getElementById('adopt-result-title') as HTMLElement).textContent =
    MESSAGES.adoptResultTitle;
  (document.getElementById('adopt-result-open-project') as HTMLButtonElement).textContent =
    MESSAGES.adoptResultOpenProject;
  (document.getElementById('adopt-result-close') as HTMLButtonElement).textContent =
    MESSAGES.adoptResultClose;
}

/**
 * V2-T30 item 5: the whole "Adopt…" flow — one `AdoptPanelState`, updated by `reduceAdoptPanel`
 * and rendered by `renderAdoptDialogs` after every step, mirroring `renderer.ts#endDayState`'s own
 * discipline for a different multi-step dialog. Wired once, at startup, from `electron/
 * project-panel-view.ts#wireProjectPanel`.
 */
export function wireAdoptFlow(): void {
  let state: AdoptPanelState = { kind: 'idle' };
  function apply(next: AdoptPanelState): void {
    state = next;
    renderAdoptDialogs(state);
  }

  wireAdoptFlowLabels();

  /**
   * "Adopt…" on a session row (event delegation — rows are rebuilt on every push/render). V2-T55
   * moved every "Adopt…" button out of the flat `#other-sessions-list` (now directory rows only,
   * `electron/projects-list-view.ts`) into two other containers that share the identical row
   * markup (`electron/session-row-view.ts#renderSessionActionRow`): the directory modal
   * (`#other-sessions-dir-dialog-sessions`) and the id-search result
   * (`#session-search-result`) — one delegated listener per container, same trigger logic.
   */
  for (const containerId of ['other-sessions-dir-dialog-sessions', 'session-search-result']) {
    document.getElementById(containerId)?.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.adopt-button');
      const sessionId = button?.dataset.sessionId;
      const sessionName = button?.dataset.sessionName;
      if (
        button !== null &&
        !button.disabled &&
        sessionId !== undefined &&
        sessionName !== undefined
      ) {
        // PO acceptance correction 3 (2026-09-25): starting an adoption from INSIDE the directory
        // modal closes it first, so the picker never opens stacked on top of an already-open
        // dialog. `session-search-result` has no modal of its own to close.
        if (containerId === 'other-sessions-dir-dialog-sessions') {
          closeOtherSessionsDirDialog();
        }
        apply(reduceAdoptPanel(state, { kind: 'pickerOpened', sessionId, sessionName }));
      }
    });
  }

  const pickDialog = document.getElementById('adopt-pick-dialog') as HTMLDialogElement;
  const existingRadio = document.getElementById('adopt-target-existing') as HTMLInputElement;
  const newRadio = document.getElementById('adopt-target-new') as HTMLInputElement;
  const existingSelect = document.getElementById('adopt-existing-select') as HTMLSelectElement;
  const newInput = document.getElementById('adopt-new-project-id-input') as HTMLInputElement;
  function syncPickerInputsEnabled(): void {
    existingSelect.disabled = !existingRadio.checked;
    newInput.disabled = !newRadio.checked;
  }
  existingRadio.addEventListener('change', syncPickerInputsEnabled);
  newRadio.addEventListener('change', syncPickerInputsEnabled);

  document.getElementById('adopt-pick-cancel')?.addEventListener('click', () => {
    apply(reduceAdoptPanel(state, { kind: 'pickerCancelled' }));
  });
  pickDialog.addEventListener('cancel', () => {
    apply(reduceAdoptPanel(state, { kind: 'pickerCancelled' }));
  });

  document.getElementById('adopt-pick-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (state.kind !== 'pickProject') {
      return;
    }
    const projectId = resolveChosenAdoptProjectId(
      newRadio.checked,
      existingSelect.value,
      newInput.value,
    );
    if (projectId === null) {
      (document.getElementById('adopt-pick-error') as HTMLElement).textContent =
        MESSAGES.adoptPickNoProjectChosen;
      return;
    }
    const { sessionId } = state;
    apply(reduceAdoptPanel(state, { kind: 'pickerSubmitted' }));
    void window.seeya.adoptSession({ sessionId, projectId }).then((response) => {
      apply(
        reduceAdoptPanel(state, {
          kind: 'resultReceived',
          outcomeText: response.outcomeText,
          adopted: response.adopted,
          projectId: response.projectId,
        }),
      );
    });
  });

  function answerLaunch(decision: 'proceed' | 'decline'): void {
    if (state.kind !== 'launchConfirm') {
      return;
    }
    const request: AnswerAdoptionLaunchConfirmRequest = { requestId: state.requestId, decision };
    window.seeya.answerAdoptionLaunchConfirm(request);
    apply(reduceAdoptPanel(state, { kind: 'launchAnswered' }));
  }
  document
    .getElementById('adopt-launch-confirm-proceed')
    ?.addEventListener('click', () => answerLaunch('proceed'));
  document
    .getElementById('adopt-launch-confirm-decline')
    ?.addEventListener('click', () => answerLaunch('decline'));
  (document.getElementById('adopt-launch-confirm-dialog') as HTMLDialogElement).addEventListener(
    'cancel',
    () => answerLaunch('decline'),
  );

  function answerCommit(decision: 'commit' | 'decline'): void {
    if (state.kind !== 'commitConfirm') {
      return;
    }
    const request: AnswerAdoptionCommitConfirmRequest = { requestId: state.requestId, decision };
    window.seeya.answerAdoptionCommitConfirm(request);
    apply(reduceAdoptPanel(state, { kind: 'commitAnswered' }));
  }
  document
    .getElementById('adopt-commit-confirm-commit')
    ?.addEventListener('click', () => answerCommit('commit'));
  document
    .getElementById('adopt-commit-confirm-decline')
    ?.addEventListener('click', () => answerCommit('decline'));
  (document.getElementById('adopt-commit-confirm-dialog') as HTMLDialogElement).addEventListener(
    'cancel',
    () => answerCommit('decline'),
  );

  document.getElementById('adopt-result-open-project')?.addEventListener('click', () => {
    if (state.kind === 'result' && state.adopted) {
      triggerProjectOpen(state.projectId);
    }
    apply(reduceAdoptPanel(state, { kind: 'resultClosed' }));
  });
  document.getElementById('adopt-result-close')?.addEventListener('click', () => {
    apply(reduceAdoptPanel(state, { kind: 'resultClosed' }));
  });
  (document.getElementById('adopt-result-dialog') as HTMLDialogElement).addEventListener(
    'cancel',
    () => apply(reduceAdoptPanel(state, { kind: 'resultClosed' })),
  );

  window.seeya.onConfirmAdoptionLaunchRequest((event: ConfirmAdoptionLaunchRequestEvent) => {
    apply(
      reduceAdoptPanel(state, {
        kind: 'launchRequestReceived',
        requestId: event.requestId,
        explanationLines: event.explanationLines,
      }),
    );
  });
  window.seeya.onConfirmAdoptionCommitRequest((event: ConfirmAdoptionCommitRequestEvent) => {
    apply(
      reduceAdoptPanel(state, {
        kind: 'commitRequestReceived',
        requestId: event.requestId,
        changedFilesLines: event.changedFilesLines,
      }),
    );
  });
}
