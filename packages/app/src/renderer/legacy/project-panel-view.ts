/**
 * The "Projects" section's own entry point (V2-T30, extended by V2-T55, reworked by
 * V2-T67/V2-T68/V2-T70) — `renderer.tsx#main` calls only `wireProjectPanel()`, so that already
 * thousand-line file grows by exactly one import and one call (the task's own "renderer.ts e
 * main.ts não crescem"). This file itself owns no DOM/decision of its own: it wires the
 * single-responsibility pieces the section is actually made of (PO review, 2026-09-25 — the
 * original single file grew past the 500-line ceiling the task's own spec called out):
 *
 * - `projects-panel-cache.ts` — the cached `ProjectsPanelData` push (`renderer/features/adoption/
 *   useAdoption.ts`'s own "Existing project" dropdown) and the "Open" trigger reused outside
 *   `renderer/features/projects/` (V2-T67 — the Projects tab's OWN rendering is a real component
 *   now, `renderer/features/tabs/TabStrip.tsx`'s own `<Projects/>`, no longer wired from here).
 * - `ignored-projects-view.ts` — the sidebar's "Ignored projects" list (V2-T68: renamed from
 *   `other-sessions-and-ignored-view.ts`, which also used to render the Sessions page pane's own
 *   "Other sessions" directory list — that half is `renderer/features/sessions/` now, a real
 *   component).
 *
 * D-052: the lateral's own open/collapsed toggle, draggable width, Today card/Favorites/Recent/
 * "All projects"/"Sessions" (V2-T75), the Projects tab itself (V2-T67, `renderer/features/
 * projects/`), the Sessions tab itself (V2-T68, `renderer/features/sessions/`, which replaces the
 * directory modal and the id-search field this file used to wire), "New project…" (V2-T67,
 * `renderer/features/projects/NewProjectDialog/`, mounted by `App.tsx`, opened from both the
 * sidebar's `+` and the Projects tab's own button through `new-project-dialog-bridge.ts`), the
 * read-only-open/leftover-changes confirmations (V2-T71, `renderer/features/confirmations/
 * ProjectLockConfirmDialog`/`LeftoverChangesConfirmDialog`, also mounted by `App.tsx` — apagados
 * from here: `project-lock-confirm-dialog-view.ts`/`project-leftover-changes-confirm-dialog-view.ts`),
 * and the whole "Adopt…" flow (V2-T70, `renderer/features/adoption/`, also mounted by `App.tsx`,
 * replacing `adopt-flow-view.ts` entirely — apagado by that task) are real components now — this
 * file no longer wires any of them.
 */
import { wireProjectsPanelCache } from './projects-panel-cache.js';
import { wireIgnoredProjectsView } from './ignored-projects-view.js';

/** Wired once, at startup, from `renderer.tsx#main`. */
export function wireProjectPanel(): void {
  wireProjectsPanelCache();
  wireIgnoredProjectsView();
}
