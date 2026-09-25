/**
 * The "Projects" section's own entry point (V2-T30, extended by V2-T55) — `renderer.ts#main` calls
 * only `wireProjectPanel()`, so that already thousand-line file grows by exactly one import and one
 * call (the task's own "renderer.ts e main.ts não crescem"). This file itself owns no DOM/decision
 * of its own: it wires the single-responsibility pieces the section is actually made of (PO
 * review, 2026-09-25 — the original single file grew past the 500-line ceiling the task's own spec
 * called out):
 *
 * - `sidebar-collapse-view.ts` — the lateral's open/collapsed toggle (item 2).
 * - `projects-list-view.ts` — the "Projects"/"Other sessions" lists and a project's "Open" button
 *   (items 1/3).
 * - `new-project-dialog-view.ts` — "New project…" (item 4).
 * - `project-lock-confirm-dialog-view.ts` — the read-only-open confirmation (item 3).
 * - `adopt-flow-view.ts` — the whole "Adopt…" flow (item 5).
 * - `other-sessions-dir-dialog-view.ts` — the directory modal a "Other sessions" row opens
 *   (V2-T55 item 3). Wired AFTER `projectsListView` on purpose: its own `onProjectsUpdate`
 *   listener reads `getLatestProjectsPanelData()`, which that earlier registration is what keeps
 *   current — IPC listeners fire in registration order, so this one always sees this tick's data.
 * - `session-search-view.ts` — the id-search field (V2-T55 item 4).
 * - `sidebar-resize-view.ts` — the sidebar's draggable width (PO acceptance of V2-T55,
 *   correction 2).
 */
import { wireSidebarCollapse } from './sidebar-collapse-view.js';
import { wireSidebarResize } from './sidebar-resize-view.js';
import { wireProjectsListView } from './projects-list-view.js';
import { wireNewProjectDialog } from './new-project-dialog-view.js';
import { wireProjectLockConfirmDialog } from './project-lock-confirm-dialog-view.js';
import { wireAdoptFlow } from './adopt-flow-view.js';
import { wireOtherSessionsDirDialog } from './other-sessions-dir-dialog-view.js';
import { wireSessionSearchView } from './session-search-view.js';

/** Wired once, at startup, from `renderer.ts#main`. */
export function wireProjectPanel(): void {
  wireSidebarCollapse();
  wireSidebarResize();
  wireProjectsListView();
  wireNewProjectDialog();
  wireProjectLockConfirmDialog();
  wireAdoptFlow();
  wireOtherSessionsDirDialog();
  wireSessionSearchView();
}
