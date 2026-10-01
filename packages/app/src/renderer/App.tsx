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
import { IconButton } from './components/IconButton/index.js';
import { sidebarToggleButtonLabel } from '../state/sidebar-collapse.js';
import { DialogsShell } from './legacy/dialogs-shell.js';
import { Sidebar, useSidebarCollapse } from './features/sidebar/index.js';
import { TabStrip } from './features/tabs/index.js';

export function AppShell() {
  const { collapsed, toggle } = useSidebarCollapse();
  const toggleLabel = sidebarToggleButtonLabel(collapsed);

  return (
    <>
      <div id="app">
        <Sidebar collapsed={collapsed} onToggleCollapse={toggle} />
        <main id="main">
          <TabStrip
            leading={
              <IconButton
                id="sidebar-toggle-button"
                variant="ghost"
                aria-label={toggleLabel.tooltip}
                onClick={toggle}
              >
                {toggleLabel.glyph}
              </IconButton>
            }
          />
        </main>
      </div>
      <DialogsShell />
    </>
  );
}
