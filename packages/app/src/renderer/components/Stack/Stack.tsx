/**
 * D-052 (V2-T75): the disposition primitive for "one thing after another" — vertical (the
 * default, a column) or horizontal (a row), with a typed `gap` and alignment, so a feature never
 * reaches for raw flex CSS just to stack a few elements with breathing room between them ("a tela
 * se organiza por componentes de layout, não por CSS avulso em cada região", D-052's own text).
 *
 * @example
 * <Stack gap="sm"><Chip>3</Chip><span>running</span></Stack>
 * <Stack direction="horizontal" gap="md" align="center" justify="between">…</Stack>
 */
import type { ComponentChildren, JSX } from 'preact';
import styles from './Stack.module.css';
import type { SpaceToken } from '../tokens.js';
import { spaceValue } from '../tokens.js';
import { cx, mergeClassName } from '../css-class.js';

export type StackDirection = 'vertical' | 'horizontal';
export type StackAlign = 'start' | 'center' | 'end' | 'stretch';
export type StackJustify = 'start' | 'center' | 'end' | 'between';

export interface StackProps {
  readonly direction?: StackDirection;
  readonly gap?: SpaceToken;
  readonly align?: StackAlign;
  readonly justify?: StackJustify;
  /** Wraps onto a new line instead of overflowing — off by default (most stacks in this app are
   * a fixed, known set of children). */
  readonly wrap?: boolean;
  readonly id?: string;
  readonly className?: string;
  readonly children?: ComponentChildren;
}

const ALIGN_CLASS_NAME: Record<StackAlign, string> = {
  start: 'alignStart',
  center: 'alignCenter',
  end: 'alignEnd',
  stretch: 'alignStretch',
};

const JUSTIFY_CLASS_NAME: Record<StackJustify, string> = {
  start: 'justifyStart',
  center: 'justifyCenter',
  end: 'justifyEnd',
  between: 'justifyBetween',
};

export function Stack(props: StackProps): JSX.Element {
  const direction = props.direction ?? 'vertical';
  const className = mergeClassName(
    cx(
      styles,
      'stack',
      direction === 'vertical' ? 'vertical' : 'horizontal',
      ALIGN_CLASS_NAME[props.align ?? 'stretch'],
      JUSTIFY_CLASS_NAME[props.justify ?? 'start'],
      props.wrap === true && 'wrap',
    ),
    props.className,
  );
  return (
    <div id={props.id} class={className} style={{ gap: spaceValue(props.gap ?? 'none') }}>
      {props.children}
    </div>
  );
}
