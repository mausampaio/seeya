/**
 * The "Projects"/"Other sessions" lists (V2-T30 item 1) and a project's "Open" button (item 3) —
 * split out of `electron/project-panel-view.ts` (PO review, 2026-09-25: that file grew past the
 * 500-line ceiling) into its own single responsibility. Same `electron/` exemption as the rest of
 * this directory (D-041: no decision of its own — `state/projects-panel.ts` already decided what
 * to show; every string here is `text/messages.ts`, never an inline template literal).
 */
import { MESSAGES } from '../text/messages.js';
import { shortenDirectoryPath } from '../sidebar/directory-label.js';
import type { ProjectPanelRow, ProjectsPanelData } from '../state/projects-panel.js';
import type { ProjectsUpdateEvent } from '../ipc/channels.js';

// V2-T30 item 5: the last `ProjectsPanelData` this window received — `electron/adopt-flow-view.ts`'s
// own "existing project" dropdown is built from it (never a second IPC round trip just to list
// projects again; the lateral already has the freshest copy from its own last refresh tick).
// V2-T55 item 3: `electron/other-sessions-dir-dialog-view.ts` reads the same latest copy to
// refresh an open directory modal in place, for the identical reason.
let latestProjectsPanelData: ProjectsPanelData = { projects: [], otherSessionsByDirectory: [] };

/** `electron/adopt-flow-view.ts`'s/`other-sessions-dir-dialog-view.ts`'s own read of the latest
 * push — kept as a function, not an export of the mutable binding itself, so nothing outside this
 * file can reassign it. */
export function getLatestProjectsPanelData(): ProjectsPanelData {
  return latestProjectsPanelData;
}

function renderProjectSessionRow(session: {
  readonly name: string;
  readonly displaySessionId: string;
  readonly cwd: string;
  readonly stateLabel: string;
  readonly matchedTabId: string | null;
}): HTMLLIElement {
  const item = document.createElement('li');
  item.textContent = MESSAGES.projectSessionRowLabel(
    session.name,
    session.displaySessionId,
    session.stateLabel,
  );
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

/** V2-T55 item 2 — one row per directory, never one per session: clicking it opens the modal
 * (`electron/other-sessions-dir-dialog-view.ts`, wired independently — this button only carries
 * `data-dir`, the key that modal looks the group back up by in `getLatestProjectsPanelData()`).
 *
 * PO acceptance correction 1 (2026-09-25): a long path used to stretch the sidebar and force a
 * horizontal scrollbar — `shortenDirectoryPath` shows only the distinguishing tail inline; the
 * full path still lives in `title` (a real tooltip on hover), never lost. */
function renderOtherSessionsDirectoryRow(group: {
  readonly dir: string;
  readonly sessionCount: number;
}): HTMLLIElement {
  const item = document.createElement('li');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'other-sessions-dir-row';
  button.textContent = MESSAGES.otherSessionsDirectoryRowLabel(
    shortenDirectoryPath(group.dir),
    group.sessionCount,
  );
  button.title = group.dir;
  button.dataset.dir = group.dir;
  item.appendChild(button);
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
  if (data.otherSessionsByDirectory.length === 0) {
    const empty = document.createElement('li');
    empty.id = 'other-sessions-empty';
    empty.textContent = MESSAGES.otherSessionsEmpty;
    otherList.appendChild(empty);
  } else {
    for (const group of data.otherSessionsByDirectory) {
      otherList.appendChild(renderOtherSessionsDirectoryRow(group));
    }
  }
}

/** "Open" clicked, from either a project block or the adopt-result dialog's own follow-up button
 * (V2-T30 items 3/5, `electron/adopt-flow-view.ts`'s own call) — never awaited by its own caller
 * (Q-087 item 3's own "a janela não fica bloqueada"): the tab this opens appears on its own,
 * through the reused `onResumeTabOpened` push (`renderer.ts#openResumeTabUi`, unchanged by this
 * task — mounting a spawned pty's tab UI was never resume-specific). Only the short "how it ended"
 * text waits for the promise, whenever it settles. */
export function triggerProjectOpen(projectId: string): void {
  const resultText = document.getElementById('project-open-result-text') as HTMLElement;
  resultText.textContent = '';
  void window.seeya
    .openProject({ projectId })
    .then((response) => {
      resultText.textContent = response.outcomeText;
    })
    .catch((error: unknown) => {
      // V2-T34 production defect (PO review, 2026-09-25): without this, an unexpected rejection
      // (the workspace's own git hook refusing a leftover-changes commit, or any other genuine
      // throw from `openProject`) left `resultText` blank forever — no error, no explanation,
      // reading as if nothing had happened.
      resultText.textContent = `seeya: open failed unexpectedly (${error instanceof Error ? error.message : String(error)}).`;
    });
}

function wireProjectOpenButtons(): void {
  document.getElementById('projects-list')?.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.project-open-button');
    const projectId = button?.dataset.projectId;
    if (projectId !== undefined) {
      triggerProjectOpen(projectId);
    }
  });
}

/** Wired once, at startup, from `electron/project-panel-view.ts#wireProjectPanel`. */
export function wireProjectsListView(): void {
  wireProjectOpenButtons();
  window.seeya.onProjectsUpdate((data) => renderProjectsPanel(data));
  // V2-T30 item 1: the first paint — see `CHANNELS.getProjectsPanel`'s own docstring for why this
  // can't be push-only.
  void window.seeya.getProjectsPanel().then((data) => renderProjectsPanel(data));
}
