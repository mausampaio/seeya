// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/preact';
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
});
