// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook } from '@testing-library/preact';
import { useSidebarCollapse } from '../../../../../../packages/app/src/renderer/features/sidebar/useSidebarCollapse.js';
import { SIDEBAR_COLLAPSED_STORAGE_KEY } from '../../../../../../packages/app/src/state/sidebar-collapse.js';

beforeEach(() => {
  localStorage.clear();
});
afterEach(cleanup);

describe('useSidebarCollapse (D-052, V2-T75)', () => {
  it('starts expanded when nothing is stored yet', () => {
    const { result } = renderHook(() => useSidebarCollapse());
    expect(result.current.collapsed).toBe(false);
  });

  it('restores a stored collapsed preference', () => {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, 'true');
    const { result } = renderHook(() => useSidebarCollapse());
    expect(result.current.collapsed).toBe(true);
  });

  it('toggle flips and persists the preference', () => {
    const { result } = renderHook(() => useSidebarCollapse());
    void act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(true);
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe('true');

    void act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(false);
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe('false');
  });

  it('Ctrl+B toggles when focus is outside a terminal', () => {
    const { result } = renderHook(() => useSidebarCollapse());
    void act(() => {
      const event = new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, bubbles: true });
      window.dispatchEvent(event);
    });
    expect(result.current.collapsed).toBe(true);
  });

  it('Ctrl+B does nothing while a terminal is focused', () => {
    const host = document.createElement('div');
    host.id = 'terminal-host';
    const input = document.createElement('input');
    host.appendChild(input);
    document.body.appendChild(host);
    input.focus();

    const { result } = renderHook(() => useSidebarCollapse());
    void act(() => {
      const event = new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, bubbles: true });
      window.dispatchEvent(event);
    });
    expect(result.current.collapsed).toBe(false);
    host.remove();
  });

  /**
   * PO review (2026-10-01, "Um botão de recolher por vez"): `App.tsx` now mounts only ONE of the
   * two toggle buttons at a time, so a click unmounts the very button that had focus — without
   * the fix in `useSidebarCollapse.ts`, focus silently drops to `<body>` instead of landing on
   * the button that just appeared. Mounts BOTH real buttons (toggling `hidden` on whichever one
   * `collapsed` says is absent, mirroring `App.tsx`'s own `leading={collapsed ? ... : undefined}`
   * and `Sidebar.module.css`'s own `.collapsed .main { display: none }`) to prove the real focus
   * hand-off, not just the `collapsed` boolean.
   */
  it('moves focus to the OTHER toggle button when the focused one disappears', () => {
    function Harness() {
      const { collapsed, toggle } = useSidebarCollapse();
      return (
        <>
          {!collapsed && (
            <button id="sidebar-collapse-toggle" onClick={toggle}>
              Collapse
            </button>
          )}
          {collapsed && (
            <button id="sidebar-toggle-button" onClick={toggle}>
              Expand
            </button>
          )}
        </>
      );
    }
    const { getByText } = render(<Harness />);
    const collapseButton = getByText('Collapse');
    collapseButton.focus();
    expect(document.activeElement).toBe(collapseButton);

    void act(() => fireEvent.click(collapseButton));

    const expandButton = getByText('Expand');
    expect(document.activeElement).toBe(expandButton);
  });

  it('does not steal focus from something else when the toggle fires from neither button (e.g. Ctrl+B)', () => {
    function Harness() {
      const { collapsed, toggle } = useSidebarCollapse();
      return (
        <>
          <input id="unrelated-input" />
          {!collapsed && <button id="sidebar-collapse-toggle">Collapse</button>}
          {collapsed && <button id="sidebar-toggle-button">Expand</button>}
          {/* Stands in for the Ctrl+B keydown listener, which calls the same `toggle` from
           * wherever focus already was — never from one of the two buttons themselves. */}
          <button id="shortcut-trigger" onClick={toggle}>
            Shortcut
          </button>
        </>
      );
    }
    const { getByText } = render(<Harness />);
    const input = document.getElementById('unrelated-input') as HTMLInputElement;
    input.focus();
    expect(document.activeElement).toBe(input);

    void act(() => fireEvent.click(getByText('Shortcut')));

    // The toggle really ran (the OTHER button is now the one in the DOM)...
    expect(getByText('Expand')).not.toBeNull();
    // ...but focus never moved, since neither toggle button was focused when it fired.
    expect(document.activeElement).toBe(input);
  });
});
