/**
 * V2-T62 (D-051): the window's skeleton (lateral + barra de abas) as Preact markup instead of the
 * static HTML `index.html` used to carry — SAME ids, SAME classes, SAME nesting as before, no
 * region redesigned (that is the next tarefa, `docs/INTERFACE.md` item 2 onward). Mounted ONCE by
 * `renderer.ts#main`, before any `wire*` function runs — every existing `document.getElementById`/
 * `querySelectorAll` call in the `*-view.ts` modules keeps working unchanged, because this is
 * still a real DOM tree with the same ids, just built by Preact instead of the HTML parser.
 *
 * **V2-T63 (`docs/INTERFACE.md` § 1) redesigned the lateral and the footer.** What moved:
 * - The status panel (`#status-panel`) is GONE from the tree — its useful content lives in the
 *   footer (agenda, daemon) now; `main.ts` still computes/pushes the text (harmless, nothing
 *   listens) — removing that push too is a small follow-up left for whoever next touches that
 *   file, not this task's own scope.
 * - `#today-panel`, `#projects-list`/`#project-open-result-text`,
 *   `#other-sessions-list`/`#session-search-*` all kept their OWN ids and inner markup untouched
 *   (their view modules — `today-panel-view.ts`/`projects-list-view.ts`/
 *   `other-sessions-dir-dialog-view.ts`/`session-search-view.ts` — needed zero changes) but moved
 *   into the three page panes (`#page-today`/`#page-projects`/`#page-sessions`,
 *   `electron/page-tab-strip.ts`) that "All projects"/"Sessions"/the Today card now open as tabs
 *   — `docs/INTERFACE.md` § 1's own "pode continuar sendo o conteúdo atual dentro de uma aba de
 *   página", the PO's refinement comment on the task: nothing shown today disappears, it only
 *   moves from a fixed sidebar region to a tab, same mechanism a terminal tab already uses.
 * - `#ignored-projects-heading`/`#ignored-projects-list` STAY in the lateral itself (§ 1 item 5
 *   names them as a lateral bullet of their own, not part of the Projects tab in this task).
 * - `#settings-button` moved from the footer into the toolbar's own right edge — § 1's footer
 *   list (end of day / snooze+skip / end day / daemon pill) doesn't include it, and § 2 already
 *   says where it belongs ("Settings fica no canto direito da barra"); moving it now is a
 *   one-line relocation, not a redesign of the tab bar itself (still V2-T64's job).
 *
 * **Correction (2026-09-30, real-window screenshot review against `docs/INTERFACE.md` § 1) fixed
 * a layout bug the first pass introduced:** `#sidebar` is `display: flex` (its own collapse
 * strip needs to sit BESIDE the rest), so putting `#sidebar-content`/`#sidebar-footer` directly
 * inside it made them two more flex ROW items — a two-column lateral instead of one, with the
 * footer beside the list instead of under it. `#sidebar-main` (new) wraps the header/content/
 * footer as a single flex COLUMN; `#sidebar` itself now only ever has two row items, the collapse
 * strip and this one wrapper. The collapse toggle also moved OUT of that always-visible strip
 * (a `seeya-button--primary` icon button stretched full-height read as a "violet bar", not a
 * button) and into `#sidebar-header`, a small ghost icon button next to the logo — collapsing now
 * only ever happens from there or `Ctrl+B`; reopening is the toolbar's own `#sidebar-toggle-button`
 * (already always visible, open or collapsed) — `docs/INTERFACE.md`'s own "o botão da barra de
 * abas a reabre".
 */
import { Button } from '../ui/button.js';
import { DialogsShell } from './dialogs-shell.js';

export function AppShell() {
  return (
    <>
      <div id="app">
        <aside id="sidebar">
          <div id="sidebar-main">
            <div id="sidebar-header">
              <div id="sidebar-logo">
                <img id="sidebar-logo-light" src="logo/seeya-logo.svg" alt="seeya" />
                <img id="sidebar-logo-dark" src="logo/seeya-logo-on-dark.svg" alt="seeya" />
              </div>
              <Button
                id="sidebar-collapse-toggle"
                variant="ghost"
                iconOnly
                aria-label="Collapse sidebar"
              >
                ‹
              </Button>
            </div>
            <div id="sidebar-content">
              <button id="today-card" type="button"></button>

              <section id="favorites-section">
                <div class="sidebar-section-header">
                  <h2>Favorites</h2>
                  <button id="new-project-button" type="button"></button>
                </div>
                <ul id="favorites-list"></ul>
              </section>

              <section id="recent-section">
                <h2>Recent</h2>
                <ul id="recent-list"></ul>
              </section>

              <button id="all-projects-link" class="sidebar-nav-row" type="button">
                <span class="sidebar-nav-icon" aria-hidden="true"></span>
                <span class="sidebar-nav-label"></span>
                <span class="sidebar-nav-count"></span>
              </button>

              <h2 id="ignored-projects-heading" hidden>
                Ignored projects
              </h2>
              <ul id="ignored-projects-list" hidden></ul>

              <button id="sessions-link" class="sidebar-nav-row" type="button">
                <span class="sidebar-nav-icon" aria-hidden="true"></span>
                <span class="sidebar-nav-label"></span>
                <span class="sidebar-nav-count"></span>
              </button>
            </div>

            <div id="sidebar-footer">
              <div id="schedule-strip">
                <p id="schedule-strip-text"></p>
                <div id="schedule-strip-actions">
                  <select id="schedule-strip-snooze" hidden>
                    <option value="" selected disabled hidden>
                      Snooze ▾
                    </option>
                  </select>
                  <button id="schedule-strip-skip" type="button" hidden></button>
                </div>
              </div>
              <Button id="end-day-button" />
              <div id="daemon-pill">
                <span id="daemon-pill-dot"></span>
                <span id="daemon-pill-label"></span>
                <Button
                  id="daemon-control-button"
                  variant="ghost"
                  iconOnly
                  aria-label="Start daemon"
                />
              </div>
              <p id="daemon-control-result"></p>
              <Button id="autostart-control-button" variant="secondary" hidden />
              <p id="autostart-control-result"></p>
            </div>
          </div>
        </aside>
        <div id="sidebar-resize-handle"></div>
        <main id="main">
          <div id="toolbar">
            <Button id="sidebar-toggle-button" variant="ghost" />
            <Button id="new-tab-button" variant="ghost">
              +
            </Button>
            <div id="tab-strip"></div>
            <Button id="settings-button" variant="secondary" />
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
