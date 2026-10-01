/**
 * D-052 (V2-T75): subscribes to a push channel from the preload bridge and keeps the latest
 * event as component state — "hook de assinatura de canal de IPC... com limpeza no desmonte".
 * `subscribe` is one of the six `SeeyaApi#onXUpdate` methods that return an unsubscribe function
 * (`main/preload.ts`'s own docstring on `onProjectsUpdate` explains why only those six do); this
 * hook calls it once, on mount, and calls the returned function back on unmount — the one place
 * that pairs a subscribe with its own cleanup, instead of every feature re-deriving the same
 * `useEffect` shape.
 *
 * @example
 * const projects = useIpcSubscription(getSeeyaApi().onProjectsUpdate, initialProjectsPanelData);
 *
 * V2-T75 PO review (2026-10-01, round 3), production defect: every caller used to seed `initial`
 * with a placeholder ("No favorites yet", an empty schedule strip, ...) and wait for the ambient
 * refresh loop's own push to ever replace it — but that loop's first tick fires as soon as the
 * window is created, before the renderer has necessarily finished registering this hook's own
 * listener, so that first push is lost and the real data only arrives on the SECOND tick, up to
 * `REFRESH_INTERVAL_MS * 2` later. `CHANNELS.getProjectsPanel`/`getTodayPanel` (and, since this
 * fix, `getScheduleStrip`/`getDaemonAvailability`) exist specifically to avoid this wait — they
 * were being called and their result thrown away (`void api.getProjectsPanel();`), which is the
 * defect: the invoke always answered correctly, nothing used the answer. `fetchInitial`, when
 * given, seeds state from that invoke's own return value as soon as it resolves, instead of
 * leaving the placeholder on screen for up to two refresh intervals. `receivedPushRef` keeps a
 * late-resolving invoke from ever clobbering a push that already arrived (a push is always at
 * least as fresh as an invoke issued no later).
 */
import { useEffect, useRef, useState } from 'preact/hooks';

export function useIpcSubscription<T>(
  subscribe: (listener: (event: T) => void) => () => void,
  initial: T,
  fetchInitial?: () => Promise<T>,
): T {
  const [value, setValue] = useState<T>(initial);
  const receivedPushRef = useRef(false);
  // Runs once, on mount — `subscribe`/`fetchInitial` are always stable, bound `SeeyaApi` methods
  // (the SAME `window.seeya` singleton for the life of the window), never values that legitimately
  // change between renders, so an empty dependency array is correct here, not a shortcut.
  useEffect(() => {
    const unsubscribe = subscribe((event) => {
      receivedPushRef.current = true;
      setValue(event);
    });
    if (fetchInitial !== undefined) {
      void fetchInitial().then((result) => {
        if (!receivedPushRef.current) {
          setValue(result);
        }
      });
    }
    return unsubscribe;
  }, []);
  return value;
}
