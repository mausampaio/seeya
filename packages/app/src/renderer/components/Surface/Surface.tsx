/**
 * D-052 (V2-T75): the card/panel primitive — `padding`, `radius`, `elevation` and `variant`, all
 * typed against the token scale (`renderer/components/tokens.ts`), never a pixel or a hand-picked
 * colour at the call site.
 *
 * @example
 * <Surface variant="subtle" padding="sm" radius="sm">
 *   <TodayCard/>
 * </Surface>
 */
import type { ComponentChildren, JSX } from 'preact';
import styles from './Surface.module.css';
import { cx, mergeClassName } from '../css-class.js';
import type { ElevationToken, RadiusToken, SpaceToken } from '../tokens.js';
import { elevationValue, radiusValue, spaceValue } from '../tokens.js';

export type SurfaceVariant = 'default' | 'subtle' | 'elevated';

export interface SurfaceProps {
  readonly variant?: SurfaceVariant;
  readonly padding?: SpaceToken;
  readonly radius?: RadiusToken;
  readonly elevation?: ElevationToken;
  /** A 1px border in `--seeya-border` — on by default (most surfaces in this app are cards with a
   * visible edge); off for a surface that only ever needs a colour change from its parent. */
  readonly bordered?: boolean;
  readonly id?: string;
  readonly className?: string;
  readonly children?: ComponentChildren;
}

export function Surface(props: SurfaceProps): JSX.Element {
  const bordered = props.bordered ?? true;
  const className = mergeClassName(
    cx(styles, 'surface', props.variant ?? 'default', bordered && 'bordered'),
    props.className,
  );
  return (
    <div
      id={props.id}
      class={className}
      style={{
        padding: spaceValue(props.padding ?? 'none'),
        borderRadius: radiusValue(props.radius ?? 'none'),
        boxShadow: elevationValue(props.elevation ?? 'none'),
      }}
    >
      {props.children}
    </div>
  );
}
