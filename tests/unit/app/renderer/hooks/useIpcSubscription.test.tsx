// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/preact';
import { useIpcSubscription } from '../../../../../packages/app/src/renderer/hooks/useIpcSubscription.js';

describe('useIpcSubscription (D-052, V2-T75)', () => {
  it('starts at the initial value and subscribes exactly once', () => {
    const unsubscribe = vi.fn();
    const subscribe = vi.fn(() => unsubscribe);
    const { result } = renderHook(() => useIpcSubscription(subscribe, 'idle'));
    expect(result.current).toBe('idle');
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it('updates state when the channel pushes a new event', () => {
    let pushed: ((value: string) => void) | undefined;
    const subscribe = (listener: (value: string) => void): (() => void) => {
      pushed = listener;
      return () => {};
    };
    const { result } = renderHook(() => useIpcSubscription(subscribe, 'idle'));
    expect(result.current).toBe('idle');
    void act(() => {
      pushed?.('updated');
    });
    expect(result.current).toBe('updated');
  });

  it('calls the unsubscribe function on unmount', () => {
    const unsubscribe = vi.fn();
    const subscribe = vi.fn(() => unsubscribe);
    const { unmount } = renderHook(() => useIpcSubscription(subscribe, 'idle'));
    expect(unsubscribe).not.toHaveBeenCalled();
    void act(() => {
      unmount();
    });
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
