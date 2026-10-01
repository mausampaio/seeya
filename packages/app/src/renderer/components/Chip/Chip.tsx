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
import { Text } from '../Text/index.js';
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
  return (
    <span class={className}>
      {/* D-052 item 7 (PO review, 2026-10-01): "rótulo da pílula... em body-sm" — `Text` gives the
       * size, but `Chip.module.css`'s own `.soft.success`/etc still decide the COLOUR (a semantic
       * tone, not a typographic one — the same split `ProjectRow`'s lock status already draws).
       * `span.chipLabel`'s own `color: inherit` (that file) beats `Text`'s own `.tonePrimary` by
       * specificity, pulling the chip's own colour back down instead of `Text`'s default. */}
      <Text as="span" variant="body-sm" weight={500} className={cx(styles, 'chipLabel')}>
        {props.children}
      </Text>
    </span>
  );
}
