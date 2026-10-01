/**
 * The icon set (V2-T63 correction, real-window screenshot review against
 * `design/IDENTIDADE_VISUAL.md` § 6.4: "traço arredondado entre 1,5 e 2px; grade preferencial de
 * 20 ou 24px; linguagem simples e geométrica; evitar ícones preenchidos misturados com ícones
 * outline; não usar sparkles para representar IA de forma genérica"). Replaces the emoji glyphs
 * (📅/📁/💬/★) the lateral was using — never emoji, and the star's own colour is the marca's own
 * `--seeya-brand-text`, never yellow/orange.
 *
 * Every icon is drawn on a 24-unit grid, one style per icon (outline — `fill="none"`,
 * `stroke="currentColor"` — or filled — `fill="currentColor"`, `stroke="none"` — never both mixed
 * within the same icon): `CalendarIcon`/`FolderIcon`/`ChatBalloonIcon`/`ChevronLeftIcon`/
 * `PlusIcon`/`ClockIcon`/`SettingsIcon`/`TerminalIcon`/`CloseIcon` are outline; `PlayIcon`/
 * `StopIcon` are filled (the conventional shape for a media-style control, legible at a small
 * size in a way an outline triangle/square isn't); `StarIcon` is the one icon with a real
 * `filled` prop (outline by default, filled — brand-coloured — only when `filled` is true, the
 * spec's own "contorno; preenchida só quando favorito").
 *
 * **Two ways to use these, one source of truth.** `app-shell.tsx` (already `.tsx`, mounted once)
 * uses the JSX components directly. Every OTHER caller is a plain `.ts` imperative DOM module
 * (`electron/*-view.ts`, none of them Preact components — V2-T62's own architecture: the app
 * shell's tree is mounted once and never revisited) — those call `mountIcon(container, h(Icon,
 * props))` (`h`/`render` from `'preact'`, no JSX syntax needed in a `.ts` file), which is the SAME
 * component rendered into a small, independent container rather than a second hand-drawn copy of
 * the same paths that could drift from this one.
 *
 * Tested the same way every other `packages/app/src/ui/*.tsx` component already is (this
 * directory's own convention, D-051: no `jsdom`/component-test library) — calling the function
 * directly and inspecting the vnode it returns.
 *
 * @example
 * <CalendarIcon /> // inside a .tsx file
 * mountIcon(container, h(StarIcon, { filled: true })); // inside a plain .ts file
 */
import { render, type JSX } from 'preact';

export interface IconProps {
  /** Rendered size in px — the SVG's own internal geometry always stays on the 24-unit grid
   * (identity § 6.4), this only scales the viewBox down/up for where it sits. */
  readonly size?: number;
  readonly class?: string;
}

const DEFAULT_SIZE = 16;
const VIEW_BOX_SIZE = 24;

/**
 * PO review (defect 2, V2-T75): pixel-sampled a real screenshot of the sidebar's ghost
 * `IconButton`s (`‹` collapse, `+` new project) and found the brightest pixel on the stroke
 * blending to only ~30%/~40% coverage of `--seeya-text-secondary` against the surface in
 * light/dark — not a wrong color (the token was already correct), a stroke too thin to read.
 * `strokeWidth="1.75"` is a VIEWBOX-SPACE number — this docstring's own identity quote (§ 6.4)
 * requires "traço arredondado entre 1,5 e 2px" as a RENDERED pixel measurement, but a fixed
 * viewBox-space width scales down WITH the icon: at the `size=16` these buttons use, 1.75 of a
 * 24-unit box renders as 1.75×(16/24) ≈ 1.17 actual px, well under the identity's own floor.
 * Computing `strokeWidth` from the requested `size` keeps the RENDERED stroke at a constant
 * `TARGET_STROKE_WIDTH_PX` (the middle of the identity's 1.5–2px range) no matter what `size` a
 * caller asks for — this fixes every outline icon in the set, not just the two the PO sampled,
 * since the mis-scaling was in the shared builder, not either call site.
 */
const TARGET_STROKE_WIDTH_PX = 2;

/**
 * PO review (defect 2, round 2, V2-T75): bumping `size`/`strokeWidth` (above) never changed a
 * single rendered pixel, because the real cause was neither — `getComputedStyle` on the live
 * `<svg>` inside `#sidebar-collapse-toggle`/`#new-project-button` showed `width: 10px` against an
 * `attrWidth` of `"24"`, with `matchedRules: []` (no stylesheet rule, confirmed by walking every
 * loaded sheet and `element.matches()`), while a sibling-free, perfectly-sized 24px flex parent
 * sat right above it. The `width`/`height` HTML attributes on `<svg>` are UA-stylesheet
 * PRESENTATIONAL HINTS, not CSS — Chromium's flexbox `flex-basis: auto` resolution does not treat
 * them as "a specified size" for an SVG the way it does for `<img>`, so the item's hypothetical
 * main size falls back to something far smaller than the intended square (confirmed identical
 * across two icons with completely different path geometry — "<" and "+" — ruling out a
 * content/bounding-box explanation). An explicit CSS `width`/`height` (inline `style`, below)
 * always outranks a presentational attribute and IS picked up by `flex-basis: auto`, so the box
 * stays the full requested size regardless of context.
 */
function sizeStyle(size: number) {
  return { width: `${size}px`, height: `${size}px`, flexShrink: 0 };
}

