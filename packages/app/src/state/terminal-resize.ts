/**
 * Whether a measured terminal size should actually reach the pty, and with what dimensions — the
 * single place `TerminalPane`'s own `fit()` asks before calling `resizeTab`, instead of each
 * caller re-deriving the same checks.
 *
 * Maintainer diagnosis (2026-10-02, real Windows reproduction): collapsing/expanding the sidebar
 * (or switching to a page tab) while a terminal tab sits hidden used to still run
 * `useTabStrip.ts`'s own `fitAll()` against EVERY registered handle, including the hidden one's.
 * `@xterm/addon-fit#FitAddon.proposeDimensions` measures `getComputedStyle` on the terminal's own
 * parent element — for anything inside a `display: none` ancestor (`hidden` → `TerminalPane.module
 * .css`'s own `.pane`), that resolves to `0px` width/height, and the addon's own `Math.max(2, …)`/
 * `Math.max(1, …)` clamps floor right down to a 2×1 terminal rather than refusing outright. Sent
 * to the pty, ConPTY/the shell re-lays out its own line-wrapping state for a 2×1 screen; switching
 * back to a visible, correctly-sized terminal never undoes that internal state for a shell that
 * only redraws the CHANGED region on resize (PowerShell, bash under WSL) — only for one that
 * redraws the whole screen regardless (cmd/clink's own full repaint, `claude`'s own TUI redraw).
 * `decideTerminalResize`'s own `hidden` case is what stops that 2×1 from ever being proposed to
 * the pty in the first place; the minimum-dimensions case is a second, independent guard against
 * any OTHER path that might one day measure a degenerate size while visible.
 */
export interface TerminalDimensions {
  readonly cols: number;
  readonly rows: number;
}

/** `docs/INTERFACE.md`'s own "mínimo razoável, ex.: ≥ 2×1" — also xterm's own `FitAddon` floor
 * (`Math.max(2, …)`/`Math.max(1, …)`), repeated here as an independent guard rather than trusted
 * to always be the only source of a small-but-"valid"-looking value. */
const MIN_COLS = 2;
const MIN_ROWS = 1;

export type TerminalResizeDecision =
  | { readonly kind: 'skip'; readonly reason: 'hidden' | 'invalidDimensions' | 'unchanged' }
  | { readonly kind: 'resize'; readonly dimensions: TerminalDimensions };

function isValidDimensions(dimensions: TerminalDimensions): boolean {
  return (
    Number.isFinite(dimensions.cols) &&
    Number.isFinite(dimensions.rows) &&
    dimensions.cols >= MIN_COLS &&
    dimensions.rows >= MIN_ROWS
  );
}

function isUnchanged(dimensions: TerminalDimensions, previous: TerminalDimensions | null): boolean {
  return (
    previous !== null && previous.cols === dimensions.cols && previous.rows === dimensions.rows
  );
}

/**
 * @example
 * decideTerminalResize(true, { cols: 2, rows: 1 }, null);
 * // -> { kind: 'skip', reason: 'hidden' }
 * decideTerminalResize(false, { cols: 80, rows: 24 }, null);
 * // -> { kind: 'resize', dimensions: { cols: 80, rows: 24 } }
 */
export function decideTerminalResize(
  hidden: boolean,
  measured: TerminalDimensions,
  previous: TerminalDimensions | null,
): TerminalResizeDecision {
  if (hidden) {
    return { kind: 'skip', reason: 'hidden' };
  }
  if (!isValidDimensions(measured)) {
    return { kind: 'skip', reason: 'invalidDimensions' };
  }
  if (isUnchanged(measured, previous)) {
    return { kind: 'skip', reason: 'unchanged' };
  }
  return { kind: 'resize', dimensions: measured };
}
