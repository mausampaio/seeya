/**
 * D-052 (V2-T75): the lateral's own draggable width — a real Preact hook now, replacing
 * `renderer/legacy/sidebar-resize-view.ts` (superseded by this feature, deleted by this task).
 * Same protected-`localStorage` discipline as `useSidebarCollapse.ts`. The terminal's own re-fit
 * while dragging is NOT this hook's job: `renderer/legacy/tabs-view.ts#wireWindowResize`'s own
 * `ResizeObserver` on `#terminal-host` already reacts to any size change `#main` undergoes, a drag
 * included.
 *
 * @example
 * const { width, dragging, handlePointerDown } = useSidebarResize();
 * <div style={{ width: `${width}px` }} onPointerDown={handlePointerDown} />
 */
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { RefObject, TargetedPointerEvent } from 'preact';
import {
  clampSidebarWidth,
  encodeSidebarWidthPreference,
  parseSidebarWidthPreference,
  SIDEBAR_WIDTH_STORAGE_KEY,
} from '../../../state/sidebar-width.js';

/** Protected read — see this file's own docstring / `useSidebarCollapse.ts`'s identical
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

export interface SidebarResizeControls {
  readonly width: number;
  readonly dragging: boolean;
  readonly handlePointerDown: (event: TargetedPointerEvent<HTMLElement>) => void;
}

/**
 * `sidebarLeft` is read once, when the drag starts (the sidebar's own left edge never moves
 * DURING a drag of ITS OWN right edge) — avoids a `getBoundingClientRect()` call on every
 * `pointermove`. `sidebarRef` is the sidebar `<aside>` element itself — read directly, rather than
 * traversed from the handle via DOM sibling order (the legacy version's own approach), so this
 * hook never assumes anything about where its caller places the handle in the markup.
 */
export function useSidebarResize(sidebarRef: RefObject<HTMLElement | null>): SidebarResizeControls {
  const [width, setWidth] = useState<number>(readSidebarWidthPreference);
  const [dragging, setDragging] = useState(false);
  const sidebarLeftRef = useRef(0);
  const widthRef = useRef(width);
  widthRef.current = width;

  useEffect(() => {
    if (!dragging) {
      return;
    }
    function onPointerMove(event: PointerEvent): void {
      setWidth(clampSidebarWidth(event.clientX - sidebarLeftRef.current));
    }
    function onPointerUp(): void {
      setDragging(false);
      writeSidebarWidthPreference(widthRef.current);
    }
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [dragging]);

  const handlePointerDown = useCallback(
    (event: TargetedPointerEvent<HTMLElement>) => {
      sidebarLeftRef.current = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      setDragging(true);
      event.preventDefault();
    },
    [sidebarRef],
  );

  return { width, dragging, handlePointerDown };
}
