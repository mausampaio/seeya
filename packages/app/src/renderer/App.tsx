/**
 * V2-T62 (D-051): the window's skeleton, as Preact markup instead of the static HTML `index.html`
 * used to carry. Reorganized by D-052 (V2-T75) into real components: the lateral is
 * `renderer/features/sidebar/Sidebar.tsx` now (its own file, its own hooks, its own CSS module —
 * that component's own docstring has the full "what moved" story), mounted here alongside the
 * toolbar/terminal-host tree, which stays exactly as it was (legacy, not this task's region) — the
 * `*-view.ts` modules under `renderer/legacy/` keep working unchanged against the SAME ids this
 * file still renders for them (`docs/ARQUITETURA.md`'s own "D-052: o que ainda não é reescrito
 * fica numa pasta marcada como legado").
 *
 * This file itself never touches the DOM imperatively (D-052's own rule for the skeleton) — the
 * one piece of state it owns, `collapsed`, comes from `useSidebarCollapse` (shared with `<Sidebar/>`
 * itself, since the button that REOPENS the lateral necessarily lives outside it, in the toolbar).
 */
import { Button } from './components/Button/index.js';
import { IconButton } from './components/IconButton/index.js';
import { MESSAGES } from '../text/messages.js';
import { sidebarToggleButtonLabel } from '../state/sidebar-collapse.js';
import { DialogsShell } from './legacy/dialogs-shell.js';
import { Sidebar, useSidebarCollapse } from './features/sidebar/index.js';

export function AppShell() {
  const { collapsed, toggle } = useSidebarCollapse();
  const toggleLabel = sidebarToggleButtonLabel(collapsed);

  return (
    <>
      <div id="app">
        <Sidebar collapsed={collapsed} onToggleCollapse={toggle} />
        <main id="main">
          <div id="toolbar">
            <IconButton
              id="sidebar-toggle-button"
              variant="ghost"
              aria-label={toggleLabel.tooltip}
              onClick={toggle}
            >
              {toggleLabel.glyph}
            </IconButton>
            <Button id="new-tab-button" variant="ghost">
              +
            </Button>
            <div id="tab-strip"></div>
            <Button id="settings-button" variant="secondary">
              {MESSAGES.settingsButton}
            </Button>
          </div>
          <form id="command-bar" hidden>
            <label>
              Command
              <input
                id="command-bar-command"
                type="text"
                placeholder="claude, codex, or leave blank for a shell"
              />
            </label>
            <label>
              Directory
              <input id="command-bar-cwd" type="text" placeholder="Working directory" />
            </label>
            <button type="submit">Open</button>
            <button id="command-bar-cancel" type="button">
              Cancel
            </button>
          </form>
          <div id="terminal-host">
            <div id="page-today" class="page-pane" hidden>
              <div id="today-panel"></div>
            </div>
            <div id="page-projects" class="page-pane" hidden>
              <h2>Projects</h2>
              <div id="projects-list"></div>
              <p id="project-open-result-text"></p>
            </div>
            <div id="page-sessions" class="page-pane" hidden>
              <h2>Other sessions</h2>
              <ul id="other-sessions-list"></ul>
              <form id="session-search-form">
                <label id="session-search-label" for="session-search-input"></label>
                <input id="session-search-input" type="text" />
                <button type="submit" id="session-search-button"></button>
              </form>
              <p id="session-search-message"></p>
              <ul id="session-search-result"></ul>
            </div>
          </div>
        </main>
      </div>
      <DialogsShell />
    </>
  );
}
