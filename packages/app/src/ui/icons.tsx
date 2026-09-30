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

function outlineIcon(paths: readonly JSX.Element[], props: IconProps = {}): JSX.Element {
  const size = props.size ?? DEFAULT_SIZE;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
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
