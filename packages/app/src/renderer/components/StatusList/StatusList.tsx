/**
 * D-052 (V2-T69): a list of items each carrying one or more short status badges — End day's own
 * "Will be captured"/"Not captured"/per-session progress/result lists (`docs/INTERFACE.md` § 6),
 * generic enough for the next list that needs "a name, where it lives, why, and a state" to reuse
 * without a bespoke row component. A badge is always TEXT+TONE (`Chip`), never colour alone
 * (identity § 8: "estado sempre com texto ou ícone, nunca só cor") — `StatusListItem.badges` is a
 * `Tone`-carrying array for exactly that reason, never a raw colour string.
 *
 * @example
 * <StatusList
 *   items={[
 *     { id: 's1', title: 'alpha', meta: '~/code/alpha', badges: [{ label: 'ended', tone: 'neutral' }, { label: 'lean', tone: 'neutral' }] },
 *   ]}
 *   emptyMessage="Nothing to show."
 * />
 */
import type { JSX } from 'preact';
import styles from './StatusList.module.css';
import { cx, mergeClassName } from '../css-class.js';
import { Text } from '../Text/index.js';
import { Chip } from '../Chip/index.js';
import type { Tone } from '../props.js';

export interface StatusListBadge {
  readonly label: string;
  readonly tone: Tone;
}

export interface StatusListItem {
  readonly id: string;
  readonly title: string;
  /** A directory, an id — shown in monospace (`Text variant="code"`), right under the title. */
  readonly meta?: string;
  /** A freeform secondary sentence — a reason, an excerpt. Never a short enum value (use `badges`
   * for that instead). */
  readonly detail?: string;
  readonly badges?: readonly StatusListBadge[];
}

export interface StatusListProps {
  readonly items: readonly StatusListItem[];
  readonly emptyMessage: string;
  readonly className?: string;
}

function StatusListRow(props: { readonly item: StatusListItem }): JSX.Element {
  const { item } = props;
  return (
    <li class={cx(styles, 'row')}>
      <div class={cx(styles, 'main')}>
        <Text as="span" variant="body-sm" weight={500} truncate>
          {item.title}
        </Text>
        {item.meta !== undefined && (
          <Text as="span" variant="code" tone="tertiary" truncate className={cx(styles, 'meta')}>
            {item.meta}
          </Text>
        )}
        {item.detail !== undefined && (
          <Text as="span" variant="caption" tone="secondary" className={cx(styles, 'detail')}>
            {item.detail}
          </Text>
        )}
      </div>
      {item.badges !== undefined && item.badges.length > 0 && (
        <div class={cx(styles, 'badges')}>
          {item.badges.map((badge) => (
            <Chip key={badge.label} tone={badge.tone} size="sm">
              {badge.label}
            </Chip>
          ))}
        </div>
      )}
    </li>
  );
}

export function StatusList(props: StatusListProps): JSX.Element {
  if (props.items.length === 0) {
    return (
      <Text
        as="p"
        variant="caption"
        tone="tertiary"
        className={mergeClassName(cx(styles, 'empty'), props.className)}
      >
        {props.emptyMessage}
      </Text>
    );
  }
  return (
    <ul class={mergeClassName(cx(styles, 'list'), props.className)}>
      {props.items.map((item) => (
        <StatusListRow key={item.id} item={item} />
      ))}
    </ul>
  );
}
