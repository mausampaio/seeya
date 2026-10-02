/**
 * The "Projects" section's own entry point (V2-T30, extended by V2-T55, reworked by V2-T67/V2-T68)
 * — `renderer.tsx#main` calls only `wireProjectPanel()`, so that already thousand-line file grows
 * by exactly one import and one call (the task's own "renderer.ts e main.ts não crescem"). This
 * file itself owns no DOM/decision of its own: it wires the single-responsibility pieces the
 * section is actually made of (PO review, 2026-09-25 — the original single file grew past the
 * 500-line ceiling the task's own spec called out):
 *
 * - `projects-panel-cache.ts` — the cached `ProjectsPanelData` push (`adopt-flow-view.ts`'s own
 *   "Existing project" dropdown) and the "Open" trigger reused outside `renderer/features/
 *   projects/` (V2-T67 — the Projects tab's OWN rendering is a real component now,
 *   `renderer/features/tabs/TabStrip.tsx`'s own `<Projects/>`, no longer wired from here).
 * - `ignored-projects-view.ts` — the sidebar's "Ignored projects" list (V2-T68: renamed from
 *   `other-sessions-and-ignored-view.ts`, which also used to render the Sessions page pane's own
 *   "Other sessions" directory list — that half is `renderer/features/sessions/` now, a real
 *   component).
 * - `project-lock-confirm-dialog-view.ts` — the read-only-open confirmation (item 3).
 * - `project-leftover-changes-confirm-dialog-view.ts` — the leftover-uncommitted-changes
 *   confirmation (V2-T34 production defect, PO review 2026-09-25 — the window never asked this at
 *   all before).
 * - `adopt-flow-view.ts` — the whole "Adopt…" flow (item 5) — V2-T68: also exports
 *   `openAdoptPicker`, the Sessions tab's own entry point into this same flow.
 *
 * D-052: the lateral's own open/collapsed toggle, draggable width, Today card/Favorites/Recent/
 * "All projects"/"Sessions" (V2-T75), the Projects tab itself (V2-T67, `renderer/features/
 * projects/`), the Sessions tab itself (V2-T68, `renderer/features/sessions/`, which replaces the
 * directory modal and the id-search field this file used to wire), and "New project…" (V2-T67,
 * `renderer/features/projects/NewProjectDialog/`, mounted by `App.tsx`, opened from both the
 * sidebar's `+` and the Projects tab's own button through `new-project-dialog-bridge.ts`) are real
 * components now — this file no longer wires any of them.
 */
import { wireProjectsPanelCache } from './projects-panel-cache.js';
import { wireIgnoredProjectsView } from './ignored-projects-view.js';
import { wireProjectLockConfirmDialog } from './project-lock-confirm-dialog-view.js';
import { wireLeftoverChangesConfirmDialog } from './project-leftover-changes-confirm-dialog-view.js';
import { wireAdoptFlow } from './adopt-flow-view.js';

/** Wired once, at startup, from `renderer.tsx#main`. */
export function wireProjectPanel(): void {
  wireProjectsPanelCache();
  wireIgnoredProjectsView();
  wireProjectLockConfirmDialog();
  wireLeftoverChangesConfirmDialog();
  wireAdoptFlow();
}
