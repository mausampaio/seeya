// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/preact';
import { createFakeSeeyaApi } from '../../_fake-seeya-api.js';
import { useSidebarFooter } from '../../../../../../packages/app/src/renderer/features/sidebar/SidebarFooter/useSidebarFooter.js';
import type { DaemonControlAvailability } from '../../../../../../packages/app/src/state/daemon-control-panel.js';
import type { ScheduleStripData } from '../../../../../../packages/app/src/state/schedule-strip.js';

afterEach(cleanup);

describe('useSidebarFooter (D-052, V2-T75)', () => {
  it('starts with an empty schedule and unknown daemon availability', () => {
    window.seeya = createFakeSeeyaApi();
    const { result } = renderHook(() => useSidebarFooter());
    expect(result.current.schedule).toEqual({
      primary: '',
      secondary: '',
      canSnooze: false,
      canSkip: false,
    });
    expect(result.current.daemon).toEqual({ kind: 'idle', availability: { kind: 'unknown' } });
  });

  it('onSnooze calls snoozeToday with the chosen increment', () => {
    const snoozeToday = vi.fn(() =>
      Promise.resolve({ primary: '', secondary: '', canSnooze: true, canSkip: true }),
    );
    window.seeya = createFakeSeeyaApi({ snoozeToday });
    const { result } = renderHook(() => useSidebarFooter());
    void act(() => result.current.onSnooze(30));
    expect(snoozeToday).toHaveBeenCalledWith({ minutes: 30 });
  });

  it('onSkip calls skipToday', () => {
    const skipToday = vi.fn(() =>
      Promise.resolve({ primary: '', secondary: '', canSnooze: false, canSkip: false }),
    );
    window.seeya = createFakeSeeyaApi({ skipToday });
    const { result } = renderHook(() => useSidebarFooter());
    void act(() => result.current.onSkip());
    expect(skipToday).toHaveBeenCalledTimes(1);
  });

  /**
   * Regression tests (maintainer-found, V2-T65-estado-na-tela item 2): `onSnooze`/`onSkip` used to
   * fire the IPC call and throw the response away (`void api.snoozeToday(...)`), so `schedule`
   * only ever changed via the NEXT `onScheduleUpdate` push — the maintainer clicked Skip and saw
   * nothing happen. These tests never call `push` at all — if `schedule` still updates, the fix is
   * applying the invoke's own response directly, not relying on a push that in these tests never
   * arrives.
   */
  it('onSkip applies the response to `schedule` immediately, with no push involved', async () => {
    const skipToday = vi.fn(() =>
      Promise.resolve({
        primary: 'End of day',
        secondary: 'today',
        canSnooze: false,
        canSkip: false,
      }),
    );
    window.seeya = createFakeSeeyaApi({ skipToday });
    const { result } = renderHook(() => useSidebarFooter());

    await act(async () => {
      result.current.onSkip();
      await Promise.resolve();
    });

    expect(result.current.schedule).toEqual({
      primary: 'End of day',
      secondary: 'today',
      canSnooze: false,
      canSkip: false,
    });
  });

  it('onSnooze applies the response to `schedule` immediately, with no push involved', async () => {
    const snoozeToday = vi.fn(() =>
      Promise.resolve({
        primary: 'Snoozed',
        secondary: 'until later',
        canSnooze: true,
        canSkip: true,
      }),
    );
    window.seeya = createFakeSeeyaApi({ snoozeToday });
    const { result } = renderHook(() => useSidebarFooter());

    await act(async () => {
      result.current.onSnooze(15);
      await Promise.resolve();
    });

    expect(result.current.schedule.primary).toBe('Snoozed');
    expect(result.current.schedule.secondary).toBe('until later');
  });

  it('scheduleActionPending reflects the in-flight action and clears once it resolves', async () => {
    let resolveSkip: ((value: ScheduleStripData) => void) | undefined;
    const skipToday = vi.fn(
      () =>
        new Promise<ScheduleStripData>((resolve) => {
          resolveSkip = resolve;
        }),
    );
    window.seeya = createFakeSeeyaApi({ skipToday });
    const { result } = renderHook(() => useSidebarFooter());
    expect(result.current.scheduleActionPending).toBeNull();

    void act(() => {
      result.current.onSkip();
    });
    expect(result.current.scheduleActionPending).toBe('skip');

    await act(async () => {
      resolveSkip?.({ primary: '', secondary: '', canSnooze: false, canSkip: false });
      await Promise.resolve();
    });
    expect(result.current.scheduleActionPending).toBeNull();
  });

  it('ignores a second click while an action is already pending (no overlapping IPC calls)', () => {
    const skipToday = vi.fn(() => new Promise<ScheduleStripData>(() => {}));
    const snoozeToday = vi.fn(() => new Promise<ScheduleStripData>(() => {}));
    window.seeya = createFakeSeeyaApi({ skipToday, snoozeToday });
    const { result } = renderHook(() => useSidebarFooter());

    // Two SEPARATE `act()` calls — a real click dispatches as its own event, so
    // `scheduleActionPending`'s own state update has already committed by the time a second,
    // later click's handler closure reads it. Calling both inside ONE `act()` (a single
    // synchronous batch) would prove nothing: neither closure would see the other's update yet,
    // which is not how two distinct clicks ever happen in a real window.
    void act(() => {
      result.current.onSkip();
    });
    expect(result.current.scheduleActionPending).toBe('skip');

    void act(() => {
      result.current.onSnooze(15);
    });
    expect(skipToday).toHaveBeenCalledTimes(1);
    expect(snoozeToday).not.toHaveBeenCalled();
  });

  it('reflects a pushed schedule update', () => {
    let push: ((event: ScheduleStripData) => void) | undefined;
    window.seeya = createFakeSeeyaApi({
      onScheduleUpdate: (listener) => {
        push = listener;
        return () => {};
      },
    });
    const { result } = renderHook(() => useSidebarFooter());
    void act(() => {
      push?.({ primary: 'End of day', secondary: 'in 2 h 10 min', canSnooze: true, canSkip: true });
    });
    expect(result.current.schedule.primary).toBe('End of day');
    expect(result.current.schedule.secondary).toBe('in 2 h 10 min');
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
