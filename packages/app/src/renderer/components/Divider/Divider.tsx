/**
 * D-052 (V2-T75), PO review (2026-10-01): a 1px rule with breathing room above/below — this design
 * system's own first visual separator, between the lateral's Recent section and the
 * All projects/Sessions block (`docs/INTERFACE.md` § 1, per the prototype). A plain `<hr>` carries
 * the browser's own UA-stylesheet border/margin, which this project never relies on for any visual
 * value (`tokens.css` owns every one) — this component is the explicit, token-driven replacement,
 * same reasoning `Divider.module.css`'s own comment gives.
 *
 * @example
 * <Divider/>
 */
import type { JSX } from 'preact';
import styles from './Divider.module.css';
import { cx, mergeClassName } from '../css-class.js';

export interface DividerProps {
  readonly className?: string;
}

export function Divider(props: DividerProps = {}): JSX.Element {
  return <hr class={mergeClassName(cx(styles, 'divider'), props.className)} />;
}
