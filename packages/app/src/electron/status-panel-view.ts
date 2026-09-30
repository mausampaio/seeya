/**
 * The plain-text status panel (split out of the former single-file `renderer.ts` by V2-T62/D-051).
 * Excluded from `packages/app/src`'s coverage floor with everything else in `electron/` (it
 * cannot run without a display).
 */

/** Wired once, at startup — pushed on the same refresh tick as `sessionsUpdate`
 * (`sidebar/sidebar-data.ts`, consumed elsewhere). */
export function wireStatusPanel(): void {
  window.seeya.onStatusUpdate(({ text }) => {
    const panel = document.getElementById('status-panel') as HTMLElement;
    panel.textContent = text;
  });
}
