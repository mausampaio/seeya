/**
 * The sidebar's own "Ignored projects" list (`#ignored-projects-heading`/`#ignored-projects-list`,
 * V2-T72 item 2 — the static anchors live in `renderer/features/sidebar/NavList/NavList.tsx`, that
 * file's own docstring explains why they stay legacy-filled) and the Sessions page pane's own
 * "Other sessions" directory list (`#other-sessions-list`, V2-T55 item 2) — split out of the
 * now-deleted `renderer/legacy/projects-list-view.tsx` by V2-T67 ("se hoje elas dividem arquivo com
 * Projects, separe sem mudar o comportamento de Sessions"): that file rendered these two AND the
 * Projects tab's own `#projects-list` from one combined function; the Projects tab is a real,
 * reactive component now (`renderer/features/projects/`), but these two are neither this task's
 * region NOR the Sessions tab's own task (V2-T68) yet — kept here, byte-identical behaviour,
 * exactly where they were before this task touched anything.
 *
 * `wireOtherSessionsAndIgnoredView` registers its OWN `onProjectsUpdate` listener, independent of
 * `projects-panel-cache.ts`'s own — `onProjectsUpdate` supports any number of listeners, and
 * `electron/project-panel-view.ts#wireProjectPanel` still registers the cache's listener FIRST, so
 * `other-sessions-dir-dialog-view.ts`'s own "the cache is already current by the time my own
 * listener runs" guarantee is unaffected by this split.
 */
import { MESSAGES } from '../../text/messages.js';
import { shortenDirectoryPath } from '../../sidebar/directory-label.js';
import type { IgnoredProjectPanelRow } from '../../state/projects-panel.js';
import type { ProjectsUpdateEvent } from '../../ipc/channels.js';

/** V2-T72 item 2 — a project whose `seeya.json` failed to parse/validate, id and reason, the same
 * information `seeya project list`'s own "Ignored entries" already prints.
 *
 * PO review round 1 (V2-T67): `row.reason` already arrives short and `~`-abbreviated
 * (`state/projects-panel.ts#toIgnoredProjectRow`, `state/error-reason-summary.ts`) — this row used
 * to show the RAW, often path-laden message, turning into an eight-line block in the narrow
 * sidebar. `title` carries `row.fullReason` (the untouched original), only when it actually
 * differs — the same `text !== fullText` convention the Projects tab's own
 * `IgnoredProjectsSection.tsx` uses for the identical fact. */
function renderIgnoredProjectRow(row: IgnoredProjectPanelRow): HTMLLIElement {
  const item = document.createElement('li');
  const label = MESSAGES.ignoredProjectRowLabel(row.projectId, row.reason);
  const fullLabel = MESSAGES.ignoredProjectRowLabel(row.projectId, row.fullReason);
  item.textContent = label;
  if (label !== fullLabel) {
    item.title = fullLabel;
  }
  return item;
}

/** V2-T55 item 2 — one row per directory, never one per session: clicking it opens the modal
 * (`electron/other-sessions-dir-dialog-view.ts`, wired independently — this button only carries
 * `data-dir`, the key that modal looks the group back up by in `getLatestProjectsPanelData()`). */
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

/** V2-T72 item 2: hidden entirely in the ordinary case (no ignored project) — unlike "Other
 * sessions" below, an empty state here would just be noise every time nothing is wrong. */
function renderIgnoredProjects(ignoredProjects: readonly IgnoredProjectPanelRow[]): void {
  const ignoredHeading = document.getElementById('ignored-projects-heading') as HTMLElement;
  const ignoredList = document.getElementById('ignored-projects-list') as HTMLElement;
  ignoredList.textContent = '';
  const hasIgnored = ignoredProjects.length > 0;
  ignoredHeading.hidden = !hasIgnored;
  ignoredList.hidden = !hasIgnored;
  for (const ignored of ignoredProjects) {
    ignoredList.appendChild(renderIgnoredProjectRow(ignored));
  }
}

function renderOtherSessions(
  otherSessionsByDirectory: ProjectsUpdateEvent['otherSessionsByDirectory'],
): void {
  const otherList = document.getElementById('other-sessions-list') as HTMLElement;
  otherList.textContent = '';
  if (otherSessionsByDirectory.length === 0) {
    const empty = document.createElement('li');
    empty.id = 'other-sessions-empty';
    empty.textContent = MESSAGES.otherSessionsEmpty;
    otherList.appendChild(empty);
    return;
  }
  for (const group of otherSessionsByDirectory) {
    otherList.appendChild(renderOtherSessionsDirectoryRow(group));
  }
}

function renderOtherSessionsAndIgnored(data: ProjectsUpdateEvent): void {
  renderIgnoredProjects(data.ignoredProjects);
  renderOtherSessions(data.otherSessionsByDirectory);
}

/** Wired once, at startup, from `electron/project-panel-view.ts#wireProjectPanel`, AFTER
 * `projects-panel-cache.ts`'s own listener (that file's own docstring explains why the order
 * matters). */
export function wireOtherSessionsAndIgnoredView(): void {
  window.seeya.onProjectsUpdate((data: ProjectsUpdateEvent) => renderOtherSessionsAndIgnored(data));
  // V2-T30 item 1's own reasoning still applies: the ambient refresh loop's first tick can race
  // ahead of this listener's own registration.
  void window.seeya.getProjectsPanel().then((data) => renderOtherSessionsAndIgnored(data));
}
