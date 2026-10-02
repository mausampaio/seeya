/**
 * The sidebar's own "Ignored projects" list (`#ignored-projects-heading`/`#ignored-projects-list`,
 * V2-T72 item 2 — the static anchors live in `renderer/features/sidebar/NavList/NavList.tsx`, that
 * file's own docstring explains why they stay legacy-filled). Renamed from
 * `other-sessions-and-ignored-view.ts` by V2-T68: that file's OTHER half, the Sessions page pane's
 * own "Other sessions" directory list, is this task's own region now
 * (`renderer/features/sessions/`, which replaces it with real data instead of a DOM list) — this
 * file keeps only the part that was never this task's to touch, byte-identical behaviour, exactly
 * where it already was.
 */
import { MESSAGES } from '../../text/messages.js';
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

/** V2-T72 item 2: hidden entirely in the ordinary case (no ignored project) — an empty state here
 * would just be noise every time nothing is wrong. */
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

/** Wired once, at startup, from `electron/project-panel-view.ts#wireProjectPanel`, AFTER
 * `projects-panel-cache.ts`'s own listener (that file's own docstring explains why the order
 * matters). */
export function wireIgnoredProjectsView(): void {
  window.seeya.onProjectsUpdate((data: ProjectsUpdateEvent) =>
    renderIgnoredProjects(data.ignoredProjects),
  );
  // V2-T30 item 1's own reasoning still applies: the ambient refresh loop's first tick can race
  // ahead of this listener's own registration.
  void window.seeya.getProjectsPanel().then((data) => renderIgnoredProjects(data.ignoredProjects));
}
