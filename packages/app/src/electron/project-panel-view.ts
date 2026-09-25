/**
 * DOM wiring for the "Projects" section (V2-T30) — kept out of `renderer.ts` so that already
 * thousand-line file doesn't grow beyond the one `wireProjectPanel()` call its own `main()` needs
 * (the task's own "renderer.ts e main.ts não crescem"). Same `electron/` exemption as
 * `renderer.ts` itself (D-041: no decision of its own beyond "which DOM element does this event
 * belong to" — every actual decision is a pure `state/`/`sidebar/` function or the main process).
 */
import { MESSAGES } from '../text/messages.js';
import {
  encodeSidebarCollapsedPreference,
  parseSidebarCollapsedPreference,
  SIDEBAR_COLLAPSED_STORAGE_KEY,
} from '../state/sidebar-collapse.js';
import { reduceAdoptPanel, type AdoptPanelState } from '../state/adopt-panel.js';
import type {
  ProjectPanelOtherSessionRow,
  ProjectPanelRow,
  ProjectsPanelData,
} from '../state/projects-panel.js';
import type {
  AnswerAdoptionCommitConfirmRequest,
  AnswerAdoptionLaunchConfirmRequest,
  AnswerProjectLockOpenConfirmRequest,
  ConfirmAdoptionCommitRequestEvent,
  ConfirmAdoptionLaunchRequestEvent,
  ConfirmProjectLockOpenRequestEvent,
  ProjectsUpdateEvent,
} from '../ipc/channels.js';

function sidebarElement(): HTMLElement {
  return document.getElementById('sidebar') as HTMLElement;
}

/**
 * V2-T30 item 2: reads the collapsed preference protected — `localStorage` can throw outright (a
 * private window, blocked site data), and this function never lets that surface as "collapsed":
 * any failure or absent/malformed value opens expanded, same as `parseSidebarCollapsedPreference`'s
 * own D-025 contract for a value it CAN read.
 */
function readSidebarCollapsedPreference(): boolean {
  try {
    return parseSidebarCollapsedPreference(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY));
  } catch {
    return false;
  }
}

/** Best-effort write — a failure here just means the preference won't survive to the next launch
 * (same "protected" spirit as the read above), never surfaced as an error to the person clicking
 * the toggle. */
function writeSidebarCollapsedPreference(collapsed: boolean): void {
  try {
    localStorage.setItem(
      SIDEBAR_COLLAPSED_STORAGE_KEY,
      encodeSidebarCollapsedPreference(collapsed),
    );
  } catch {
    // Protected write — see this file's own docstring on readSidebarCollapsedPreference.
  }
}

function applySidebarCollapsed(collapsed: boolean): void {
  const sidebar = sidebarElement();
  sidebar.classList.toggle('collapsed', collapsed);
  const toggle = document.getElementById('sidebar-collapse-toggle') as HTMLButtonElement;
  toggle.textContent = collapsed
    ? MESSAGES.sidebarCollapseToggleCollapsed
    : MESSAGES.sidebarCollapseToggleExpanded;
}

/** Wired once, at startup — restores the remembered state (V2-T30 item 2: "o estado é lembrado
 * entre aberturas do app") and toggles/persists it on click. The terminal's own re-fit is NOT this
 * function's job: `renderer.ts#wireWindowResize`'s own `ResizeObserver` on `#terminal-host` already
 * reacts to the size change this toggle causes, without a direct call from here (one mechanism,
 * every trigger — window resize, maximize, and this). */
function wireSidebarCollapse(): void {
  applySidebarCollapsed(readSidebarCollapsedPreference());
  document.getElementById('sidebar-collapse-toggle')?.addEventListener('click', () => {
    const collapsed = !sidebarElement().classList.contains('collapsed');
    applySidebarCollapsed(collapsed);
    writeSidebarCollapsedPreference(collapsed);
  });
}

