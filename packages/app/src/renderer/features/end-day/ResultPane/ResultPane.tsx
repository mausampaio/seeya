/**
 * D-052 (V2-T69, `docs/INTERFACE.md` § 6 item 3): End day's result — captured/failed/skipped, each
 * its own `StatusList`, and `Open Today` (which takes the person straight to the newly-written
 * plan, same reason the dialog refreshes the Today panel on finish, `useEndDay.ts`).
 */
import type { JSX } from 'preact';
import styles from './ResultPane.module.css';
import { cx } from '../../../components/css-class.js';
import { Stack } from '../../../components/Stack/index.js';
import { Text } from '../../../components/Text/index.js';
import { StatusList, type StatusListItem } from '../../../components/StatusList/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import { buildSessionSummaryBadges } from '../session-badges.js';
import type {
  EndDayReasonRow,
  EndDaySessionSummaryRow,
} from '../../../../state/end-day-sessions.js';

export interface ResultPaneProps {
  readonly captured: readonly EndDaySessionSummaryRow[];
  readonly failed: readonly EndDayReasonRow[];
  readonly skipped: readonly EndDayReasonRow[];
}

function toCapturedItem(row: EndDaySessionSummaryRow): StatusListItem {
  return {
    id: row.sessionId,
    title: row.name,
    meta: row.cwd,
    badges: buildSessionSummaryBadges(row),
  };
}

/** `row.reason` already comes pre-abbreviated/truncated from `state/end-day-sessions.ts`;
 * `row.fullReason` is only shown as a tooltip when it actually differs — PO review round 1
 * (V2-T69, item 5). */
function toReasonItem(row: EndDayReasonRow): StatusListItem {
  return {
    id: row.sessionId,
    title: row.name,
    meta: row.cwd,
    detail: row.reason,
    detailTitle: row.reason !== row.fullReason ? row.fullReason : undefined,
  };
}

export function ResultPane(props: ResultPaneProps): JSX.Element {
  return (
    <Stack gap="lg" className={cx(styles, 'pane')}>
      <section>
        <Text as="h4" variant="heading-4" className={cx(styles, 'heading')}>
          {MESSAGES.endDayResultCapturedHeading(props.captured.length)}
        </Text>
        <StatusList
          items={props.captured.map(toCapturedItem)}
          emptyMessage={MESSAGES.endDayNothingToShow}
        />
      </section>
      <section>
        <Text as="h4" variant="heading-4" className={cx(styles, 'heading')}>
          {MESSAGES.endDayResultFailedHeading(props.failed.length)}
        </Text>
        <StatusList
          items={props.failed.map(toReasonItem)}
          emptyMessage={MESSAGES.endDayNothingToShow}
        />
      </section>
      <section>
        <Text as="h4" variant="heading-4" className={cx(styles, 'heading')}>
          {MESSAGES.endDayResultSkippedHeading(props.skipped.length)}
        </Text>
        <StatusList
          items={props.skipped.map(toReasonItem)}
          emptyMessage={MESSAGES.endDayNothingToShow}
        />
      </section>
    </Stack>
  );
}
