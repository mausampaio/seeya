/**
 * D-052 (V2-T75): a navigation row — icon, label, and an optional trailing chip/count with real
 * breathing room from the row's own right edge (`NavItem.module.css`'s own comment has the V2-T63
 * aceite defects this fixes: rows colliding with no gap between them, the counter touching the
 * edge). `active` highlights the row the same way the old `[aria-current='true']` rule did
 * (`aria-current` is still set, for the same accessibility reason — this just also drives the
 * visual).
 *
 * @example
 * <NavItem icon={<FolderIcon/>} label="All projects" trailing={<span>12</span>} onClick={open}/>
 * <NavItem icon={<ChatBalloonIcon/>} label="Sessions" trailing={<Chip tone="success" size="sm">3 running</Chip>} active/>
 */
import type { ComponentChildren, JSX } from 'preact';
import styles from './NavItem.module.css';
import { cx, mergeClassName } from '../css-class.js';
import { Text } from '../Text/index.js';

export interface NavItemProps {
  readonly icon: ComponentChildren;
  readonly label: string;
  readonly trailing?: ComponentChildren;
  readonly active?: boolean;
  readonly id?: string;
  readonly className?: string;
  readonly onClick?: () => void;
}

export function NavItem(props: NavItemProps): JSX.Element {
  const active = props.active === true;
  const className = mergeClassName(cx(styles, 'navItem', active && 'active'), props.className);
  return (
    <button
      id={props.id}
      type="button"
      class={className}
      aria-current={active}
      onClick={props.onClick}
    >
      <span class={cx(styles, 'icon')} aria-hidden="true">
        {props.icon}
      </span>
      {/* D-052 item 7 (PO review, 2026-10-01): "itens... de navegação... em body-sm; peso 500 nos
       * itens de navegação" — identity § 4.4's 14/20 triple, `active` only overriding the
       * default weight the way `Text`'s own `weight` prop is meant to be used. */}
      <Text
        as="span"
        variant="body-sm"
        truncate
        className={cx(styles, 'label')}
        {...(active ? { weight: 500 as const } : {})}
      >
        {props.label}
      </Text>
      {props.trailing !== undefined && <span class={cx(styles, 'trailing')}>{props.trailing}</span>}
    </button>
  );
}
