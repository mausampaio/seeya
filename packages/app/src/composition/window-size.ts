/**
 * The main window's size and its floor (V2-T77, maintainer decision of 2026-10-02): the window used
 * to define no minimum at all, and below roughly 1200px the Projects/Sessions tables become
 * unreadable (their fixed-width columns leave the flexible ones — name, directory, project — a
 * negative share, `SessionsTable.tsx`'s own width-budget docstring). `minWidth` is that 1200px.
 *
 * `WINDOW_MIN_HEIGHT` (700) is MEASURED, not guessed — real window, real build, 1200px wide,
 * `SEEYA_APP_VERIFY_WINDOW_MIN_DIR`'s own `metrics.json`, with the sidebar's FULL non-scrolling
 * content (Today card, a Recent list at its five-row cap, All projects, Sessions, the footer): it
 * fits without scrolling at 700 (its lowest control, the daemon pill, ends at 687 of a 703px
 * viewport) and does NOT at 690 (the sidebar's own scroll container takes over), so 700 is the
 * smallest round height where the whole lateral is visible at once. Dialogs never bind it: every
 * `<dialog>` is capped at 90% of the viewport with its own internal scroll, so the Settings
 * dialog's `Done` footer stayed inside the viewport at every height tried (down to 440). Favorites
 * beyond what fits scroll inside the sidebar by design at any height — they are unbounded, no
 * minimum could hold them all.
 *
 * Pure so the floor is a fact a test pins, not a number buried in `main.ts` — `resolveWindowSize`
 * also clamps a verification override (`SEEYA_APP_WINDOW_WIDTH`/`_HEIGHT`) up to the floor: Electron
 * enforces `minWidth`/`minHeight` anyway, and a size this module reports must be one the window can
 * actually have.
 */
export const WINDOW_MIN_WIDTH = 1200;
export const WINDOW_MIN_HEIGHT = 700;
export const WINDOW_DEFAULT_WIDTH = 1200;
export const WINDOW_DEFAULT_HEIGHT = 800;

export interface WindowSize {
  readonly width: number;
  readonly height: number;
  readonly minWidth: number;
  readonly minHeight: number;
}

function resolveDimension(raw: string | undefined, fallback: number, minimum: number): number {
  // `Number('')` is `0`, not `NaN` (same trap `quitAfterConfiguredDelay` already documents): an
  // empty value must read as "not set", never as a request for a zero-sized window.
  const parsed = Number(raw ?? '');
  const value =
    raw === undefined || raw.trim() === '' || !Number.isFinite(parsed) ? fallback : parsed;
  return Math.max(value, minimum);
}

/**
 * @example
 * resolveWindowSize(undefined, undefined) // { width: 1200, height: 800, minWidth: 1200, minHeight: 700 }
 * resolveWindowSize('1600', '900').width // 1600
 * resolveWindowSize('900', '300') // clamped: width 1200, height 700
 */
export function resolveWindowSize(
  widthOverride: string | undefined,
  heightOverride: string | undefined,
): WindowSize {
  return {
    width: resolveDimension(widthOverride, WINDOW_DEFAULT_WIDTH, WINDOW_MIN_WIDTH),
    height: resolveDimension(heightOverride, WINDOW_DEFAULT_HEIGHT, WINDOW_MIN_HEIGHT),
    minWidth: WINDOW_MIN_WIDTH,
    minHeight: WINDOW_MIN_HEIGHT,
  };
}
