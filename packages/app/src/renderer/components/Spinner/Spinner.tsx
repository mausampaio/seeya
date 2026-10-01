/**
 * The loading indicator (D-052, maintainer's own complement, V2-T65-estado-na-tela — item 2's
 * "estado de trabalho vira prop do componente"): a small rotating arc, same stroke language as
 * `Icon`'s own outline set (`currentColor`, rounded linecap, drawn on the 24-unit grid) so it
 * never reads as a foreign widget next to an icon or a line of text. `Button`/`IconButton`/
 * `Switch` were the first callers; Today's own `ResumeProgress` (V2-T66) is the first that isn't a
 * control's own loading slot — this component itself has no opinion on WHERE it sits, that's each
 * caller's own layout.
 *
 * `prefers-reduced-motion` needs no handling here: `renderer/tokens.css`'s own global rule already
 * forces every animation's `animation-duration`/`animation-iteration-count` down to effectively
 * nothing for anyone with that preference, which turns this spinner into a static arc instead of
 * removing it — "indicador estático" rather than silence, the maintainer's own wording.
 *
 * @example
 * {loading && <Spinner size={16} />}
 */
import type { JSX } from 'preact';
import styles from './Spinner.module.css';
import { cx, mergeClassName } from '../css-class.js';

export interface SpinnerProps {
  readonly size?: number;
  readonly className?: string;
}

const DEFAULT_SIZE = 16;

export function Spinner(props: SpinnerProps = {}): JSX.Element {
  const size = props.size ?? DEFAULT_SIZE;
  return (
    <svg
      width={size}
      height={size}
      style={{ width: `${size}px`, height: `${size}px`, flexShrink: 0 }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      class={mergeClassName(cx(styles, 'spinner'), props.className)}
      // `role="status"` would announce once per mount, which is wrong here — the OWNING control
      // (a `Button`/`IconButton`/`Switch` with `aria-busy="true"`) is what tells assistive tech
      // "busy", this is a purely visual accompaniment.
      aria-hidden="true"
    >
      {/* A faint full ring (identity's own muted-stroke convention) plus a brighter quarter-arc
       * that the CSS animation rotates — the standard "spinner" shape, never a filled disc (this
       * design system draws nothing filled except the two media-control icons, `Icon.tsx`'s own
       * docstring). */}
      <circle cx="12" cy="12" r="9" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" />
    </svg>
  );
}
