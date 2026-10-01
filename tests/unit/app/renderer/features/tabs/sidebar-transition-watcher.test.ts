// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  watchSidebarWidthTransition,
  type FrameScheduler,
} from '../../../../../../packages/app/src/renderer/features/tabs/sidebar-transition-watcher.js';

/** A scheduler whose `requestFrame` never fires on its own — the test drives it one "frame" at a
 * time via `advance`, and controls elapsed time directly, instead of waiting on real animation
 * frames/wall-clock time (`FrameScheduler`'s own docstring). */
function createFakeScheduler(): FrameScheduler & { readonly advance: (deltaMs: number) => void } {
  let elapsed = 0;
  let pending: (() => void) | null = null;
  let nextHandle = 1;
  return {
    now: () => elapsed,
    requestFrame: (callback) => {
      pending = callback;
      return nextHandle++;
    },
    cancelFrame: () => {
      pending = null;
    },
    advance: (deltaMs) => {
      elapsed += deltaMs;
      const callback = pending;
      pending = null;
      callback?.();
    },
  };
}

// happy-dom aliases `window.TransitionEvent` to the plain `Event` constructor (confirmed in
// `node_modules/happy-dom/lib/window/BrowserWindow.d.ts`: `readonly TransitionEvent: typeof
// Event`) — its init dict never sets `propertyName`, so a real `new TransitionEvent(kind, {
// propertyName })` call silently drops it in this test environment. Assigning the property
// directly after construction works fine instead: `propertyName` isn't one of `Event`'s own
// getters, so there's nothing blocking a plain assignment.
function dispatchTransition(kind: 'transitionstart' | 'transitionend', propertyName: string): void {
  const event = new Event(kind) as TransitionEvent;
  Object.defineProperty(event, 'propertyName', { value: propertyName, configurable: true });
  document.dispatchEvent(event);
}

afterEach(() => {
  // `watchSidebarWidthTransition` adds `document`-level listeners — every test below disposes
  // its own watcher, but a failed assertion before that line would otherwise leak one into the
  // next test (F.I.R.S.T.'s own "independente").
  vi.restoreAllMocks();
});

describe('watchSidebarWidthTransition', () => {
  it('starts not transitioning, and never calls onSettled before anything happens', () => {
    const onSettled = vi.fn();
    const watcher = watchSidebarWidthTransition({ onSettled }, createFakeScheduler());
    expect(watcher.isTransitioning()).toBe(false);
    expect(onSettled).not.toHaveBeenCalled();
    watcher.dispose();
  });

  it('ignores a transitionstart/transitionend for a property other than width', () => {
    const onSettled = vi.fn();
    const watcher = watchSidebarWidthTransition({ onSettled }, createFakeScheduler());
    dispatchTransition('transitionstart', 'opacity');
    expect(watcher.isTransitioning()).toBe(false);
    dispatchTransition('transitionend', 'opacity');
    expect(onSettled).not.toHaveBeenCalled();
    watcher.dispose();
  });

  it('transitionstart(width) marks transitioning; transitionend(width) settles and calls onSettled once', () => {
    const onSettled = vi.fn();
    const watcher = watchSidebarWidthTransition({ onSettled }, createFakeScheduler());
    dispatchTransition('transitionstart', 'width');
    expect(watcher.isTransitioning()).toBe(true);
    dispatchTransition('transitionend', 'width');
    expect(watcher.isTransitioning()).toBe(false);
    expect(onSettled).toHaveBeenCalledTimes(1);
    watcher.dispose();
  });

  it('falls back to onSettled after the max duration when transitionend never fires (e.g. prefers-reduced-motion)', () => {
    const onSettled = vi.fn();
    const scheduler = createFakeScheduler();
    const watcher = watchSidebarWidthTransition({ onSettled }, scheduler);
    dispatchTransition('transitionstart', 'width');
    scheduler.advance(399);
    expect(onSettled).not.toHaveBeenCalled();
    expect(watcher.isTransitioning()).toBe(true);
    scheduler.advance(1); // crosses the 400ms fallback threshold
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(watcher.isTransitioning()).toBe(false);
    watcher.dispose();
  });

  it('a real transitionend cancels the pending fallback — no double call', () => {
    const onSettled = vi.fn();
    const scheduler = createFakeScheduler();
    const watcher = watchSidebarWidthTransition({ onSettled }, scheduler);
    dispatchTransition('transitionstart', 'width');
    dispatchTransition('transitionend', 'width');
    expect(onSettled).toHaveBeenCalledTimes(1);
    scheduler.advance(1000); // far past the fallback duration
    expect(onSettled).toHaveBeenCalledTimes(1);
    watcher.dispose();
  });

  it('dispose() stops listening — a later transitionend never calls onSettled', () => {
    const onSettled = vi.fn();
    const watcher = watchSidebarWidthTransition({ onSettled }, createFakeScheduler());
    watcher.dispose();
    dispatchTransition('transitionstart', 'width');
    dispatchTransition('transitionend', 'width');
    expect(onSettled).not.toHaveBeenCalled();
  });
});
