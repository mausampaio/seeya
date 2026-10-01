/**
 * The tab strip and its content area (V2-T64, `docs/INTERFACE.md` § 2) — replaces
 * `renderer/legacy/tabs-view.ts`/`renderer/legacy/page-tab-strip.ts` (apagados by this task) and
 * the static command-bar/toolbar markup `App.tsx` used to carry directly. Owns the whole toolbar
 * row (the "+" button, every open tab, Settings) AND `#terminal-host` below it — the two were
 * always one region in the legacy file too (`tabs-view.ts`'s own `showTab` already hid/showed
 * BOTH kinds of pane through one function), so splitting them across two components here would
 * only recreate the coupling with extra prop-drilling.
 *
 * **What's still static, unmoved markup inside `#terminal-host`.** The Projects/Sessions page
 * panes (`#page-projects`/`#page-sessions` and everything inside each) are NOT this task's region
 * (`docs/INTERFACE.md` §§ 4–5 are separate, later tasks) — same ids, same nesting, unchanged, so
 * `renderer/legacy/projects-list-view.tsx`/`session-search-view.ts`/
 * `other-sessions-dir-dialog-view.ts` keep working exactly as before. Only `hidden` is new: it is
 * now computed from `activeId`, the same single source of truth every other pane in this component
 * uses, instead of each page tab button toggling it by hand.
 *
 * `#page-today` (V2-T66, `docs/INTERFACE.md` § 3) is the one exception: its content is now
 * `<Today/>` (`renderer/features/today/`), a real component, replacing the `#today-panel` anchor
 * `renderer/legacy/today-panel-view.ts` used to fill by hand (apagado by that task) — same `id`,
 * same position in the tree, so nothing else in this file changes.
 *
 * **Settings** (`docs/INTERFACE.md` § 2 item 2) is an `IconButton` with a gear icon and
 * `aria-label`; its click opens `renderer/features/settings/SettingsDialog` (V2-T65) via
 * `onOpenSettings`, a prop rather than imperative `getElementById` wiring (D-052 item 2) — owned by
 * `App.tsx`, same reasoning as `leading` above (the dialog needs the open state too).
 *
 * `SettingsIcon size={20}` (PO review): the bare default (16px) inside this button's own `size="md"`
 * (32px) box read smaller/fainter than the tab icons next to it (16px, but in their own compact
 * `TabStripItem` layout, not a 32px button) — 20px fills more of the box while staying inside the
 * identity's own 20/24px preferred icon grid (§ 6.4). Colour already came from `variant="ghost"`
 * (`IconButton.module.css`'s own `.ghost { color: var(--seeya-text-secondary) }`) — never grey on
 * its own, confirmed against a real DOM dump, not just a screenshot (same "offscreen rendering is
 * a poor judge of stroke/size" lesson V2-T75's own icon fix already measured).
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
import { watchSidebarWidthTransition } from './sidebar-transition-watcher.js';
import { MESSAGES } from '../../../text/messages.js';
import { Today } from '../today/index.js';

export interface TabStripProps {
  /** `App.tsx`'s own sidebar-reopen button — rendered as the first element of this component's
   * toolbar row (same visual row as the "+"/tabs/Settings), even though the button itself belongs
   * to the sidebar's own collapse state (`renderer/features/sidebar/useSidebarCollapse.ts`'s own
   * docstring: it necessarily lives OUTSIDE the lateral, since it's what reopens it). Optional only
   * for a test that doesn't care about it. */
  readonly leading?: ComponentChildren;
  /** Opens the Settings dialog (V2-T65) — optional only for a test that doesn't care about it. */
  readonly onOpenSettings?: () => void;
}

export function TabStrip(props: TabStripProps): JSX.Element {
  const data = useTabStrip();
  const newTabButtonRef = useRef<HTMLButtonElement>(null);
  const terminalHostRef = useRef<HTMLDivElement>(null);

  // V2-T30/V2-T48 item 6: a sidebar collapse/resize reflows `#terminal-host` without ever firing
  // `window`'s own `resize` event (that event only fires for the window's OUTER size) — a
  // `ResizeObserver` on the host itself is what the legacy file already measured as the fix.
  //
  // PO review (2026-10-01, docs/INTERFACE.md's own "o terminal reajusta ao fim... sem piscar nem
  // ajustar a cada quadro de forma visível"): the sidebar's own 200ms open/collapse width
  // transition (`Sidebar.module.css`) reflows this host on nearly every frame along the way, so
  // calling `fitAll()` directly from the observer used to call it — and so xterm's own full-row
  // `refresh()` — dozens of times inside that one transition, a visible flicker. Coalesced to
  // `requestAnimationFrame` instead of a timer: D-019 bans `setTimeout`/`setInterval` outright
  // (`eslint.config.js`'s own rule has no renderer exemption), and rAF turns out to debounce this
  // correctly anyway — a resize notification arriving before the previously scheduled frame runs
  // cancels and reschedules it, so as long as the transition keeps producing a notification every
  // frame, the callback never fires; it only runs once a frame passes with no new notification
  // behind it, which is exactly "right after resizing settles".
  //
  // Maintainer diagnosis (2026-10-02): that rAF debounce alone wasn't enough to stop a REAL defect
  // — `fitAll()` still fit EVERY handle, including a hidden terminal's, and a resize notification
  // can arrive (and get debounced-through) before the transition visually finishes, sending the
  // pty an intermediate, not-yet-final size. Two independent fixes, together: `TerminalPane`'s own
  // `fit()` now refuses to measure/resize a hidden terminal at all (`state/terminal-resize.ts`),
  // and `watchSidebarWidthTransition` below makes the observer skip calling `fitAll()` entirely
  // while the sidebar's own width transition is still in flight, deferring to the SAME `fitAll()`
  // once `transitionend` (or its fallback) fires — "sem reajustes intermediários enviados ao pty".
  useEffect(() => {
    const host = terminalHostRef.current;
    if (host === null) {
      return;
    }
    let scheduledFrame: number | null = null;
    function runFitAll(): void {
      if (scheduledFrame !== null) {
        cancelAnimationFrame(scheduledFrame);
        scheduledFrame = null;
      }
      data.fitAll();
    }
    const watcher = watchSidebarWidthTransition({ onSettled: runFitAll });
    const observer = new ResizeObserver(() => {
      if (watcher.isTransitioning()) {
        return;
      }
      if (scheduledFrame !== null) {
        cancelAnimationFrame(scheduledFrame);
      }
      scheduledFrame = requestAnimationFrame(() => {
        scheduledFrame = null;
        data.fitAll();
      });
    });
    observer.observe(host);
    return () => {
      if (scheduledFrame !== null) {
        cancelAnimationFrame(scheduledFrame);
      }
      watcher.dispose();
      observer.disconnect();
    };
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
        <IconButton
          id="settings-button"
          variant="ghost"
          size="md"
          aria-label={MESSAGES.settingsButton}
          onClick={() => props.onOpenSettings?.()}
        >
          <SettingsIcon size={20} />
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
          <Today />
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
