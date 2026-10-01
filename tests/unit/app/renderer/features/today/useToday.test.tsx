// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/preact';
import { createFakeSeeyaApi } from '../../_fake-seeya-api.js';
import { useToday } from '../../../../../../packages/app/src/renderer/features/today/useToday.js';
import type { TodayPanelData } from '../../../../../../packages/app/src/state/today-panel.js';
import type { ResumeSummaryResponse } from '../../../../../../packages/app/src/ipc/channels.js';

afterEach(cleanup);

function pendingData(overrides: Partial<Extract<TodayPanelData, { kind: 'pending' }>> = {}) {
  return {
    kind: 'pending' as const,
    day: '2026-09-30',
    daysAgo: 0,
    capturedAt: new Date('2026-09-30T21:00:00.000Z'),
    rows: [
      {
        sessionId: 'a',
        displaySessionId: 'a',
        name: 'alpha',
        cwd: '/alpha',
        firstPlanLine: null,
        resumeStatus: { kind: 'neverResumed' as const },
        cwdHistory: [],
      },
    ],
    ...overrides,
  };
}

function resumedResponse(): ResumeSummaryResponse {
  return {
    resumed: [{ kind: 'resumed', sessionId: 'a', name: 'alpha', cwd: '/alpha' }],
    skipped: [],
    invalidFallbackAnswers: [],
    remaining: [],
    stoppedEarly: false,
  };
}

