/**
 * One tab in the strip (V2-T64, `docs/INTERFACE.md` § 2) — a terminal or a page, indistinguishable
 * to this component (`state/tab-strip.ts#TabStripEntry` already flattened the difference into
 * icon/label/active/exited). Named `TabStripItem`, not `Tab` — the glossary's own `Tab`
 * (`tabs/tab-model.ts`) is the pty-backed model this component never imports or represents
 * one-to-one (a page tab has no `Tab` at all).
 *
 * Replaces `renderer/legacy/tabs-view.ts#addTabButton`/`renderer/legacy/page-tab-strip.ts
 * #createPageTabButton` (apagados by this task) — one component for both kinds, instead of two
 * near-identical hand-built DOM fragments.
 *
 * @example
 * <TabStripItem
 *   entry={{ id: 'tab-1', label: 'claude', icon: 'terminal', active: true, exited: false }}
 *   onSelect={showTab}
 *   onClose={closeTab}
 * />
 */
import type { JSX } from 'preact';
import styles from './TabStripItem.module.css';
import { cx } from '../../../components/css-class.js';
import { IconButton } from '../../../components/IconButton/index.js';
import {
  CalendarIcon,
  ChatBalloonIcon,
  CloseIcon,
  FolderIcon,
  TerminalIcon,
  type IconProps,
} from '../../../components/Icon/index.js';
import type { TabStripEntry } from '../../../../state/tab-strip.js';
import type { TabStripIconKind } from '../../../../state/tab-strip-icon.js';

const ICON_BY_KIND: Record<TabStripIconKind, (props: IconProps) => JSX.Element> = {
  folder: FolderIcon,
  balloon: ChatBalloonIcon,
  terminal: TerminalIcon,
  calendar: CalendarIcon,
};

export interface TabStripItemProps {
  readonly entry: TabStripEntry;
  readonly onSelect: (id: string) => void;
  readonly onClose: (id: string) => void;
}

export function TabStripItem(props: TabStripItemProps): JSX.Element {
  const { entry } = props;
  const Icon = ICON_BY_KIND[entry.icon];
  return (
    <div class={cx(styles, 'item', entry.active && 'active', entry.exited && 'exited')}>
      <button
        type="button"
        class={cx(styles, 'select')}
        aria-current={entry.active}
        onClick={() => props.onSelect(entry.id)}
      >
        <span class={cx(styles, 'icon')} aria-hidden="true">
          <Icon size={16} />
        </span>
        <span class={cx(styles, 'label')}>{entry.label}</span>
      </button>
      <IconButton
        variant="ghost"
        size="sm"
        className={cx(styles, 'close')}
        aria-label={`Close ${entry.label}`}
        onClick={() => props.onClose(entry.id)}
      >
        <CloseIcon size={14} />
      </IconButton>
    </div>
  );
}
