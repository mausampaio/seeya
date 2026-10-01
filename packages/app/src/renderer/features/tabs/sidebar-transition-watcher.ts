/**
 * Tracks whether the sidebar's own width transition (`Sidebar.module.css`'s own `transition:
 * width ...`, `--seeya-motion-panel`, 200ms) is currently in flight, so `TabStrip.tsx`'s own
 * `ResizeObserver` can defer `fitAll()` until it settles instead of fitting (and resizing every
 * pty) on each intermediate frame along the way (maintainer diagnosis, 2026-10-02: collapsing the
 * sidebar while a terminal tab sits hidden used to send the pty a near-zero resize mid-transition,
 * corrupting PowerShell/bash's own line-wrapping state — `../../../state/terminal-resize.ts`'s own
 * docstring has the measured mechanism).
 *
 * `document`-level `transitionstart`/`transitionend`, not a ref/import of `#sidebar` itself: the
 * `tabs`/`sidebar` features stay decoupled (`transitionstart`/`transitionend` bubble regardless of
 * where `#sidebar` lives in the tree) — `propertyName === 'width'` is specific enough on its own
 * (confirmed by grep: `Sidebar.module.css` is the only `width` transition in this renderer). The
 * fallback timer covers `transitionend` never firing at all: `prefers-reduced-motion` zeroes every
 * transition-duration (`tokens.css`'s own global override), and a transition with 0 duration never
 * actually transitions, so the browser never dispatches the event for it.
 *
 * @example
 * const watcher = watchSidebarWidthTransition({ onSettled: () => data.fitAll() });
 * // ...
 * if (!watcher.isTransitioning()) { ... }
 * // ...
 * watcher.dispose();
 */

/** Generous: double `Sidebar.module.css`'s own 200ms duration, covering a slow first frame rather
 * than racing it exactly. */
const FALLBACK_DURATION_MS = 400;

/** `requestAnimationFrame`/`cancelAnimationFrame`/`performance.now` behind a small injectable
 * seam — not a full `Clock` port (D-019 is about the deterministic BUSINESS clock in
 * `core`/`application`; this is animation-frame scheduling in the renderer, a different concern),
 * but the same "inject it" instinct pays for itself here: a test can swap in a scheduler whose
 * `requestFrame` never fires on its own, instead of waiting on real animation frames/wall-clock
 * time to exercise the fallback path. */
export interface FrameScheduler {
  readonly now: () => number;
  readonly requestFrame: (callback: () => void) => number;
  readonly cancelFrame: (handle: number) => void;
}

const REAL_FRAME_SCHEDULER: FrameScheduler = {
  now: () => performance.now(),
  requestFrame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (handle) => cancelAnimationFrame(handle),
};

/**
 * A `setTimeout`-shaped fallback built from `requestAnimationFrame` polling instead — D-019 bans
 * `setTimeout`/`setInterval` outright in this renderer too (`eslint.config.js`'s own rule, and
 * `TabStrip.tsx`'s own pre-existing rAF debounce already made the same call for the identical
 * reason). Returns a cancel function.
 */
function scheduleRafFallback(
  onElapsed: () => void,
  maxDurationMs: number,
  scheduler: FrameScheduler,
): () => void {
  const start = scheduler.now();
  let frame: number | null = null;
  function tick(): void {
    if (scheduler.now() - start >= maxDurationMs) {
      frame = null;
      onElapsed();
      return;
    }
    frame = scheduler.requestFrame(tick);
  }
  frame = scheduler.requestFrame(tick);
  return () => {
    if (frame !== null) {
      scheduler.cancelFrame(frame);
    }
  };
}

export interface SidebarTransitionWatcher {
  readonly isTransitioning: () => boolean;
  readonly dispose: () => void;
}

export function watchSidebarWidthTransition(
  callbacks: { readonly onSettled: () => void },
  scheduler: FrameScheduler = REAL_FRAME_SCHEDULER,
): SidebarTransitionWatcher {
  let transitioning = false;
  let cancelFallback: (() => void) | null = null;

  function settle(): void {
    transitioning = false;
    if (cancelFallback !== null) {
      cancelFallback();
      cancelFallback = null;
    }
    callbacks.onSettled();
  }

  function handleStart(event: TransitionEvent): void {
    if (event.propertyName !== 'width') {
      return;
    }
    transitioning = true;
    if (cancelFallback !== null) {
      cancelFallback();
    }
    cancelFallback = scheduleRafFallback(settle, FALLBACK_DURATION_MS, scheduler);
  }

  function handleEnd(event: TransitionEvent): void {
    if (event.propertyName !== 'width') {
      return;
    }
    settle();
  }

  document.addEventListener('transitionstart', handleStart);
  document.addEventListener('transitionend', handleEnd);

  return {
    isTransitioning: () => transitioning,
    dispose: () => {
      document.removeEventListener('transitionstart', handleStart);
      document.removeEventListener('transitionend', handleEnd);
      if (cancelFallback !== null) {
        cancelFallback();
      }
    },
  };
}
