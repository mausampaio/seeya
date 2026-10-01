/**
 * D-052 (V2-T75): the renderer's own typed client for the preload bridge — the ONE place that
 * reads `window.seeya` directly, so every hook/component imports `getSeeyaApi()` from here
 * instead of reaching for the global itself. `declare global` (the ambient `Window.seeya` typing)
 * lives here too, moved out of `renderer.tsx` — it belongs with the client that uses the type, not
 * with the bootstrap entry point.
 *
 * @example
 * const api = getSeeyaApi();
 * const panel = await api.getProjectsPanel();
 */
import type { SeeyaApi } from '../../main/preload.js';

declare global {
  interface Window {
    seeya: SeeyaApi;
  }
}

export type { SeeyaApi };

export function getSeeyaApi(): SeeyaApi {
  return window.seeya;
}
