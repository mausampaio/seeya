/**
 * D-052 (V2-T75): a section title with an optional action on the same row — the lateral's own
 * "Favorites" heading with its "+" (`docs/INTERFACE.md` § 1 item 3), "Recent"/"All projects", or
 * any future region that repeats the same shape. Heading text is never uppercase (V2-T63 aceite
 * item 4, `Section.module.css`'s own comment) — `caption` sizing straight from the identity scale.
 *
 * @example
 * <Section title="Favorites" action={<IconButton aria-label="New project"><PlusIcon/></IconButton>}>
 *   <FavoritesList/>
 * </Section>
 */
import type { ComponentChildren, JSX } from 'preact';
import styles from './Section.module.css';
import { cx, mergeClassName } from '../css-class.js';
import { Text } from '../Text/index.js';

export interface SectionProps {
  readonly title: string;
  readonly action?: ComponentChildren;
  readonly id?: string;
  readonly className?: string;
  readonly children?: ComponentChildren;
}

export function Section(props: SectionProps): JSX.Element {
  return (
    <section id={props.id} class={mergeClassName(cx(styles, 'section'), props.className)}>
      <div class={cx(styles, 'header')}>
        {/* D-052 item 7 (PO review, 2026-10-01): "rótulos de seção... em caption" — identity
         * § 4.4's own 12/16/weight-500 triple, the same three numbers this heading hardcoded
         * before `Text` existed. */}
        <Text as="h2" variant="caption" tone="tertiary" truncate className={cx(styles, 'title')}>
          {props.title}
        </Text>
        {props.action}
      </div>
      <div class={cx(styles, 'body')}>{props.children}</div>
    </section>
  );
}