describe('useToday (D-052, V2-T66)', () => {
  it('starts from the mount-time getTodayPanel fetch, when no push arrives first', async () => {
    const getTodayPanel = vi.fn(() => Promise.resolve(pendingData()));
    window.seeya = createFakeSeeyaApi({ getTodayPanel });
    const { result } = renderHook(() => useToday());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.data.kind).toBe('pending');
    expect(getTodayPanel).toHaveBeenCalledTimes(1);
  });

  it('a push always wins over a late-resolving mount-time fetch', async () => {
    let resolveFetch: ((data: TodayPanelData) => void) | undefined;
    const getTodayPanel = vi.fn(
      () =>
        new Promise<TodayPanelData>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    let push: ((data: TodayPanelData) => void) | undefined;
    window.seeya = createFakeSeeyaApi({
      getTodayPanel,
      onTodayUpdate: (listener) => {
        push = listener;
        return () => {};
      },
    });
    const { result } = renderHook(() => useToday());

    const pushedData = pendingData({ day: '2026-09-29' });
    await act(async () => {
      push?.(pushedData);
      resolveFetch?.({ kind: 'noBriefing', message: 'stale' });
      await Promise.resolve();
    });

    expect(result.current.data).toEqual(pushedData);
  });

  it('toggleSession adds and removes a sessionId from selectedSessionIds', () => {
    window.seeya = createFakeSeeyaApi({ getTodayPanel: () => Promise.resolve(pendingData()) });
    const { result } = renderHook(() => useToday());

    act(() => result.current.toggleSession('a', true));
    expect(result.current.selectedSessionIds.has('a')).toBe(true);

    act(() => result.current.toggleSession('a', false));
    expect(result.current.selectedSessionIds.has('a')).toBe(false);
  });

  it('setChosenCwd records the chosen directory for a sessionId', () => {
    window.seeya = createFakeSeeyaApi({ getTodayPanel: () => Promise.resolve(pendingData()) });
    const { result } = renderHook(() => useToday());

    act(() => result.current.setChosenCwd('a', '/new-dir'));
    expect(result.current.chosenCwdBySessionId.get('a')).toBe('/new-dir');
  });

  it('clearSelection empties the selection', () => {
    window.seeya = createFakeSeeyaApi({ getTodayPanel: () => Promise.resolve(pendingData()) });
    const { result } = renderHook(() => useToday());

    act(() => result.current.toggleSession('a', true));
    expect(result.current.selectedSessionIds.size).toBe(1);
    act(() => result.current.clearSelection());
    expect(result.current.selectedSessionIds.size).toBe(0);
  });

  it('selectedCount excludes a selected row that no longer offers the checkbox', async () => {
    const data = pendingData({
      rows: [
        {
          sessionId: 'a',
          displaySessionId: 'a',
          name: 'alpha',
          cwd: '/alpha',
          firstPlanLine: null,
          resumeStatus: { kind: 'runningNow', matchedTabId: null },
          cwdHistory: [],
        },
      ],
    });
    window.seeya = createFakeSeeyaApi({ getTodayPanel: () => Promise.resolve(data) });
    const { result } = renderHook(() => useToday());
    await act(async () => {
      await Promise.resolve();
    });

    act(() => result.current.toggleSession('a', true));
    expect(result.current.selectedCount).toBe(0);
  });

  it('hasResumable is false when every row is runningNow', async () => {
    const data = pendingData({
      rows: [
        {
          sessionId: 'a',
          displaySessionId: 'a',
          name: 'alpha',
          cwd: '/alpha',
          firstPlanLine: null,
          resumeStatus: { kind: 'runningNow', matchedTabId: null },
          cwdHistory: [],
        },
      ],
    });
    window.seeya = createFakeSeeyaApi({ getTodayPanel: () => Promise.resolve(data) });
    const { result } = renderHook(() => useToday());
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.hasResumable).toBe(false);
  });

  describe('resumeSelected', () => {
    it('does nothing with no selection', async () => {
      const resumeSelected = vi.fn();
      window.seeya = createFakeSeeyaApi({
        getTodayPanel: () => Promise.resolve(pendingData()),
        resumeSelected,
      });
      const { result } = renderHook(() => useToday());
      await act(async () => {
        await Promise.resolve();
      });

      act(() => result.current.resumeSelected());
      expect(resumeSelected).not.toHaveBeenCalled();
    });

    it('submits the day, the selected sessionIds, and any chosen directories', async () => {
      const resumeSelected = vi.fn(() => Promise.resolve(resumedResponse()));
      window.seeya = createFakeSeeyaApi({
        getTodayPanel: () => Promise.resolve(pendingData()),
        resumeSelected,
      });
      const { result } = renderHook(() => useToday());
      await act(async () => {
        await Promise.resolve();
      });

      act(() => {
        result.current.toggleSession('a', true);
        result.current.setChosenCwd('a', '/chosen');
      });
      await act(async () => {
        result.current.resumeSelected();
        await Promise.resolve();
      });

      expect(resumeSelected).toHaveBeenCalledWith({
        day: '2026-09-30',
        sessionIds: ['a'],
        chosenCwdBySessionId: { a: '/chosen' },
      });
    });

    it('sets resuming=true immediately, and never submits twice while in flight', async () => {
      let resolveResume: ((response: ResumeSummaryResponse) => void) | undefined;
      const resumeSelected = vi.fn(
        () =>
          new Promise<ResumeSummaryResponse>((resolve) => {
            resolveResume = resolve;
          }),
      );
      window.seeya = createFakeSeeyaApi({
        getTodayPanel: () => Promise.resolve(pendingData()),
        resumeSelected,
      });
      const { result } = renderHook(() => useToday());
      await act(async () => {
        await Promise.resolve();
      });
      act(() => result.current.toggleSession('a', true));

      act(() => result.current.resumeSelected());
      expect(result.current.resuming).toBe(true);

      act(() => result.current.resumeSelected());
      expect(resumeSelected).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveResume?.(resumedResponse());
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(result.current.resuming).toBe(false);
    });

    it('applies the result, clears the selection, and refetches the panel once it resolves', async () => {
      const freshData = pendingData({ day: '2026-10-01' });
      const getTodayPanel = vi
        .fn()
        .mockResolvedValueOnce(pendingData())
        .mockResolvedValueOnce(freshData);
      const resumeSelected = vi.fn(() => Promise.resolve(resumedResponse()));
      window.seeya = createFakeSeeyaApi({ getTodayPanel, resumeSelected });
      const { result } = renderHook(() => useToday());
      await act(async () => {
        await Promise.resolve();
      });
      act(() => result.current.toggleSession('a', true));

      await act(async () => {
        result.current.resumeSelected();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current.result).toEqual(resumedResponse());
      expect(result.current.selectedSessionIds.size).toBe(0);
      expect(result.current.data).toEqual(freshData);
      expect(getTodayPanel).toHaveBeenCalledTimes(2);
    });
  });

  it('reflects a pushed resume progress event', () => {
    let pushProgress: ((event: { index: number; total: number; name: string }) => void) | undefined;
    window.seeya = createFakeSeeyaApi({
      getTodayPanel: () => Promise.resolve(pendingData()),
      onResumeProgress: (listener) => {
        pushProgress = listener;
      },
    });
    const { result } = renderHook(() => useToday());

    act(() => pushProgress?.({ index: 1, total: 2, name: 'alpha' }));
    expect(result.current.progress).toEqual({ index: 1, total: 2, name: 'alpha' });
  });
});
