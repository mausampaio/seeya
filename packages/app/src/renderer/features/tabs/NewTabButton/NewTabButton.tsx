/**
 * The tab strip's own "+" (V2-T64, `docs/INTERFACE.md` § 2) — opens the New tab popover. Its own
 * component (not just an inline `<IconButton>` in `TabStrip.tsx`) because it has to expose the
 * underlying `<button>` node as the popover's own anchor (`IconButton`'s own `buttonRef`,
 * V2-T64) — a clear, single place that owns "where the popover points to", instead of `TabStrip.tsx`
 * reaching into a ref it only half-owns.
 */
import type { JSX, RefObject } from 'preact';
import { IconButton } from '../../../components/IconButton/index.js';
import { PlusIcon } from '../../../components/Icon/index.js';
import { MESSAGES } from '../../../../text/messages.js';

export interface NewTabButtonProps {
  readonly buttonRef: RefObject<HTMLButtonElement | null>;
  readonly disabled: boolean;
  readonly onClick: () => void;
}

export function NewTabButton(props: NewTabButtonProps): JSX.Element {
  return (
    <IconButton
      id="new-tab-button"
      variant="ghost"
      aria-label={MESSAGES.newTabButtonLabel}
      buttonRef={props.buttonRef}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      <PlusIcon />
    </IconButton>
  );
}
