// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/preact';
import { createFakeSeeyaApi } from '../../_fake-seeya-api.js';
import { useEndDay } from '../../../../../../packages/app/src/renderer/features/end-day/useEndDay.js';
import type {
  EndDayPreviewResponse,
  EndDayProgressUpdateEvent,
  EndDayRunResponse,
} from '../../../../../../packages/app/src/ipc/channels.js';

type ProgressListener = (event: EndDayProgressUpdateEvent) => void;

// Measured while writing this file: `preact/test-utils#act` only calls `rerender()` (flushing
// Preact's pending state updates) once the CALLBACK's own returned promise settles — not after
// each `await` inside it. A single combined `await act(async () => { result.current.x();
// await Promise.resolve(); })` therefore never actually flushes the state update from `x()`
// until the WHOLE callback finishes, so a `.then()` callback elsewhere (e.g. `useEndDay.ts
// #open`'s own `stateRef.current.kind !== 'previewPending'` guard) that runs in between still
// sees the OLD state. Splitting into a plain, SYNCHRONOUS `act(() => result.current.x())` (which
// flushes immediately, since a non-thenable callback's `finish()` runs right away) followed by a
// SEPARATE `await act(async () => { await Promise.resolve(); })` to let any already-queued
// `.then()` callback run against the now-current ref is what actually exercises the real ordering
// a live window has (`queueMicrotask`-based rendering, no `act()` deferral at all).
//
// `run()` calls the LEGACY `refreshTodayPanel()` on finish (this hook's own docstring: "use o
// canal/dado que já existe", V2-T69's own instruction not to touch the Today feature) — that
// function reaches for `document.getElementById('today-panel')` directly (`today-panel-view.ts`),
// which only exists because `app-shell.tsx` renders it as part of the full window. This stub
// stands in for that element so the real function doesn't throw against a bare happy-dom document
// — the SAME role a real render of `<AppShell/>` would play, just without mounting the whole tree
// for a test that's only about `useEndDay`'s own state machine.
let todayPanelStub: HTMLElement;

beforeEach(() => {
  todayPanelStub = document.createElement('div');
  todayPanelStub.id = 'today-panel';
  document.body.appendChild(todayPanelStub);
});

afterEach(() => {
  cleanup();
  todayPanelStub.remove();
});

const EMPTY_PREVIEW: EndDayPreviewResponse = {
  willBeCaptured: [],
  notCaptured: [],
  costCeiling: {
    sessionsInScope: 0,
    budgetPerSessionUsd: 0.5,
    captureModel: 'sonnet',
    totalCeilingUsd: 0,
  },
};

const ONE_SESSION_PREVIEW: EndDayPreviewResponse = {
  willBeCaptured: [
    { sessionId: 's1', name: 'alpha', cwd: '~/alpha', state: 'ended', mode: 'lean' },
  ],
  notCaptured: [],
  costCeiling: {
    sessionsInScope: 1,
    budgetPerSessionUsd: 0.5,
    captureModel: 'sonnet',
    totalCeilingUsd: 0.5,
  },
};

