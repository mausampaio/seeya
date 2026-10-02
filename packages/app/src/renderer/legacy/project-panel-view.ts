/**
 * The "Projects" section's own entry point (V2-T30, extended by V2-T55, reworked by V2-T67) —
 * `renderer.tsx#main` calls only `wireProjectPanel()`, so that already thousand-line file grows by
 * exactly one import and one call (the task's own "renderer.ts e main.ts não crescem"). This file
 * itself owns no DOM/decision of its own: it wires the single-responsibility pieces the section is
 * actually made of (PO review, 2026-09-25 — the original single file grew past the 500-line
 * ceiling the task's own spec called out):
 *
 * - `projects-panel-cache.ts` — the cached `ProjectsPanelData` push (`adopt-flow-view.ts`'s own
 *   "Existing project" dropdown, `other-sessions-dir-dialog-view.ts`'s own directory lookup) and
 *   the "Open" trigger reused outside `renderer/features/projects/` (V2-T67 — the Projects tab's
 *   OWN rendering is a real component now, `renderer/features/tabs/TabStrip.tsx`'s own `<Projects/>`,
 *   no longer wired from here).
 * - `other-sessions-and-ignored-view.ts` — the sidebar's "Ignored projects" list and the Sessions
 *   page pane's "Other sessions" directory list (V2-T67: split out of the deleted
 *   `renderer/legacy/projects-list-view.tsx`, neither one this task's own region).
 * - `project-lock-confirm-dialog-view.ts` — the read-only-open confirmation (item 3).
 * - `project-leftover-changes-confirm-dialog-view.ts` — the leftover-uncommitted-changes
 *   confirmation (V2-T34 production defect, PO review 2026-09-25 — the window never asked this at
 *   all before).
 * - `adopt-flow-view.ts` — the whole "Adopt…" flow (item 5).
 * - `other-sessions-dir-dialog-view.ts` — the directory modal a "Other sessions" row opens
 *   (V2-T55 item 3). Wired AFTER `wireProjectsPanelCache` on purpose: its own `onProjectsUpdate`
 *   listener reads `getLatestProjectsPanelData()`, which that earlier registration is what keeps
 *   current — IPC listeners fire in registration order, so this one always sees this tick's data.
 * - `session-search-view.ts` — the id-search field (V2-T55 item 4).
 *
 * D-052: the lateral's own open/collapsed toggle, draggable width, Today card/Favorites/Recent/
 * "All projects"/"Sessions" (V2-T75), the Projects tab itself (V2-T67, `renderer/features/
 * projects/`), and "New project…" (V2-T67, `renderer/features/projects/NewProjectDialog/`, mounted
 * by `App.tsx`, opened from both the sidebar's `+` and the Projects tab's own button through
 * `new-project-dialog-bridge.ts`) are real components now — this file no longer wires any of them.
 */
import { wireProjectsPanelCache } from './projects-panel-cache.js';
import { wireOtherSessionsAndIgnoredView } from './other-sessions-and-ignored-view.js';
import { wireProjectLockConfirmDialog } from './project-lock-confirm-dialog-view.js';
import { wireLeftoverChangesConfirmDialog } from './project-leftover-changes-confirm-dialog-view.js';
import { wireAdoptFlow } from './adopt-flow-view.js';
import { wireOtherSessionsDirDialog } from './other-sessions-dir-dialog-view.js';
import { wireSessionSearchView } from './session-search-view.js';

/** Wired once, at startup, from `renderer.tsx#main`. */
export function wireProjectPanel(): void {
  wireProjectsPanelCache();
  wireOtherSessionsAndIgnoredView();
  wireProjectLockConfirmDialog();
  wireLeftoverChangesConfirmDialog();
  wireAdoptFlow();
  wireOtherSessionsDirDialog();
  wireSessionSearchView();
}
