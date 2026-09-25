/**
 * The "Other sessions" directory modal (V2-T55 item 3): clicking a directory row
 * (`electron/projects-list-view.ts#renderOtherSessionsDirectoryRow`) opens this dialog with every
 * session in that directory — name, short id (copyable), state label, last activity, and
 * Adopt… — one row per session, built by `session-row-view.ts#renderSessionActionRow` (the same
 * row `session-search-view.ts` renders for a search hit, never a second markup for the same
 * fields).
 */
import { MESSAGES } from '../text/messages.js';
import { getLatestProjectsPanelData } from './projects-list-view.js';
import { renderSessionActionRow } from './session-row-view.js';
import type { OtherSessionDirectoryPanelRow } from '../state/projects-panel.js';

/** The currently open directory, or `null` — a module-level binding (same pattern
 * `electron/adopt-flow-view.ts#state` already uses for its own single-flight dialog state), since
 * only one of these can be open at a time. */
let openDir: string | null = null;

function dialog(): HTMLDialogElement {
  return document.getElementById('other-sessions-dir-dialog') as HTMLDialogElement;
}

function findGroup(dir: string): OtherSessionDirectoryPanelRow | undefined {
  return getLatestProjectsPanelData().otherSessionsByDirectory.find((group) => group.dir === dir);
}

function renderGroup(group: OtherSessionDirectoryPanelRow): void {
  (document.getElementById('other-sessions-dir-dialog-title') as HTMLElement).textContent =
    MESSAGES.otherSessionsDirDialogTitle(group.dir);
  const list = document.getElementById('other-sessions-dir-dialog-sessions') as HTMLElement;
  list.textContent = '';
  for (const row of group.sessions) {
    list.appendChild(renderSessionActionRow(row));
  }
}

function closeDialog(): void {
  openDir = null;
  const element = dialog();
  if (element.open) {
    element.close();
  }
}

/** PO acceptance of V2-T55, correction 3 (2026-09-25) — starting an adoption FROM this modal
 * (`electron/adopt-flow-view.ts`'s own click delegation on `#other-sessions-dir-dialog-sessions`)
 * closes this dialog first, so the adopt picker never opens stacked on top of an already-open
 * modal, and this dialog's own `close` event (`dialog-focus-return.ts`) fires exactly once for
 * the whole interaction. Exported only for that one caller. */
export function closeOtherSessionsDirDialog(): void {
  closeDialog();
}

function openDialog(dir: string): void {
  const group = findGroup(dir);
  if (group === undefined) {
    return;
  }
  openDir = dir;
  renderGroup(group);
  const element = dialog();
  if (!element.open) {
    element.showModal();
  }
}

/**
 * Called after every `projectsUpdate` push — keeps an OPEN modal's session list current (a
 * session's state/last activity can change on the next refresh tick, and adopting one from inside
 * this very dialog changes the count) and closes it if the directory has no "other" sessions left
 * at all (every one of them got adopted, or aged past discovery). A closed dialog is a no-op.
 */
export function refreshOtherSessionsDirDialog(): void {
  if (openDir === null) {
    return;
  }
  const group = findGroup(openDir);
  if (group === undefined) {
    closeDialog();
    return;
  }
  renderGroup(group);
}

/** Wired once, at startup, from `electron/project-panel-view.ts#wireProjectPanel` — AFTER
 * `wireProjectsListView`, so `getLatestProjectsPanelData()` is already current by the time this
 * file's own `onProjectsUpdate` listener runs (IPC listeners fire in registration order). */
export function wireOtherSessionsDirDialog(): void {
  (document.getElementById('other-sessions-dir-dialog-close') as HTMLButtonElement).textContent =
    MESSAGES.otherSessionsDirDialogClose;

  document.getElementById('other-sessions-list')?.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      '.other-sessions-dir-row',
    );
    const dir = button?.dataset.dir;
    if (dir !== undefined) {
      openDialog(dir);
    }
  });

  document.getElementById('other-sessions-dir-dialog-close')?.addEventListener('click', () => {
    closeDialog();
  });
  dialog().addEventListener('cancel', () => {
    closeDialog();
  });

  window.seeya.onProjectsUpdate(() => refreshOtherSessionsDirDialog());
}