describe('useEndDay (V2-T69)', () => {
  it('starts idle', () => {
    window.seeya = createFakeSeeyaApi();
    const { result } = renderHook(() => useEndDay());
    expect(result.current.state).toEqual({ kind: 'idle' });
  });

  it('triggerClicked from idle fetches and applies the preview', async () => {
    const endDayPreview = vi.fn(() => Promise.resolve(EMPTY_PREVIEW));
    window.seeya = createFakeSeeyaApi({ endDayPreview });
    const { result } = renderHook(() => useEndDay());

    void act(() => result.current.triggerClicked());
    expect(result.current.state.kind).toBe('previewPending');

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.state).toEqual({ kind: 'preview', ...EMPTY_PREVIEW });
    expect(endDayPreview).toHaveBeenCalledTimes(1);
  });

  it('cancel from preview returns to idle, with no second fetch on the next triggerClicked', async () => {
    const endDayPreview = vi.fn(() => Promise.resolve(EMPTY_PREVIEW));
    window.seeya = createFakeSeeyaApi({ endDayPreview });
    const { result } = renderHook(() => useEndDay());

    void act(() => result.current.triggerClicked());
    await act(async () => {
      await Promise.resolve();
    });
    void act(() => result.current.cancel());
    expect(result.current.state).toEqual({ kind: 'idle' });

    void act(() => result.current.triggerClicked());
    expect(endDayPreview).toHaveBeenCalledTimes(2);
  });

  it('a stale preview response is dropped if cancelled while in flight (D-025)', async () => {
    let resolvePreview: ((value: EndDayPreviewResponse) => void) | undefined;
    const endDayPreview = vi.fn(
      () => new Promise<EndDayPreviewResponse>((resolve) => (resolvePreview = resolve)),
    );
    window.seeya = createFakeSeeyaApi({ endDayPreview });
    const { result } = renderHook(() => useEndDay());

    void act(() => result.current.triggerClicked());
    void act(() => result.current.cancel());
    expect(result.current.state).toEqual({ kind: 'idle' });

    await act(async () => {
      resolvePreview?.(EMPTY_PREVIEW);
      await Promise.resolve();
    });
    expect(result.current.state).toEqual({ kind: 'idle' });
  });

  it('run walks preview -> starting -> running (via progress) -> result, refreshing Today', async () => {
    const endDayRun = vi.fn(() =>
      Promise.resolve<EndDayRunResponse>({
        captured: [
          { sessionId: 's1', name: 'alpha', cwd: '~/alpha', state: 'ended', mode: 'lean' },
        ],
        failed: [],
        skipped: [],
      }),
    );
    let progressListener: ProgressListener | undefined;
    window.seeya = createFakeSeeyaApi({
      endDayPreview: () => Promise.resolve(ONE_SESSION_PREVIEW),
      endDayRun,
      onEndDayProgress: (listener) => {
        progressListener = listener;
      },
    });
    const { result } = renderHook(() => useEndDay());

    void act(() => result.current.triggerClicked());
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.state.kind).toBe('preview');

    void act(() => result.current.run());
    expect(result.current.state.kind).toBe('starting');

    void act(() => {
      progressListener?.({ kind: 'started', sessionId: 's1', name: 'alpha', index: 1, total: 1 });
    });
    expect(result.current.state).toMatchObject({
      kind: 'running',
      current: { index: 1, total: 1 },
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.state.kind).toBe('result');
    expect(endDayRun).toHaveBeenCalledTimes(1);
  });

  it('hide flips visible while running, and triggerClicked reopens it without re-fetching', async () => {
    let progressListener: ProgressListener | undefined;
    const endDayPreview = vi.fn(() => Promise.resolve(ONE_SESSION_PREVIEW));
    window.seeya = createFakeSeeyaApi({
      endDayPreview,
      endDayRun: () => new Promise(() => {}),
      onEndDayProgress: (listener) => {
        progressListener = listener;
      },
    });
    const { result } = renderHook(() => useEndDay());
    void act(() => result.current.triggerClicked());
    await act(async () => {
      await Promise.resolve();
    });
    void act(() => result.current.run());
    void act(() => {
      progressListener?.({ kind: 'started', sessionId: 's1', name: 'alpha', index: 1, total: 1 });
    });
    expect(result.current.state).toMatchObject({ kind: 'running', visible: true });

    void act(() => result.current.hide());
    expect(result.current.state).toMatchObject({ kind: 'running', visible: false });

    void act(() => result.current.triggerClicked());
    expect(result.current.state).toMatchObject({ kind: 'running', visible: true });
    expect(endDayPreview).toHaveBeenCalledTimes(1);
  });

  it('openToday closes a finished result back to idle', async () => {
    const endDayRun = vi.fn(() =>
      Promise.resolve<EndDayRunResponse>({ captured: [], failed: [], skipped: [] }),
    );
    window.seeya = createFakeSeeyaApi({
      endDayPreview: () => Promise.resolve(EMPTY_PREVIEW),
      endDayRun,
    });
    const { result } = renderHook(() => useEndDay());
    void act(() => result.current.triggerClicked());
    await act(async () => {
      await Promise.resolve();
    });
    // Zero sessions in scope (`EMPTY_PREVIEW`): `runFinished` lands straight from `starting`, no
    // `sessionStarted` event ever fires (`state/end-day-panel.ts`'s own docstring on why).
    void act(() => result.current.run());
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.state.kind).toBe('result');

    void act(() => result.current.openToday());
    expect(result.current.state).toEqual({ kind: 'idle' });
  });
});