// V2-T30 item 5: the last `ProjectsPanelData` this window received — the adopt picker's own
// "existing project" dropdown is built from it (never a second IPC round trip just to list
// projects again; the lateral already has the freshest copy from its own last refresh tick).
let latestProjectsPanelData: ProjectsPanelData = { projects: [], otherSessions: [] };

function renderProjectSessionRow(session: {
  readonly name: string;
  readonly cwd: string;
  readonly state: string;
  readonly matchedTabId: string | null;
}): HTMLLIElement {
  const item = document.createElement('li');
  item.textContent = `${session.name} (${session.state})`;
  item.title = session.cwd;
  if (session.matchedTabId !== null) {
    item.classList.add('matched');
  }
  return item;
}

function renderProjectBlock(project: ProjectPanelRow): HTMLElement {
  const container = document.createElement('div');
  container.className = 'project-block';

  const header = document.createElement('div');
  header.className = 'project-block-header';
  const name = document.createElement('strong');
  name.textContent = project.name;
  header.appendChild(name);
  const openButton = document.createElement('button');
  openButton.type = 'button';
  openButton.className = 'project-open-button';
  openButton.textContent = MESSAGES.projectOpenButton;
  openButton.dataset.projectId = project.projectId;
  header.appendChild(openButton);
  container.appendChild(header);

  const lock = document.createElement('p');
  lock.className = 'project-lock-text';
  lock.textContent = MESSAGES.projectLockLabel(project.lockText);
  container.appendChild(lock);

  const sessions = document.createElement('ul');
  for (const session of project.sessions) {
    sessions.appendChild(renderProjectSessionRow(session));
  }
  container.appendChild(sessions);

  return container;
}

function renderOtherSessionRow(row: ProjectPanelOtherSessionRow): HTMLLIElement {
  const item = document.createElement('li');
  const label = document.createElement('span');
  label.textContent = `${row.name} (${row.cwd}) — ${row.state}`;
  item.appendChild(label);

  const adoptButton = document.createElement('button');
  adoptButton.type = 'button';
  adoptButton.className = 'adopt-button';
  adoptButton.textContent = MESSAGES.adoptButton;
  adoptButton.dataset.sessionId = row.sessionId;
  adoptButton.dataset.sessionName = row.name;
  if (row.adopt.kind === 'unavailable') {
    adoptButton.disabled = true;
    adoptButton.title = row.adopt.reason;
  }
  item.appendChild(adoptButton);

  return item;
}

/** Renders the whole "Projects"/"Other sessions" pair from scratch — same "simplest for a list
 * this small" reasoning `renderTodayPanel`'s own docstring already gives, and the same event
 * DELEGATION shape (one listener per list, not one per button) `renderSidebar`'s own removed flat
 * list never needed but this one does, since "Open"/"Adopt…" buttons are now nested inside rows
 * rebuilt on every push. */
function renderProjectsPanel(data: ProjectsUpdateEvent): void {
  latestProjectsPanelData = data;

  const projectsList = document.getElementById('projects-list') as HTMLElement;
  projectsList.textContent = '';
  if (data.projects.length === 0) {
    const empty = document.createElement('p');
    empty.id = 'projects-panel-empty';
    empty.textContent = MESSAGES.projectsEmpty;
    projectsList.appendChild(empty);
  } else {
    for (const project of data.projects) {
      projectsList.appendChild(renderProjectBlock(project));
    }
  }

  const otherList = document.getElementById('other-sessions-list') as HTMLElement;
  otherList.textContent = '';
  if (data.otherSessions.length === 0) {
    const empty = document.createElement('li');
    empty.id = 'other-sessions-empty';
    empty.textContent = MESSAGES.otherSessionsEmpty;
    otherList.appendChild(empty);
  } else {
    for (const row of data.otherSessions) {
      otherList.appendChild(renderOtherSessionRow(row));
    }
  }
}

