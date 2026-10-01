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
import type { JSX, RefObject, TargetedEvent } from 'preact';
import styles from './Menu.module.css';
import { cx } from '../css-class.js';
import { Popover } from '../Popover/index.js';
import { Text } from '../Text/index.js';

export interface MenuItem {
  readonly value: string;
  readonly label: string;
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

function menuItemButtons(list: HTMLUListElement | null): HTMLButtonElement[] {
  return Array.from(list?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
}

export function Menu(props: MenuProps): JSX.Element {
  const listRef = useRef<HTMLUListElement>(null);

  // WAI-ARIA menu pattern: opening a menu moves focus straight to its first item — the trigger
  // button never keeps focus once the menu is showing (this is also what makes arrow-key roving
  // focus work immediately, with no extra click first).
  useEffect(() => {
    if (!props.open) {
      return;
    }
    menuItemButtons(listRef.current)[0]?.focus();
  }, [props.open]);

  function handleKeyDown(event: TargetedEvent<HTMLUListElement, KeyboardEvent>): void {
    const buttons = menuItemButtons(listRef.current);
    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      buttons[(currentIndex + 1) % buttons.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      buttons[(currentIndex - 1 + buttons.length) % buttons.length]?.focus();
    }
    // Esc/Enter need no handling here — Esc already closes the underlying `<dialog>` natively, and
    // Enter/Space on a focused `<button>` already fires its own `onClick` without help.
  }

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
        onKeyDown={handleKeyDown}
      >
        {props.items.map((item) => (
          <li key={item.value} role="none">
            <button
              type="button"
              role="menuitem"
              // Roving `tabIndex` (D-052's own "nada de estado achatado" applied to focus order
              // too, in spirit) — only ever one `0`, so Tab never stops at every item in turn; the
              // dialog's own focus trap plus the explicit `.focus()` calls above/below are what
              // actually move focus, this just keeps the DOM tab order sane for anyone who tabs
              // out instead of using arrows.
              tabIndex={-1}
              class={cx(styles, 'item')}
              onClick={() => select(item.value)}
            >
              <Text as="span" variant="body-sm">
                {item.label}
              </Text>
            </button>
          </li>
        ))}
      </ul>
    </Popover>
  );
}
