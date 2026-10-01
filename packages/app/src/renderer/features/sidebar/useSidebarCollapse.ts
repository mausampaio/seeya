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
import { useCallback, useEffect, useState } from 'preact/hooks';
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

/**
 * Restores the remembered state on mount and persists every toggle — click (the lateral's own
 * header button, or the toolbar's reopen button) or the `Ctrl+B` shortcut, all funnelled through
 * the one `toggle` this hook returns.
 */
export function useSidebarCollapse(): SidebarCollapseControls {
  const [collapsed, setCollapsed] = useState<boolean>(readSidebarCollapsedPreference);

  const toggle = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      writeSidebarCollapsedPreference(next);
      return next;
    });
  }, []);

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
