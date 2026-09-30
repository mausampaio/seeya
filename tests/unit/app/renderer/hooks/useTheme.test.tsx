// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/preact';
import { createFakeSeeyaApi } from '../_fake-seeya-api.js';
import { useTheme } from '../../../../../packages/app/src/renderer/hooks/useTheme.js';
import type { ThemeUpdateEvent } from '../../../../../packages/app/src/ipc/channels.js';

afterEach(cleanup);

describe('useTheme (D-052, V2-T75)', () => {
  it('starts null before the first-paint fetch resolves', () => {
    window.seeya = createFakeSeeyaApi({
      getEffectiveTheme: () => new Promise(() => {}),
    });
    const { result } = renderHook(() => useTheme());
    expect(result.current).toBeNull();
  });

  it('resolves to the first-paint theme', async () => {
    window.seeya = createFakeSeeyaApi({
      getEffectiveTheme: () => Promise.resolve({ effectiveTheme: 'dark' as const }),
    });
    const { result } = renderHook(() => useTheme());
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current).toBe('dark');
  });

  it('reflects a pushed theme update', async () => {
    let push: ((event: ThemeUpdateEvent) => void) | undefined;
    window.seeya = createFakeSeeyaApi({
      getEffectiveTheme: () => Promise.resolve({ effectiveTheme: 'light' as const }),
      onThemeUpdate: (listener) => {
        push = listener;
        return () => {};
      },
    });
    const { result } = renderHook(() => useTheme());
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current).toBe('light');
    void act(() => {
      push?.({ effectiveTheme: 'dark' });
    });
    expect(result.current).toBe('dark');
  });

  it('unsubscribes on unmount', async () => {
    let unsubscribed = false;
    window.seeya = createFakeSeeyaApi({
      getEffectiveTheme: () => Promise.resolve({ effectiveTheme: 'light' as const }),
      onThemeUpdate: () => () => {
        unsubscribed = true;
      },
    });
    const { unmount } = renderHook(() => useTheme());
    await act(async () => {
      await Promise.resolve();
    });
    void act(() => unmount());
    expect(unsubscribed).toBe(true);
  });
});
