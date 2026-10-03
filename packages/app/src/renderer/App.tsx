/**
 * V2-T62 (D-051): the window's skeleton, as Preact markup instead of the static HTML `index.html`
 * used to carry. Reorganized by D-052 (V2-T75) into real components: the lateral is
 * `renderer/features/sidebar/Sidebar.tsx` now, its own file, its own hooks, its own CSS module.
 * **V2-T64** does the same for the tab strip and its content area — `renderer/features/tabs/
 * TabStrip.tsx` now owns everything `#main` used to render directly (toolbar row, popover,
 * `#terminal-host`) — this file no longer carries any of that markup itself.
 *
 * This file itself never touches the DOM imperatively (D-052's own rule for the skeleton) — the
 * one piece of state it owns, `collapsed`, comes from `useSidebarCollapse` (shared with `<Sidebar/>`
 * itself, since the button that REOPENS the lateral necessarily lives outside it, in the tab
 * strip's own toolbar row — `TabStrip`'s own `leading` prop, its docstring explains why).
 */
import { useState } from 'preact/hooks';
import { IconButton } from './components/IconButton/index.js';
import { ChevronLeftIcon, ChevronRightIcon } from './components/Icon/index.js';
import { sidebarToggleButtonLabel } from '../state/sidebar-collapse.js';
import { DialogsShell } from './legacy/dialogs-shell.js';
import { Sidebar, useSidebarCollapse } from './features/sidebar/index.js';
import { TabStrip } from './features/tabs/index.js';
import { SettingsDialog } from './features/settings/index.js';
import { NewProjectDialog } from './features/projects/index.js';
import {
  ProjectLockConfirmDialog,
  LeftoverChangesConfirmDialog,
  ResumeFallbackDialog,
  DaemonOwnershipTransitionDialog,
  RevertAdoptionConfirmDialog,
  DeleteAdoptedCopyConfirmDialog,
  RemoveProjectConfirmDialog,
  ArchiveProjectConfirmDialog,
  UnarchiveProjectConfirmDialog,
} from './features/confirmations/index.js';
import { ProjectDetailsDialog } from './features/project-details/index.js';
import { AdoptionDialog } from './features/adoption/index.js';

export function AppShell() {
  const { collapsed, toggle } = useSidebarCollapse();
  const toggleLabel = sidebarToggleButtonLabel(collapsed);
  // V2-T65: Settings is a real component now (`renderer/features/settings/`), replacing
  // `renderer/legacy/settings-dialog-view.ts`'s own `document.getElementById('settings-dialog')
  // .showModal()`-by-id. Owned here, not inside `TabStrip` (which renders the trigger button) nor
  // inside `SettingsDialog` itself, because BOTH need it — same reasoning `useSidebarCollapse`'s
  // own docstring already gives for why `collapsed` lives here instead of inside `<Sidebar/>`.
  const [settingsOpen, setSettingsOpen] = useState(false);
  // V2-T64 PO review: a real icon, same size/weight as Favorites' own "+" (IconButton size="sm",
  // a 24px icon filling its 24px box exactly, identity § 6.4's own preferred grid) — the `«`/`»`
  // text glyphs this button used before read as plain characters, not iconography, at this size.
  const ToggleIcon = toggleLabel.icon === 'collapse' ? ChevronLeftIcon : ChevronRightIcon;

  return (
    <>
      <div id="app">
        <Sidebar collapsed={collapsed} onToggleCollapse={toggle} />
        <main id="main">
          <TabStrip
            // PO review (2026-10-01, docs/INTERFACE.md's own "Um botão de recolher por vez"): this
            // button ONLY reopens a COLLAPSED lateral — while it's open, the lateral's own header
            // button (`Sidebar.tsx#sidebar-collapse-toggle`) is the only one on screen. Showing
            // both at once ("os dois juntos na tela confundem", same doc) was the defect: before
            // this review, `leading` was always rendered regardless of `collapsed`.
            leading={
              collapsed ? (
                <IconButton
                  id="sidebar-toggle-button"
                  size="sm"
                  variant="ghost"
                  aria-label={toggleLabel.tooltip}
                  onClick={toggle}
                >
                  <ToggleIcon size={24} />
                </IconButton>
              ) : undefined
            }
            onOpenSettings={() => setSettingsOpen(true)}
          />
        </main>
      </div>
      <DialogsShell />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {/* V2-T67: mounted here, not inside the Projects tab itself — `Projects.tsx`'s own
       * docstring explains why a `<dialog>` inside a possibly-`display:none` page pane never
       * shows via `.showModal()`. Opened from both the sidebar's own `+`
       * (`FavoritesSection.tsx`) and this tab's own "New project" button through
       * `new-project-dialog-bridge.ts`. */}
      <NewProjectDialog />
      {/* V2-T71: four more confirmations mounted here, same "owns its own open/closed state,
       * driven by its own IPC subscription" shape `NewProjectDialog` above already established —
       * replaces four static anchors `DialogsShell` used to carry (`project-lock-confirm-dialog`,
       * `leftover-changes-confirm-dialog`, `fallback-dialog`, `daemon-ownership-transition-dialog`,
       * all apagados from `legacy/dialogs-shell.tsx` by this task). */}
      <ProjectLockConfirmDialog />
      <LeftoverChangesConfirmDialog />
      <ResumeFallbackDialog />
      <DaemonOwnershipTransitionDialog />
      {/* V2-T70: same "mounted outside any possibly-hidden page pane" reasoning as
       * `<NewProjectDialog/>` above — opened from the Sessions tab's own `Adopt…` button through
       * `features/adoption/adoption-dialog-bridge.ts`. */}
      <AdoptionDialog />
      {/* V2-T83: "Project details" (`docs/INTERFACE.md` § 4a) and the three confirmations its
       * actions trigger — mounted here for the same reason as the dialogs above: a `<dialog>`
       * inside the Projects tab's own (possibly hidden) page pane would never show. Opened from
       * the row's `Manage project` button through `features/project-details/
       * project-details-bridge.ts`. */}
      <ProjectDetailsDialog />
      <RevertAdoptionConfirmDialog />
      <DeleteAdoptedCopyConfirmDialog />
      <RemoveProjectConfirmDialog />
      {/* V2-T84: the archive/unarchive confirmations — opened through
       * `features/confirmations/archive-confirm-bridge.ts` from the Project details dialog and
       * the Projects tab's `Unarchive…`, mounted here for the same hidden-pane reason. */}
      <ArchiveProjectConfirmDialog />
      <UnarchiveProjectConfirmDialog />
    </>
  );
}
