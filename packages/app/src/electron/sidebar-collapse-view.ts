/**
 * The sidebar's collapse toggle (V2-T30 item 2) — split out of `electron/project-panel-view.ts`
 * (PO review, 2026-09-25: that file grew past the 500-line ceiling) into its own single
 * responsibility. Same `electron/` exemption as the rest of this directory (D-041: no decision of
 * its own beyond DOM/`localStorage` access — `state/sidebar-collapse.ts` owns the one real decision,
 * "what does a raw stored value mean").
 */
import { MESSAGES } from '../text/messages.js';
import {
  encodeSidebarCollapsedPreference,
  parseSidebarCollapsedPreference,
  SIDEBAR_COLLAPSED_STORAGE_KEY,
} from '../state/sidebar-collapse.js';

function sidebarElement(): HTMLElement {
  return document.getElementById('sidebar') as HTMLElement;
}

/**
 * V2-T30 item 2: reads the collapsed preference protected — `localStorage` can throw outright (a
 * private window, blocked site data), and this function never lets that surface as "collapsed":
 * any failure or absent/malformed value opens expanded, same as `parseSidebarCollapsedPreference`'s
 * own D-025 contract for a value it CAN read.
 */
function readSidebarCollapsedPreference(): boolean {
  try {
    return parseSidebarCollapsedPreference(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY));
  } catch {
    return false;
  }
}

/** Best-effort write — a failure here just means the preference won't survive to the next launch
 * (same "protected" spirit as the read above), never surfaced as an error to the person clicking
 * the toggle. */
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

function applySidebarCollapsed(collapsed: boolean): void {
  const sidebar = sidebarElement();
  sidebar.classList.toggle('collapsed', collapsed);
  const toggle = document.getElementById('sidebar-collapse-toggle') as HTMLButtonElement;
  toggle.textContent = collapsed
    ? MESSAGES.sidebarCollapseToggleCollapsed
    : MESSAGES.sidebarCollapseToggleExpanded;
}

/** Wired once, at startup — restores the remembered state (V2-T30 item 2: "o estado é lembrado
 * entre aberturas do app") and toggles/persists it on click. The terminal's own re-fit is NOT this
 * function's job: `renderer.ts#wireWindowResize`'s own `ResizeObserver` on `#terminal-host` already
 * reacts to the size change this toggle causes, without a direct call from here (one mechanism,
 * every trigger — window resize, maximize, and this). */
export function wireSidebarCollapse(): void {
  applySidebarCollapsed(readSidebarCollapsedPreference());
  document.getElementById('sidebar-collapse-toggle')?.addEventListener('click', () => {
    const collapsed = !sidebarElement().classList.contains('collapsed');
    applySidebarCollapsed(collapsed);
    writeSidebarCollapsedPreference(collapsed);
  });
}
