/**
 * A cached copy of the latest `ProjectsPanelData` push (V2-T30 item 1), read by TWO legacy,
 * Sessions/Adopt-flow modules untouched by V2-T67 — `adopt-flow-view.ts`'s own "Existing project"
 * dropdown and `other-sessions-dir-dialog-view.ts`'s own directory lookup. Split out of the
 * now-deleted `renderer/legacy/projects-list-view.tsx` (V2-T67: the Projects tab's OWN rendering
 * moved to `renderer/features/projects/`, with its own independent `onProjectsUpdate`
 * subscription in `useProjects.ts`) so these two callers keep a cache to read without pulling in
 * any rendering code that no longer exists.
 */
import type { ProjectsPanelData } from '../../state/projects-panel.js';
import type { ProjectsUpdateEvent } from '../../ipc/channels.js';

let latestProjectsPanelData: ProjectsPanelData = {
  projects: [],
  otherSessionsByDirectory: [],
  ignoredProjects: [],
};

/** `adopt-flow-view.ts`'s/`other-sessions-dir-dialog-view.ts`'s own read of the latest push — kept
 * as a function, not an export of the mutable binding itself, so nothing outside this file can
 * reassign it. */
export function getLatestProjectsPanelData(): ProjectsPanelData {
  return latestProjectsPanelData;
}

/** Wired once, at startup, from `electron/project-panel-view.ts#wireProjectPanel` — keeps the
 * cache current without rendering anything. */
export function wireProjectsPanelCache(): void {
  window.seeya.onProjectsUpdate((data: ProjectsUpdateEvent) => {
    latestProjectsPanelData = data;
  });
  // V2-T30 item 1's own reasoning still applies: the ambient refresh loop's first tick can race
  // ahead of this listener's own registration, so this cache needs an explicit first read too —
  // `renderer/features/projects/useProjects.ts` has its own independent one for the Projects tab.
  void window.seeya.getProjectsPanel().then((data) => {
    latestProjectsPanelData = data;
  });
}

/**
 * Fire-and-forget "Open" trigger, reused by `adopt-flow-view.ts`'s own post-adoption "Open
 * project" button (V2-T30 items 3/5) — identical to what `renderer/legacy/projects-list-view.tsx`
 * (deleted by this task) did, UNCHANGED behaviour: the Projects tab's own row actions call
 * `window.seeya.openProject` directly instead now (`useProjects.ts`), tracking their own pending
 * state, so this stays only for the one caller outside that feature. `#project-open-result-text`
 * is a leftover `<p>` sibling of `<Projects/>` in `TabStrip.tsx` (that file's own docstring
 * explains why it's kept, out of this task's scope to redesign) — never awaited by its own caller
 * (Q-087 item 3's own "a janela não fica bloqueada"), and an unexpected rejection still never
 * fails silently (V2-T34 production defect).
 */
export function triggerProjectOpen(projectId: string): void {
  const resultText = document.getElementById('project-open-result-text') as HTMLElement;
  resultText.textContent = '';
  void window.seeya
    .openProject({ projectId })
    .then((response) => {
      resultText.textContent = response.outcomeText;
    })
    .catch((error: unknown) => {
      resultText.textContent = `seeya: open failed unexpectedly (${error instanceof Error ? error.message : String(error)}).`;
    });
}
