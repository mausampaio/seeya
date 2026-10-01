// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/preact';
import { useRef } from 'preact/hooks';
import { useSidebarResize } from '../../../../../../packages/app/src/renderer/features/sidebar/useSidebarResize.js';
import {
  DEFAULT_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_STORAGE_KEY,
} from '../../../../../../packages/app/src/state/sidebar-width.js';

beforeEach(() => {
  localStorage.clear();
});
afterEach(cleanup);

function renderWithSidebarRef() {
  return renderHook(() => {
    const sidebarRef = useRef<HTMLDivElement>(null);
    const controls = useSidebarResize(sidebarRef);
    return { sidebarRef, controls };
  });
}

describe('useSidebarResize (D-052, V2-T75)', () => {
  it('starts at the default width when nothing is stored', () => {
    const { result } = renderWithSidebarRef();
    expect(result.current.controls.width).toBe(DEFAULT_SIDEBAR_WIDTH);
    expect(result.current.controls.dragging).toBe(false);
  });

  it('restores a stored width', () => {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, '320');
    const { result } = renderWithSidebarRef();
    expect(result.current.controls.width).toBe(320);
  });

  it('drags, clamps to range, and persists the width on pointer up', () => {
    const sidebar = document.createElement('div');
    vi.spyOn(sidebar, 'getBoundingClientRect').mockReturnValue({
      left: 0,
    } as DOMRect);
    document.body.appendChild(sidebar);

    const { result } = renderHook(() => useSidebarResize({ current: sidebar }));

    void act(() => {
      result.current.handlePointerDown({
        preventDefault: () => {},
      } as unknown as Parameters<typeof result.current.handlePointerDown>[0]);
    });
    expect(result.current.dragging).toBe(true);

    void act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 350 }));
    });
    expect(result.current.width).toBe(350);

    void act(() => {
      // Way past MAX_SIDEBAR_WIDTH — must clamp, never store an out-of-range value.
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 9999 }));
    });
    expect(result.current.width).toBe(MAX_SIDEBAR_WIDTH);

    void act(() => {
      window.dispatchEvent(new PointerEvent('pointerup'));
    });
    expect(result.current.dragging).toBe(false);
    expect(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBe(String(MAX_SIDEBAR_WIDTH));

    sidebar.remove();
  });

  it('clamps a drag below the minimum too', () => {
    const sidebar = document.createElement('div');
    vi.spyOn(sidebar, 'getBoundingClientRect').mockReturnValue({ left: 0 } as DOMRect);
    document.body.appendChild(sidebar);
    const { result } = renderHook(() => useSidebarResize({ current: sidebar }));

    void act(() => {
      result.current.handlePointerDown({
        preventDefault: () => {},
      } as unknown as Parameters<typeof result.current.handlePointerDown>[0]);
    });
    void act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: -100 }));
    });
    expect(result.current.width).toBe(MIN_SIDEBAR_WIDTH);
    sidebar.remove();
  });
});