/** "Open" clicked, from either a project block or the adopt-result dialog's own follow-up button
 * (V2-T30 items 3/5) — never awaited by its own caller (Q-087 item 3's own "a janela não fica
 * bloqueada"): the tab this opens appears on its own, through the reused `onResumeTabOpened` push
 * (`renderer.ts#openResumeTabUi`, unchanged by this task — mounting a spawned pty's tab UI was
 * never resume-specific). Only the short "how it ended" text waits for the promise, whenever it
 * settles. */
function handleOpenProjectClicked(projectId: string): void {
  const resultText = document.getElementById('project-open-result-text') as HTMLElement;
  resultText.textContent = '';
  void window.seeya.openProject({ projectId }).then((response) => {
    resultText.textContent = response.outcomeText;
  });
}

function wireProjectOpenButtons(): void {
  document.getElementById('projects-list')?.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.project-open-button');
    const projectId = button?.dataset.projectId;
    if (projectId !== undefined) {
      handleOpenProjectClicked(projectId);
    }
  });
}

/** V2-T30 item 3: the project-lock read-only-open confirmation — one native `<dialog>`, the same
 * `showModal()`/button-click/`cancel`-event shape `wireFallbackDialog` already establishes in
 * `renderer.ts`. Escape (the dialog's own "cancel" event) declines, same "closing without choosing
 * is the safe answer" default every confirmation dialog in this file follows. */
function wireProjectLockConfirmDialog(): void {
  const dialog = document.getElementById('project-lock-confirm-dialog') as HTMLDialogElement;
  (document.getElementById('project-lock-confirm-title') as HTMLElement).textContent =
    MESSAGES.projectLockConfirmTitle;
  const proceedButton = document.getElementById(
    'project-lock-confirm-proceed',
  ) as HTMLButtonElement;
  const declineButton = document.getElementById(
    'project-lock-confirm-decline',
  ) as HTMLButtonElement;
  proceedButton.textContent = MESSAGES.projectLockConfirmProceed;
  declineButton.textContent = MESSAGES.projectLockConfirmDecline;

  function answer(decision: 'proceed' | 'decline'): void {
    const request: AnswerProjectLockOpenConfirmRequest = {
      requestId: dialog.dataset.requestId ?? '',
      decision,
    };
    window.seeya.answerProjectLockOpenConfirm(request);
    dialog.close();
  }
  proceedButton.addEventListener('click', () => answer('proceed'));
  declineButton.addEventListener('click', () => answer('decline'));
  dialog.addEventListener('cancel', () => answer('decline'));

  window.seeya.onConfirmProjectLockOpenRequest((event: ConfirmProjectLockOpenRequestEvent) => {
    dialog.dataset.requestId = event.requestId;
    (document.getElementById('project-lock-confirm-question') as HTMLElement).textContent =
      event.questionText;
    dialog.showModal();
  });
}

/** V2-T30 item 4: "New project…" — the same `createProject` `seeya project create` calls. A
 * rejected id (`invalidId`/`alreadyExists`) leaves the dialog open with the refusal shown, same
 * "never surprise, the typed text stays" convention `handleSettingsSaveClicked` already follows. */
function wireNewProjectDialog(): void {
  const dialog = document.getElementById('new-project-dialog') as HTMLDialogElement;
  (document.getElementById('new-project-dialog-title') as HTMLElement).textContent =
    MESSAGES.newProjectDialogTitle;
  const submitButton = document.getElementById('new-project-submit') as HTMLButtonElement;
  const cancelButton = document.getElementById('new-project-cancel') as HTMLButtonElement;
  submitButton.textContent = MESSAGES.newProjectSubmit;
  cancelButton.textContent = MESSAGES.newProjectCancel;
  const input = document.getElementById('new-project-id-input') as HTMLInputElement;
  const errorLine = document.getElementById('new-project-error') as HTMLElement;

  document.getElementById('new-project-button')?.addEventListener('click', () => {
    input.value = '';
    errorLine.textContent = '';
    dialog.showModal();
    input.focus();
  });
  cancelButton.addEventListener('click', () => dialog.close());

  document.getElementById('new-project-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    errorLine.textContent = '';
    void window.seeya.createProject({ projectId: input.value.trim() }).then((response) => {
      if (response.kind !== 'created') {
        errorLine.textContent =
          response.kind === 'invalidId'
            ? `"${response.projectId}" is not a valid project id — use lowercase letters, digits ` +
              'and hyphens only.'
            : `Project "${response.projectId}" already exists.`;
        return;
      }
      dialog.close();
    });
  });
}

