// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/preact';
import { createFakeSeeyaApi } from '../../_fake-seeya-api.js';
import { useSidebarFooter } from '../../../../../../packages/app/src/renderer/features/sidebar/SidebarFooter/useSidebarFooter.js';
import type { DaemonControlAvailability } from '../../../../../../packages/app/src/state/daemon-control-panel.js';

afterEach(cleanup);

describe('useSidebarFooter (D-052, V2-T75)', () => {
  it('starts with an empty schedule and unknown daemon availability', () => {
    window.seeya = createFakeSeeyaApi();
    const { result } = renderHook(() => useSidebarFooter());
    expect(result.current.schedule).toEqual({ text: '', canSnooze: false, canSkip: false });
    expect(result.current.daemon).toEqual({ kind: 'idle', availability: { kind: 'unknown' } });
  });

  it('onSnooze calls snoozeToday with the chosen increment', () => {
    const snoozeToday = vi.fn(() => Promise.resolve({ text: '', canSnooze: true, canSkip: true }));
    window.seeya = createFakeSeeyaApi({ snoozeToday });
    const { result } = renderHook(() => useSidebarFooter());
    void act(() => result.current.onSnooze(30));
    expect(snoozeToday).toHaveBeenCalledWith({ minutes: 30 });
  });

  it('onSkip calls skipToday', () => {
    const skipToday = vi.fn(() => Promise.resolve({ text: '', canSnooze: false, canSkip: false }));
    window.seeya = createFakeSeeyaApi({ skipToday });
    const { result } = renderHook(() => useSidebarFooter());
    void act(() => result.current.onSkip());
    expect(skipToday).toHaveBeenCalledTimes(1);
  });

  it('reflects a pushed schedule update', () => {
    let push: ((event: { text: string; canSnooze: boolean; canSkip: boolean }) => void) | undefined;
    window.seeya = createFakeSeeyaApi({
      onScheduleUpdate: (listener) => {
        push = listener;
        return () => {};
      },
    });
    const { result } = renderHook(() => useSidebarFooter());
    void act(() => {
      push?.({ text: 'End of day in 2 h 10 min', canSnooze: true, canSkip: true });
    });
    expect(result.current.schedule.text).toBe('End of day in 2 h 10 min');
  });

  it('reflects a pushed daemon availability update', () => {
    let push: ((availability: DaemonControlAvailability) => void) | undefined;
    window.seeya = createFakeSeeyaApi({
      onDaemonAvailabilityUpdate: (listener) => {
        push = listener;
        return () => {};
      },
    });
    const { result } = renderHook(() => useSidebarFooter());
    void act(() => {
      push?.({ kind: 'stop', pid: 123 });
    });
    expect(result.current.daemon).toEqual({
      kind: 'idle',
      availability: { kind: 'stop', pid: 123 },
    });
  });

  it('a daemon control click runs the action and folds the response through the reducer', async () => {
    let push: ((availability: DaemonControlAvailability) => void) | undefined;
    const daemonControl = vi.fn(() =>
      Promise.resolve({
        resultText: 'Daemon started.',
        availability: { kind: 'stop' as const, pid: 42 },
      }),
    );
    window.seeya = createFakeSeeyaApi({
      onDaemonAvailabilityUpdate: (listener) => {
        push = listener;
        return () => {};
      },
      daemonControl,
    });
    const { result } = renderHook(() => useSidebarFooter());
    void act(() => {
      push?.({ kind: 'start' });
    });
    expect(result.current.daemon.availability).toEqual({ kind: 'start' });

    await act(async () => {
      result.current.onDaemonControlClicked();
      await Promise.resolve();
    });
    expect(daemonControl).toHaveBeenCalledWith({ action: 'start' });
    expect(result.current.daemon).toEqual({
      kind: 'result',
      availability: { kind: 'stop', pid: 42 },
      resultText: 'Daemon started.',
    });
  });

  it('does nothing when clicked while availability is unknown', () => {
    const daemonControl = vi.fn();
    window.seeya = createFakeSeeyaApi({ daemonControl });
    const { result } = renderHook(() => useSidebarFooter());
    void act(() => result.current.onDaemonControlClicked());
    expect(daemonControl).not.toHaveBeenCalled();
  });
});
