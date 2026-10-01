/**
 * The tab strip and its content area (V2-T64, `docs/INTERFACE.md` § 2) — replaces
 * `renderer/legacy/tabs-view.ts`/`renderer/legacy/page-tab-strip.ts` (apagados by this task) and
 * the static command-bar/toolbar markup `App.tsx` used to carry directly. Owns the whole toolbar
 * row (the "+" button, every open tab, Settings) AND `#terminal-host` below it — the two were
 * always one region in the legacy file too (`tabs-view.ts`'s own `showTab` already hid/showed
 * BOTH kinds of pane through one function), so splitting them across two components here would
 * only recreate the coupling with extra prop-drilling.
 *
 * **What's still static, unmoved markup inside `#terminal-host`.** The Today/Projects/Sessions
 * page panes (`#page-today`/`#page-projects`/`#page-sessions` and everything inside each) are NOT
 * this task's region (`docs/INTERFACE.md` §§ 3–5 are separate, later tasks) — same ids, same
 * nesting, unchanged, so `renderer/legacy/today-panel-view.ts`/`projects-list-view.tsx`/
 * `session-search-view.ts`/`other-sessions-dir-dialog-view.ts` keep working exactly as before.
 * Only `hidden` is new: it is now computed from `activeId`, the same single source of truth every
 * other pane in this component uses, instead of each page tab button toggling it by hand.
 *
 * **Settings** (`docs/INTERFACE.md` § 2 item 2) is an `IconButton` with a gear icon and
 * `aria-label` now — its CLICK wiring is untouched, still `renderer/legacy/settings-dialog-view.ts
 * #wireSettingsDialog` attaching by the same `#settings-button` id (that dialog's own redesign is
 * V2-T65, out of this task's scope) — this component only changed its visual chrome.
 */
import { useEffect, useRef } from 'preact/hooks';
import type { ComponentChildren, JSX } from 'preact';
import styles from './TabStrip.module.css';
import { cx } from '../../components/css-class.js';
import { IconButton } from '../../components/IconButton/index.js';
import { SettingsIcon } from '../../components/Icon/index.js';
import { TabStripItem } from './TabStripItem/index.js';
import { TerminalPane } from './TerminalPane/index.js';
import { NewTabButton } from './NewTabButton/index.js';
import { NewTabPopover } from './NewTabPopover/index.js';
import { useTabStrip } from './useTabStrip.js';
import { MESSAGES } from '../../../text/messages.js';

export interface TabStripProps {
  /** `App.tsx`'s own sidebar-reopen button — rendered as the first element of this component's
   * toolbar row (same visual row as the "+"/tabs/Settings), even though the button itself belongs
   * to the sidebar's own collapse state (`renderer/features/sidebar/useSidebarCollapse.ts`'s own
   * docstring: it necessarily lives OUTSIDE the lateral, since it's what reopens it). Optional only
   * for a test that doesn't care about it. */
  readonly leading?: ComponentChildren;
}

export function TabStrip(props: TabStripProps): JSX.Element {
  const data = useTabStrip();
  const newTabButtonRef = useRef<HTMLButtonElement>(null);
  const terminalHostRef = useRef<HTMLDivElement>(null);

  // V2-T30/V2-T48 item 6: a sidebar collapse/resize reflows `#terminal-host` without ever firing
  // `window`'s own `resize` event (that event only fires for the window's OUTER size) — a
  // `ResizeObserver` on the host itself is what the legacy file already measured as the fix.
  useEffect(() => {
    const host = terminalHostRef.current;
    if (host === null) {
      return;
    }
    const observer = new ResizeObserver(() => data.fitAll());
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div class={cx(styles, 'toolbar')}>
        {props.leading}
        <NewTabButton
          buttonRef={newTabButtonRef}
          disabled={!data.ready}
          onClick={data.openPopover}
        />
        <div class={cx(styles, 'tabs')} role="tablist">
          {data.entries.map((entry) => (
            <TabStripItem
              key={entry.id}
              entry={entry}
              onSelect={data.selectTab}
              onClose={data.closeTab}
            />
          ))}
        </div>
        <IconButton id="settings-button" variant="ghost" aria-label={MESSAGES.settingsButton}>
          <SettingsIcon />
        </IconButton>
      </div>
      <NewTabPopover
        id="new-tab-popover"
        open={data.popoverOpen}
        anchorRef={newTabButtonRef}
        recentDirectories={data.recentDirectories}
        onClose={data.closePopover}
        onOpenTab={data.openNewTab}
      />
      <div id="terminal-host" ref={terminalHostRef}>
        <div id="page-today" class="page-pane" hidden={data.activeId !== 'page-today'}>
          <div id="today-panel"></div>
        </div>
        <div id="page-projects" class="page-pane" hidden={data.activeId !== 'page-projects'}>
          <h2>Projects</h2>
          <div id="projects-list"></div>
          <p id="project-open-result-text"></p>
        </div>
        <div id="page-sessions" class="page-pane" hidden={data.activeId !== 'page-sessions'}>
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
        {data.terminalTabs.map((tab) => (
          <TerminalPane
            key={tab.id}
            id={tab.id}
            hidden={data.activeId !== tab.id}
            fontFamily={data.fontFamily}
            fontSize={data.fontSize}
            spawnRequest={tab.spawnRequest}
            onRegister={data.registerHandle}
            onUnregister={data.unregisterHandle}
            onSpawned={data.onTerminalSpawned}
          />
        ))}
      </div>
    </>
  );
}