/** Renders the adopt flow's four dialogs from `state` alone — called after every event the
 * handlers below feed into `reduceAdoptPanel`, same "one state machine, one render function"
 * discipline `renderEndDayDialog` already establishes in `renderer.ts`. */
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
    const select = document.getElementById('adopt-existing-select') as HTMLSelectElement;
    select.textContent = '';
    for (const project of latestProjectsPanelData.projects) {
      const option = document.createElement('option');
      option.value = project.projectId;
      option.textContent = `${project.name} (${project.projectId})`;
      select.appendChild(option);
    }
    (document.getElementById('adopt-pick-error') as HTMLElement).textContent = '';
    if (!pickDialog.open) {
      pickDialog.showModal();
    }
    return;
  }
  if (state.kind === 'launchConfirm') {
    const container = document.getElementById('adopt-launch-confirm-lines') as HTMLElement;
    container.textContent = '';
    for (const line of state.explanationLines) {
      const paragraph = document.createElement('p');
      paragraph.textContent = line;
      container.appendChild(paragraph);
    }
    if (!launchDialog.open) {
      launchDialog.showModal();
    }
    return;
  }
  if (state.kind === 'commitConfirm') {
    const container = document.getElementById('adopt-commit-confirm-lines') as HTMLElement;
    container.textContent = '';
    for (const line of state.changedFilesLines) {
      const paragraph = document.createElement('p');
      paragraph.textContent = line;
      container.appendChild(paragraph);
    }
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

/**
 * V2-T30 item 5: the whole "Adopt…" flow — one `AdoptPanelState`, updated by
 * `reduceAdoptPanel` and rendered by `renderAdoptDialogs` after every step, mirroring
 * `renderer.ts#endDayState`'s own discipline for a different multi-step dialog.
 */
function wireAdoptFlow(): void {
  let state: AdoptPanelState = { kind: 'idle' };
  function apply(next: AdoptPanelState): void {
    state = next;
    renderAdoptDialogs(state);
  }

  // Static labels, set once.
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

  // "Adopt…" on an "Other sessions" row (event delegation — rows are rebuilt on every push).
  document.getElementById('other-sessions-list')?.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.adopt-button');
    const sessionId = button?.dataset.sessionId;
    const sessionName = button?.dataset.sessionName;
    if (
      button !== null &&
      !button.disabled &&
      sessionId !== undefined &&
      sessionName !== undefined
    ) {
      apply(reduceAdoptPanel(state, { kind: 'pickerOpened', sessionId, sessionName }));
    }
  });

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
    const projectId = (newRadio.checked ? newInput.value : existingSelect.value).trim();
    if (projectId === '') {
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
      handleOpenProjectClicked(state.projectId);
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

/** Wired once, at startup, from `renderer.ts#main`. */
export function wireProjectPanel(): void {
  wireSidebarCollapse();
  (document.getElementById('new-project-button') as HTMLButtonElement).textContent =
    MESSAGES.newProjectButton;
  wireNewProjectDialog();
  wireProjectOpenButtons();
  wireProjectLockConfirmDialog();
  wireAdoptFlow();
  window.seeya.onProjectsUpdate((data) => renderProjectsPanel(data));
  // V2-T30 item 1: the first paint — see `CHANNELS.getProjectsPanel`'s own docstring for why this
  // can't be push-only.
  void window.seeya.getProjectsPanel().then((data) => renderProjectsPanel(data));
}
