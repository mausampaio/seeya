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
 */
import { useEffect, useState } from 'preact/hooks';

export function useIpcSubscription<T>(
  subscribe: (listener: (event: T) => void) => () => void,
  initial: T,
): T {
  const [value, setValue] = useState<T>(initial);
  // Runs once, on mount — `subscribe` is always a stable, bound `SeeyaApi` method (the SAME
  // `window.seeya` singleton for the life of the window), never a value that legitimately
  // changes between renders, so an empty dependency array is correct here, not a shortcut.
  useEffect(() => subscribe(setValue), []);
  return value;
}
