/**
 * D-052 (V2-T69, `docs/INTERFACE.md` § 6 item 3): End day's result — captured/failed/skipped, each
 * its own `StatusList`, and `Open Today` (which takes the person straight to the newly-written
 * plan, same reason the dialog refreshes the Today panel on finish, `useEndDay.ts`).
 */
import type { JSX } from 'preact';
import { formatSessionStateLabel } from '@seeya-ai/engine/core/session-state-label.js';
import styles from './ResultPane.module.css';
import { cx } from '../../../components/css-class.js';
import { Stack } from '../../../components/Stack/index.js';
import { Text } from '../../../components/Text/index.js';
import { Button } from '../../../components/Button/index.js';
import { StatusList, type StatusListItem } from '../../../components/StatusList/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import { resolveSessionStateTone } from '../../../../state/session-state-tone.js';
import type {
  EndDayReasonRow,
  EndDaySessionSummaryRow,
} from '../../../../state/end-day-sessions.js';

export interface ResultPaneProps {
  readonly captured: readonly EndDaySessionSummaryRow[];
  readonly failed: readonly EndDayReasonRow[];
  readonly skipped: readonly EndDayReasonRow[];
  readonly onOpenToday: () => void;
  readonly onClose: () => void;
}

function toCapturedItem(row: EndDaySessionSummaryRow): StatusListItem {
  return {
    id: row.sessionId,
    title: row.name,
    meta: row.cwd,
    badges: [
      { label: formatSessionStateLabel(row.state), tone: resolveSessionStateTone(row.state) },
      { label: row.mode === 'lean' ? 'Lean' : 'Deep', tone: 'neutral' },
    ],
  };
}

function toReasonItem(row: EndDayReasonRow): StatusListItem {
  return { id: row.sessionId, title: row.name, meta: row.cwd, detail: row.reason };
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
      <div class={cx(styles, 'actions')}>
        <Button id="end-day-dialog-close" variant="secondary" onClick={props.onClose}>
          {MESSAGES.endDayClose}
        </Button>
        <Button id="end-day-dialog-open-today" onClick={props.onOpenToday}>
          {MESSAGES.endDayOpenToday}
        </Button>
      </div>
    </Stack>
  );
}
