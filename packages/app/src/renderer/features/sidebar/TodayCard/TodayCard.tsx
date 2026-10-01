/**
 * D-052 (V2-T75): the lateral's own Today card (`docs/INTERFACE.md` § 1 item 2) — a real component
 * now, replacing the imperative `renderTodayCard` inside the deleted
 * `renderer/legacy/sidebar-favorites-view.tsx`. Two lines: icon + "Today" + the "N to resume" chip
 * (only when there IS something to resume) on the first, "Plan for `<day>`"/"Nothing to resume" on
 * the second — `state/today-panel.ts#buildTodayCardSummary` decides which.
 *
 * PO review (2026-10-01), D-052 item 7: "Today" is a navigation entry (same treatment as
 * `NavItem`'s own label — `body-sm`, weight 500); "Plan for `<day>`"/"Nothing to resume" is detail
 * text (`caption`, secondary tone) — these were the window's own smallest, 11/12px raw values
 * before `Text` existed.
 *
 * @example
 * <TodayCard summary={buildTodayCardSummary(data)} active={isPageTabActive(activeTabId, 'today')} onClick={openToday}/>
 */
import type { JSX } from 'preact';
import styles from './TodayCard.module.css';
import { cx, mergeClassName } from '../../../components/css-class.js';
import { Chip } from '../../../components/Chip/index.js';
import { Text } from '../../../components/Text/index.js';
import { CalendarIcon } from '../../../components/Icon/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import type { TodayCardSummary } from '../../../../state/today-panel.js';

export interface TodayCardProps {
  readonly summary: TodayCardSummary;
  readonly active: boolean;
  readonly onClick: () => void;
}

export function TodayCard(props: TodayCardProps): JSX.Element {
  const { summary } = props;
  const subtitle =
    summary.kind === 'pending'
      ? MESSAGES.todayCardPlanFor(summary.dayLabel)
      : MESSAGES.todayCardNothingToResume;
  const className = mergeClassName(cx(styles, 'card', props.active && 'active'));
  return (
    <button
      id="today-card"
      type="button"
      class={className}
      aria-current={props.active}
      onClick={props.onClick}
    >
      <div class={cx(styles, 'row')}>
        <span class={cx(styles, 'icon')} aria-hidden="true">
          <CalendarIcon />
        </span>
        <Text as="span" variant="body-sm" weight={500} truncate className={cx(styles, 'title')}>
          {MESSAGES.todayCardHeading}
        </Text>
        {summary.kind === 'pending' && summary.resumableCount > 0 && (
          <span class={cx(styles, 'pill')}>
            <Chip tone="info">{MESSAGES.todayCardResumeCount(summary.resumableCount)}</Chip>
          </span>
        )}
      </div>
      <Text
        as="div"
        variant="caption"
        tone="secondary"
        truncate
        className={cx(styles, 'subtitle')}
      >
        {subtitle}
      </Text>
    </button>
  );
}
