/**
 * V2-T62 (D-051): the window's skeleton (lateral + barra de abas) as Preact markup instead of the
 * static HTML `index.html` used to carry — SAME ids, SAME classes, SAME nesting as before, no
 * region redesigned (that is the next tarefa, `docs/INTERFACE.md` item 2 onward). Mounted ONCE by
 * `renderer.ts#main`, before any `wire*` function runs — every existing `document.getElementById`/
 * `querySelectorAll` call in the `*-view.ts` modules keeps working unchanged, because this is
 * still a real DOM tree with the same ids, just built by Preact instead of the HTML parser.
 *
 * The sidebar's own CONTENT (project list, Today panel, status panel, schedule strip...) stays as
 * empty containers here, exactly like `index.html` had them — each one is still filled
 * imperatively by its own view module (`project-panel-view.ts`, `today-panel-view.ts`, ...),
 * "montado temporariamente dentro do esqueleto, sem redesenho" (this task's own instructions).
 */
import { Button } from '../ui/button.js';
import { DialogsShell } from './dialogs-shell.js';

export function AppShell() {
  return (
    <>
      <div id="app">
        <aside id="sidebar">
          <Button id="sidebar-collapse-toggle" iconOnly aria-label="Collapse sidebar">
            ‹
          </Button>
          <div id="sidebar-content">
            <h2>Projects</h2>
            <button id="new-project-button" type="button"></button>
            <div id="projects-list"></div>
            <p id="project-open-result-text"></p>
            <h2>Other sessions</h2>
            <ul id="other-sessions-list"></ul>
            <form id="session-search-form">
              <label id="session-search-label" for="session-search-input"></label>
              <input id="session-search-input" type="text" />
              <button type="submit" id="session-search-button"></button>
            </form>
            <p id="session-search-message"></p>
            <ul id="session-search-result"></ul>
            <h2>Today</h2>
            <div id="today-panel"></div>
            <h2>Status</h2>
            <pre id="status-panel"></pre>
            <div id="schedule-strip">
              <p id="schedule-strip-text"></p>
              <button id="schedule-strip-snooze-15" type="button" hidden></button>
              <button id="schedule-strip-snooze-30" type="button" hidden></button>
              <button id="schedule-strip-snooze-1h" type="button" hidden></button>
              <button id="schedule-strip-skip" type="button" hidden></button>
            </div>
            <Button id="end-day-button" />
            <Button id="daemon-control-button" variant="secondary" />
            <p id="daemon-control-result"></p>
            <Button id="autostart-control-button" variant="secondary" hidden />
            <p id="autostart-control-result"></p>
            <Button id="settings-button" variant="secondary" />
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
          <div id="terminal-host"></div>
        </main>
      </div>
      <DialogsShell />
    </>
  );
}
