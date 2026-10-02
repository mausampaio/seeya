/**
 * D-052 (V2-T69): the determinate progress bar — End day's own "Capturing i of N" (`docs/
 * INTERFACE.md` § 6 item 2), built as two plain `<div>`s (never an `<svg>`/`<canvas>`) so there is
 * no "unsized element inside a flex container" pitfall to repeat (the exact defect the V2-T75 PO
 * review found elsewhere in this design system — an icon's own `<svg>` with no explicit
 * width/height shrank to nothing next to flex siblings). The track's height comes from this
 * component's own CSS module, not an ambient line-height, so it never depends on what text happens
 * to sit next to it.
 *
 * @example
 * <ProgressBar value={2} max={5} label="Capturing 2 of 5" />
 */
import type { JSX } from 'preact';
import styles from './ProgressBar.module.css';
import { cx, mergeClassName } from '../css-class.js';

export interface ProgressBarProps {
  readonly value: number;
  readonly max: number;
  /** Read by assistive tech as the progressbar's own accessible name — never shown visually by
   * this component itself (the caller already renders the same fact as text above the bar). */
  readonly label: string;
  readonly className?: string;
}

/** `max <= 0` (nothing in scope yet, or a malformed call) never divides by zero into `NaN%` — 0%
 * is the honest, least-specific reading (D-025) until a real `max` arrives. */
function percentComplete(value: number, max: number): number {
  if (max <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, (value / max) * 100));
}

export function ProgressBar(props: ProgressBarProps): JSX.Element {
  const percent = percentComplete(props.value, props.max);
  return (
    <div
      class={mergeClassName(cx(styles, 'track'), props.className)}
      role="progressbar"
      aria-label={props.label}
      aria-valuemin={0}
      aria-valuemax={props.max}
      aria-valuenow={props.value}
    >
      <div class={cx(styles, 'fill')} style={{ width: `${String(percent)}%` }} />
    </div>
  );
}
