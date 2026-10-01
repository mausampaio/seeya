/**
 * The base empty state (V2-T62, D-051 — `docs/INTERFACE.md` item 1's "estado vazio", e.g. Today's
 * own "nothing to resume" panel, `docs/INTERFACE.md` § 3). `action` is a slot for a `Button` (e.g.
 * `New project` on an empty Projects tab) — never rendered by this component itself, so it never
 * has to know what the action does.
 *
 * @example
 * <EmptyState title="Nothing to resume" description="Every session from today is already open." />
 *
 * Brought to the CSS-module/render-tested pattern by V2-T66 (D-052, Q-102) — first production
 * caller is Today's own "no pending briefing" state (`docs/INTERFACE.md` § 3's own "estado vazio
 * com o texto de hoje").
 */
import type { ComponentChildren, JSX } from 'preact';
import styles from './EmptyState.module.css';
import { cx, mergeClassName } from '../css-class.js';
import { Text } from '../Text/index.js';

export interface EmptyStateProps {
  readonly title: string;
  readonly description?: string;
  readonly action?: ComponentChildren;
  readonly className?: string;
}

export function EmptyState(props: EmptyStateProps): JSX.Element {
  return (
    <div class={mergeClassName(cx(styles, 'emptyState'), props.className)}>
      <Text as="p" variant="body-lg" weight={600} className={cx(styles, 'title')}>
        {props.title}
      </Text>
      {props.description !== undefined && (
        <Text as="p" variant="body-sm" tone="secondary" className={cx(styles, 'description')}>
          {props.description}
        </Text>
      )}
      {props.action !== undefined && <div class={cx(styles, 'action')}>{props.action}</div>}
    </div>
  );
}
