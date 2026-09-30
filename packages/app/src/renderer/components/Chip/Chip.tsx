/**
 * D-052 (V2-T75): the counter and the status pill — one component, replacing `StatusPill`
 * (V2-T62; no production caller yet, so this is a straight substitution, never a duplicate).
 * Always text, never colour alone (identity § 8: "estado sempre com texto ou ícone, nunca só
 * cor") — `children` is required, not optional. Content is always centered
 * (`Chip.module.css`'s own docstring has the V2-T63 aceite defect this fixes).
 *
 * @example
 * <Chip tone="success">Daemon running</Chip>
 * <Chip tone="success" size="sm">3 running</Chip>
 * <Chip tone="neutral" variant="outline" size="sm">12</Chip>
 */
import type { ComponentChildren, JSX } from 'preact';
import styles from './Chip.module.css';
import { cx, mergeClassName } from '../css-class.js';
import type { Size, Tone } from '../props.js';

export type ChipVariant = 'solid' | 'soft' | 'outline';

export interface ChipProps {
  readonly tone: Tone;
  readonly variant?: ChipVariant;
  readonly size?: Size;
  readonly className?: string;
  readonly children: ComponentChildren;
}

export function Chip(props: ChipProps): JSX.Element {
  const variant = props.variant ?? 'soft';
  const className = mergeClassName(
    cx(styles, 'chip', props.size ?? 'md', variant, props.tone),
    props.className,
  );
  return <span class={className}>{props.children}</span>;
}
