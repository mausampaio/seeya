/**
 * D-052 (V2-T75), PO review (2026-10-01): a small list of actions anchored to a trigger button —
 * `docs/INTERFACE.md` § 1 item 7's own "Snooze ▾ (menu com +15m, +30m, +1h)", replacing the
 * earlier unstyled native `<select>`. Built on `Popover` (same reasoning as `NewTabPopover`'s own
 * docstring): a real `<dialog>` already gives Esc-to-close, backdrop-click-to-close, and
 * focus-returned-to-the-active-terminal on close for free
 * (`renderer/legacy/dialog-focus-return.ts`) — this component only adds the WAI-ARIA menu pattern
 * on top (`role="menu"`/`role="menuitem"`, arrow-key roving focus, first item focused on open).
 *
 * @example
 * const triggerRef = useRef<HTMLButtonElement>(null);
 * <Button buttonRef={triggerRef} onClick={() => setOpen(true)}>Snooze ▾</Button>
 * <Menu id="snooze-menu" open={open} anchorRef={triggerRef}
 *   items={[{ value: '15', label: '+15m' }]}
 *   onSelect={(value) => snooze(Number(value))} onRequestClose={() => setOpen(false)}/>
 */
import { useEffect, useRef } from 'preact/hooks';
import type { JSX, RefObject } from 'preact';
import styles from './Menu.module.css';
import { cx } from '../css-class.js';
import { Popover } from '../Popover/index.js';
import { Text } from '../Text/index.js';
import { useRovingFocus } from '../../hooks/useRovingFocus.js';

/**
 * `disabledReason` (V2-T50): when set the item is disabled AND says why on a second line — D-024,
 * a reason with no disabled flag (or the reverse) is unrepresentable. It uses `aria-disabled`, not
 * the native `disabled`, so it stays focusable and a keyboard user can still read the reason.
 * `separatorBefore` draws a divider above the item (e.g. an action that is not one of the choices
 * above it).
 */
export interface MenuItem {
  readonly value: string;
  readonly label: string;
  readonly disabledReason?: string;
  readonly separatorBefore?: boolean;
}

export interface MenuProps {
  readonly id: string;
  readonly open: boolean;
  readonly anchorRef: RefObject<HTMLElement | null>;
  /** `role="menu"` needs an accessible name of its own (WAI-ARIA authoring practices) — required,
   * not optional, same reasoning `IconButton`'s own `aria-label` already has (D-024). */
  readonly ariaLabel: string;
  readonly items: readonly MenuItem[];
  readonly onSelect: (value: string) => void;
  readonly onRequestClose: () => void;
}

export function Menu(props: MenuProps): JSX.Element {
  const listRef = useRef<HTMLUListElement>(null);
  // Arrow-key roving focus is shared with `Select` (`renderer/hooks/useRovingFocus.ts`, V2-T81) —
  // defaults only (ArrowUp/ArrowDown, wrapping): no Home/End, no typeahead, exactly what this
  // menu always did. Esc/Enter need no handling — Esc already closes the underlying `<dialog>`
  // natively, and Enter/Space on a focused `<button>` already fires its own `onClick`.
  const { onKeyDown, items } = useRovingFocus({ listRef, itemSelector: '[role="menuitem"]' });

  // WAI-ARIA menu pattern: opening a menu moves focus straight to its first item — the trigger
  // button never keeps focus once the menu is showing (this is also what makes arrow-key roving
  // focus work immediately, with no extra click first).
  useEffect(() => {
    if (!props.open) {
      return;
    }
    items()[0]?.focus();
  }, [props.open]);

  function select(value: string): void {
    props.onSelect(value);
    props.onRequestClose();
  }

  return (
    <Popover
      id={props.id}
      open={props.open}
      anchorRef={props.anchorRef}
      onRequestClose={props.onRequestClose}
    >
      <ul
        ref={listRef}
        role="menu"
        aria-label={props.ariaLabel}
        class={cx(styles, 'menu')}
        onKeyDown={onKeyDown}
      >
        {props.items.map((item) => (
          <li
            key={item.value}
            role="none"
            class={item.separatorBefore === true ? cx(styles, 'separated') : undefined}
          >
            <button
              type="button"
              role="menuitem"
              aria-disabled={item.disabledReason !== undefined ? 'true' : undefined}
              // Roving `tabIndex` (D-052's own "nada de estado achatado" applied to focus order
              // too, in spirit) — only ever one `0`, so Tab never stops at every item in turn; the
              // dialog's own focus trap plus the explicit `.focus()` calls above/below are what
              // actually move focus, this just keeps the DOM tab order sane for anyone who tabs
              // out instead of using arrows.
              tabIndex={-1}
              class={cx(
                styles,
                'item',
                item.disabledReason !== undefined ? 'itemDisabled' : undefined,
              )}
              onClick={() => {
                if (item.disabledReason === undefined) {
                  select(item.value);
                }
              }}
            >
              <Text as="span" variant="body-sm">
                {item.label}
              </Text>
              {item.disabledReason !== undefined && (
                <Text as="span" variant="caption" tone="tertiary" className={cx(styles, 'reason')}>
                  {item.disabledReason}
                </Text>
              )}
            </button>
          </li>
        ))}
      </ul>
    </Popover>
  );
}
