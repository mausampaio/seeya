/**
 * D-052 (V2-T75): the column-grid primitive — `columns` (default 12) and a child's own `span`,
 * both typed as a fixed literal union (1–24 for `columns`, 1–12 for `GridItem.span`, D-024: "o
 * tipo recusa o que a identidade não prevê" — `span={13}` on a 12-column grid is a compile error,
 * not a layout bug found by looking at a screenshot). `gap` is the one property that DOES come
 * from the shared token scale (`renderer/components/tokens.ts`), same as every other primitive.
 *
 * @example
 * <Grid columns={12} gap="md">
 *   <GridItem span={6}>Left</GridItem>
 *   <GridItem span={6}>Right</GridItem>
 * </Grid>
 */
import type { ComponentChildren, JSX } from 'preact';
import styles from './Grid.module.css';
import { cx, mergeClassName } from '../css-class.js';
import type { SpaceToken } from '../tokens.js';
import { spaceValue } from '../tokens.js';

/** The identity's own spacing grid has no opinion on column COUNT — this union exists so a
 * caller can't pass a fractional or out-of-range column count, not because every value in it is
 * expected to see real use (12 is the one this task's own layouts need). */
export type GridColumns = 1 | 2 | 3 | 4 | 6 | 8 | 12 | 16 | 24;

export type GridSpan = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export interface GridProps {
  readonly columns?: GridColumns;
  readonly gap?: SpaceToken;
  readonly id?: string;
  readonly className?: string;
  readonly children?: ComponentChildren;
}

export function Grid(props: GridProps): JSX.Element {
  const className = mergeClassName(cx(styles, 'grid'), props.className);
  return (
    <div
      id={props.id}
      class={className}
      style={{
        gap: spaceValue(props.gap ?? 'none'),
        // Custom property, read by `Grid.module.css`'s own `grid-template-columns` — see that
        // file's comment for why this one number stays outside the token scale.
        '--seeya-grid-columns': String(props.columns ?? 12),
      }}
    >
      {props.children}
    </div>
  );
}

export interface GridItemProps {
  readonly span: GridSpan;
  readonly id?: string;
  readonly className?: string;
  readonly children?: ComponentChildren;
}

export function GridItem(props: GridItemProps): JSX.Element {
  const className = mergeClassName(cx(styles, 'item'), props.className);
  return (
    <div id={props.id} class={className} style={{ gridColumn: `span ${String(props.span)}` }}>
      {props.children}
    </div>
  );
}
