/**
 * The sidebar's resizable border (PO acceptance of V2-T55, correction 2, 2026-09-25) — a
 * draggable handle (`#sidebar-resize-handle`) between the sidebar and the tab area, remembered
 * between openings via `localStorage` (`state/sidebar-width.ts`, same protected-read discipline
 * `sidebar-collapse-view.ts` already uses for whether the sidebar is collapsed at all). D-041: no
 * decision of its own beyond DOM/`localStorage`/pointer-event access — `state/sidebar-width.ts`
 * owns the one real decision, "what does a raw stored value mean" and "what counts as a valid
 * width at all".
 *
 * The terminal's own re-fit while dragging is NOT this file's job: `renderer.ts#wireWindowResize`'s
 * own `ResizeObserver` on `#terminal-host` already reacts to any size change `#main` undergoes
 * (V2-T30/V2-T48 item 6), a drag included — this file only ever touches `#sidebar`'s width.
 */
import {
  clampSidebarWidth,
  encodeSidebarWidthPreference,
  parseSidebarWidthPreference,
  SIDEBAR_WIDTH_STORAGE_KEY,
} from '../state/sidebar-width.js';

function sidebarElement(): HTMLElement {
  return document.getElementById('sidebar') as HTMLElement;
}

/** Protected read — see this file's own docstring / `sidebar-collapse-view.ts`'s identical
 * precedent: any failure reads as "nothing stored", never as a guessed width. */
function readSidebarWidthPreference(): number {
  try {
    return parseSidebarWidthPreference(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY));
  } catch {
    return parseSidebarWidthPreference(null);
  }
}

/** Best-effort write — a failure here just means the width won't survive to the next launch,
 * never surfaced as an error mid-drag. */
function writeSidebarWidthPreference(width: number): void {
  try {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, encodeSidebarWidthPreference(width));
  } catch {
    // Protected write — see this function's own docstring.
  }
}

/** The custom property `#sidebar`'s own CSS reads (`index.css`) — never `element.style.width`
 * directly, so `#sidebar.collapsed`'s higher-specificity `width: auto` keeps winning regardless
 * of whatever width was last dragged (this file's own module docstring has the full reasoning). */
function applySidebarWidth(width: number): void {
  sidebarElement().style.setProperty('--sidebar-width', `${width}px`);
}

/** Wired once, at startup, from `electron/project-panel-view.ts#wireProjectPanel`. */
export function wireSidebarResize(): void {
  applySidebarWidth(readSidebarWidthPreference());

  const maybeHandle = document.getElementById('sidebar-resize-handle');
  if (maybeHandle === null) {
    return;
  }
  // A separately typed (non-nullable) alias: TypeScript doesn't carry the null-check narrowing
  // above into the nested function declarations below, since `maybeHandle`'s declared type is
  // still `HTMLElement | null` at each of their own call sites.
  const handle: HTMLElement = maybeHandle;

  let dragging = false;

  function onPointerMove(event: PointerEvent): void {
    if (!dragging) {
      return;
    }
    const sidebarLeft = sidebarElement().getBoundingClientRect().left;
    applySidebarWidth(clampSidebarWidth(event.clientX - sidebarLeft));
  }

  function stopDragging(): void {
    if (!dragging) {
      return;
    }
    dragging = false;
    handle.classList.remove('dragging');
    writeSidebarWidthPreference(sidebarElement().getBoundingClientRect().width);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', stopDragging);
  }

  handle.addEventListener('pointerdown', (event) => {
    dragging = true;
    handle.classList.add('dragging');
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stopDragging);
    event.preventDefault();
  });
}