function outlineIcon(paths: readonly JSX.Element[], props: IconProps = {}): JSX.Element {
  const size = props.size ?? DEFAULT_SIZE;
  const strokeWidth = (TARGET_STROKE_WIDTH_PX * VIEW_BOX_SIZE) / size;
  return (
    <svg
      width={size}
      height={size}
      style={sizeStyle(size)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      class={props.class}
      aria-hidden="true"
    >
      {paths}
    </svg>
  );
}

function filledIcon(paths: readonly JSX.Element[], props: IconProps = {}): JSX.Element {
  const size = props.size ?? DEFAULT_SIZE;
  return (
    <svg
      width={size}
      height={size}
      style={sizeStyle(size)}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      class={props.class}
      aria-hidden="true"
    >
      {paths}
    </svg>
  );
}

export function CalendarIcon(props: IconProps = {}): JSX.Element {
  return outlineIcon(
    [
      <rect x="4" y="5" width="16" height="15" rx="2" />,
      <path d="M4 9.5h16" />,
      <path d="M8 3v4" />,
      <path d="M16 3v4" />,
    ],
    props,
  );
}

export function FolderIcon(props: IconProps = {}): JSX.Element {
  return outlineIcon(
    [
      <path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17Z" />,
    ],
    props,
  );
}

export function ChatBalloonIcon(props: IconProps = {}): JSX.Element {
  return outlineIcon(
    [
      <path d="M4.5 5.5h15a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9.5l-4 3.5v-3.5h-1a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z" />,
    ],
    props,
  );
}

export interface StarIconProps extends IconProps {
  /** Outline by default — filled (brand colour, never yellow/orange) only when favorited
   * (identity § 6.4's own "preenchida só quando favorito"). */
  readonly filled?: boolean;
}

const STAR_PATH =
  'M12 3.25l2.6 5.35 5.83.58-4.34 4.05 1.19 5.77L12 16.1l-5.28 2.9 1.19-5.77-4.34-4.05 5.83-.58Z';

export function StarIcon(props: StarIconProps = {}): JSX.Element {
  const size = props.size ?? DEFAULT_SIZE;
  return (
    <svg
      width={size}
      height={size}
      style={sizeStyle(size)}
      viewBox="0 0 24 24"
      fill={props.filled === true ? 'var(--seeya-brand-text)' : 'none'}
      stroke={props.filled === true ? 'var(--seeya-brand-text)' : 'currentColor'}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      class={props.class}
      aria-hidden="true"
    >
      <path d={STAR_PATH} />
    </svg>
  );
}

export function PlusIcon(props: IconProps = {}): JSX.Element {
  return outlineIcon([<path d="M12 5v14M5 12h14" />], props);
}

/** Always points left — the lateral's own collapse button only ever collapses from this position
 * (V2-T63 correction: the sidebar's whole header, this button included, is hidden while
 * collapsed, so there's no "reopen" state for this specific icon to show — reopening is the
 * toolbar's own separate button). */
export function ChevronLeftIcon(props: IconProps = {}): JSX.Element {
  return outlineIcon([<path d="M15 5l-7 7 7 7" />], props);
}

export function PlayIcon(props: IconProps = {}): JSX.Element {
  return filledIcon(
    [
      <path d="M7.5 5.2v13.6a1 1 0 0 0 1.53.85l10.9-6.8a1 1 0 0 0 0-1.7l-10.9-6.8a1 1 0 0 0-1.53.85Z" />,
    ],
    props,
  );
}

export function StopIcon(props: IconProps = {}): JSX.Element {
  return filledIcon([<rect x="6" y="6" width="12" height="12" rx="1.5" />], props);
}

export function ClockIcon(props: IconProps = {}): JSX.Element {
  return outlineIcon([<circle cx="12" cy="12" r="8" />, <path d="M12 8v4l3 2" />], props);
}

export function SettingsIcon(props: IconProps = {}): JSX.Element {
  return outlineIcon(
    [
      <path d="M4 6h8M16 6h4M4 12h2M10 12h10M4 18h12M20 18h0" />,
      <circle cx="12" cy="6" r="2" />,
      <circle cx="6" cy="12" r="2" />,
      <circle cx="16" cy="18" r="2" />,
    ],
    props,
  );
}

export function TerminalIcon(props: IconProps = {}): JSX.Element {
  return outlineIcon(
    [
      <rect x="3" y="4.5" width="18" height="15" rx="2" />,
      <path d="M7.5 9.5l3 2.5-3 2.5" />,
      <path d="M13 15h4" />,
    ],
    props,
  );
}

export function CloseIcon(props: IconProps = {}): JSX.Element {
  return outlineIcon([<path d="M6 6l12 12M18 6L6 18" />], props);
}

/**
 * The imperative half of this module's own docstring — mounts `vnode` into `container`
 * (typically a freshly created, empty `<span>`) via Preact's own `render`, so a `.ts` view module
 * with no JSX of its own reuses the EXACT SAME icon component `app-shell.tsx` uses, never a
 * second hand-copied SVG.
 *
 * `vnode` may be `null` to clear a container that previously held an icon (e.g. a disabled
 * button with nothing to show) — always through Preact's own `render(null, container)` unmount
 * path, never `container.textContent = ''` directly, which would leave this same container's
 * Preact-tracked state pointing at DOM nodes that direct manipulation just detached.
 *
 * @example
 * const icon = document.createElement('span');
 * icon.className = 'sidebar-nav-icon';
 * mountIcon(icon, h(FolderIcon, {}));
 */
export function mountIcon(container: HTMLElement, vnode: JSX.Element | null): void {
  render(vnode, container);
}
