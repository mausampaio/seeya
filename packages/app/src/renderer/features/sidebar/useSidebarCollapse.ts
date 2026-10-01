/**
 * D-052 (V2-T75): the lateral's collapsed/expanded state — a real Preact hook now, replacing
 * `renderer/legacy/sidebar-collapse-view.ts` (superseded by this feature, deleted by this task).
 * A view preference, never configuration (same reasoning `state/sidebar-collapse.ts` already
 * documents) — it lives in the renderer's own `localStorage`, read back with a protected parse,
 * never surfaced as an error. Drives BOTH the `<Sidebar/>` component's own collapsed rendering and
 * the toolbar's reopen button (`App.tsx`), since the button that reopens the lateral necessarily
 * lives outside it.
 *
 * @example
 * const { collapsed, toggle } = useSidebarCollapse();
 */
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import {
  encodeSidebarCollapsedPreference,
  parseSidebarCollapsedPreference,
  SIDEBAR_COLLAPSED_STORAGE_KEY,
} from '../../../state/sidebar-collapse.js';
import { isSidebarToggleShortcut } from '../../../state/sidebar-toggle-shortcut.js';

/** Protected read — `localStorage` can throw outright (a private window, blocked site data), and
 * this never lets that surface as "collapsed": any failure or absent/malformed value opens
 * expanded, same D-025 contract `parseSidebarCollapsedPreference` already promises for a value it
 * CAN read. */
function readSidebarCollapsedPreference(): boolean {
  try {
    return parseSidebarCollapsedPreference(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY));
  } catch {
    return false;
  }
}

/** Best-effort write — a failure here just means the preference won't survive to the next
 * launch, never surfaced as an error to the person clicking the toggle. */
function writeSidebarCollapsedPreference(collapsed: boolean): void {
  try {
    localStorage.setItem(
      SIDEBAR_COLLAPSED_STORAGE_KEY,
      encodeSidebarCollapsedPreference(collapsed),
    );
  } catch {
    // Protected write — see this file's own docstring on readSidebarCollapsedPreference.
  }
}

/** Whether the currently focused element belongs to an open terminal tab — `#terminal-host` is
 * where every `xterm.js` pane lives, so this is enough to tell "a terminal wants this keystroke"
 * apart from "focus is on a button, a dialog, or nowhere in particular", without importing
 * anything terminal-specific here. See `state/sidebar-toggle-shortcut.ts`'s own docstring for why
 * this check exists at all. */
function isTerminalFocused(): boolean {
  return document.activeElement?.closest('#terminal-host') != null;
}

export interface SidebarCollapseControls {
  readonly collapsed: boolean;
  readonly toggle: () => void;
}

/** The two buttons that ever toggle the lateral — `Sidebar.tsx`'s own header button and
 * `App.tsx`'s toolbar reopen button. Only one of the two is ever mounted at a time since the PO
 * review below (`docs/INTERFACE.md`'s own "Um botão de recolher por vez") — these ids are the only
 * place either one needs naming for that correction's own focus handling. */
const SIDEBAR_TOGGLE_BUTTON_ID = 'sidebar-collapse-toggle';
const TOOLBAR_TOGGLE_BUTTON_ID = 'sidebar-toggle-button';

/**
 * Restores the remembered state on mount and persists every toggle — click (the lateral's own
 * header button, or the toolbar's reopen button) or the `Ctrl+B` shortcut, all funnelled through
 * the one `toggle` this hook returns.
 */
export function useSidebarCollapse(): SidebarCollapseControls {
  const [collapsed, setCollapsed] = useState<boolean>(readSidebarCollapsedPreference);
  // PO review (2026-10-01, "Um botão de recolher por vez"): `App.tsx` now mounts only ONE of the
  // two toggle buttons at a time, so a click on whichever one currently has focus unmounts its
  // OWN focused element the instant `collapsed` flips — without this, focus would silently drop
  // to `<body>` instead of landing on the button that just appeared. Set synchronously inside
  // `toggle` (before the state update), read and cleared by the effect below once the OTHER
  // button has actually mounted.
  const restoreFocusAfterToggle = useRef(false);

  const toggle = useCallback(() => {
    const focusedId =
      document.activeElement instanceof HTMLElement ? document.activeElement.id : '';
    restoreFocusAfterToggle.current =
      focusedId === SIDEBAR_TOGGLE_BUTTON_ID || focusedId === TOOLBAR_TOGGLE_BUTTON_ID;
    setCollapsed((current) => {
      const next = !current;
      writeSidebarCollapsedPreference(next);
      return next;
    });
  }, []);

  // Runs AFTER Preact commits the new `collapsed` value to the DOM, so the button about to
  // receive focus is guaranteed to already exist — never the Ctrl+B path (this effect only acts
  // when `toggle` itself recorded that a toggle BUTTON, not the shortcut, had focus beforehand;
  // grabbing focus for a shortcut that fired from wherever the person already was — a terminal is
  // excluded even from firing `toggle` at all, see `handleKeydown` below — would be the window
  // surprising them, not helping them).
  useEffect(() => {
    if (!restoreFocusAfterToggle.current) {
      return;
    }
    restoreFocusAfterToggle.current = false;
    const visibleButtonId = collapsed ? TOOLBAR_TOGGLE_BUTTON_ID : SIDEBAR_TOGGLE_BUTTON_ID;
    document.getElementById(visibleButtonId)?.focus();
  }, [collapsed]);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent): void {
      if (!isSidebarToggleShortcut(event) || isTerminalFocused()) {
        return;
      }
      event.preventDefault();
      toggle();
    }
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [toggle]);

  return { collapsed, toggle };
}
