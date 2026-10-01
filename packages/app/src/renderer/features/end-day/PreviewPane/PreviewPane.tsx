/**
 * D-052 (V2-T69, `docs/INTERFACE.md` § 6 item 1): End day's preview — "Will be captured"/"Not
 * captured" lists plus the cost-ceiling info box, with `Cancel`/`Run end-day now`. Also renders
 * the `starting` phase (`props.starting`): the SAME lists, frozen, with `Cancel` hidden and
 * `Run end-day now` in its own `loading` state — `application/end-day.ts`'s own discovery +
 * eligibility pass runs for real before the first progress event ever fires, a genuine (if often
 * short) gap between the click and the running view actually having something to show
 * (`state/end-day-panel.ts`'s own docstring on the `starting` phase explains why that phase exists
 * at all instead of jumping straight to `running`).
 */
import type { JSX } from 'preact';
import { formatSessionStateLabel } from '@seeya-ai/engine/core/session-state-label.js';
import styles from './PreviewPane.module.css';
import { cx } from '../../../components/css-class.js';
import { Stack } from '../../../components/Stack/index.js';
import { Text } from '../../../components/Text/index.js';
import { Button } from '../../../components/Button/index.js';
import { InfoBox } from '../../../components/InfoBox/index.js';
import { StatusList, type StatusListItem } from '../../../components/StatusList/index.js';
import type { Tone } from '../../../components/props.js';
import { MESSAGES } from '../../../../text/messages.js';
import { resolveSessionStateTone } from '../../../../state/session-state-tone.js';
import type {
  EndDayNotCapturedKind,
  EndDayNotCapturedRow,
  EndDaySessionSummaryRow,
} from '../../../../state/end-day-sessions.js';
import type { EndDayPreviewData } from '../../../../state/end-day-panel.js';

export interface PreviewPaneProps {
  readonly data: EndDayPreviewData;
  /** `true` while the `starting` phase shows this same data read-only (see this file's own
   * docstring). */
  readonly starting: boolean;
  readonly onCancel: () => void;
  readonly onRun: () => void;
}

function captureModeLabel(mode: EndDaySessionSummaryRow['mode']): string {
  return mode === 'lean' ? 'Lean' : 'Deep';
}

function toWillBeCapturedItem(row: EndDaySessionSummaryRow): StatusListItem {
  return {
    id: row.sessionId,
    title: row.name,
    meta: row.cwd,
    badges: [
      { label: formatSessionStateLabel(row.state), tone: resolveSessionStateTone(row.state) },
      { label: captureModeLabel(row.mode), tone: 'neutral' },
    ],
  };
}

const NOT_CAPTURED_BADGE: Record<
  EndDayNotCapturedKind,
  { readonly label: string; readonly tone: Tone }
> = {
  ineligible: { label: MESSAGES.endDayStatusIneligible, tone: 'neutral' },
  closed: { label: MESSAGES.endDayStatusClosed, tone: 'neutral' },
  failed: { label: MESSAGES.endDayStatusFailed, tone: 'error' },
};

function toNotCapturedItem(row: EndDayNotCapturedRow): StatusListItem {
  return {
    id: row.sessionId,
    title: row.name,
    meta: row.cwd,
    detail: row.reason,
    badges: [NOT_CAPTURED_BADGE[row.kind]],
  };
}

export function PreviewPane(props: PreviewPaneProps): JSX.Element {
  const { data } = props;
  return (
    <Stack gap="lg" className={cx(styles, 'pane')}>
      <section>
        <Text as="h4" variant="heading-4" className={cx(styles, 'heading')}>
          {MESSAGES.endDayWillBeCapturedHeading(data.willBeCaptured.length)}
        </Text>
        <StatusList
          items={data.willBeCaptured.map(toWillBeCapturedItem)}
          emptyMessage={MESSAGES.endDayNothingToShow}
        />
      </section>
      <section>
        <Text as="h4" variant="heading-4" className={cx(styles, 'heading')}>
          {MESSAGES.endDayNotCapturedHeading(data.notCaptured.length)}
        </Text>
        <StatusList
          items={data.notCaptured.map(toNotCapturedItem)}
          emptyMessage={MESSAGES.endDayNothingToShow}
        />
      </section>
      <InfoBox>{MESSAGES.endDayCostCeiling(data.costCeiling)}</InfoBox>
      <div class={cx(styles, 'actions')}>
        <Button
          id="end-day-dialog-cancel"
          variant="secondary"
          hidden={props.starting}
          onClick={props.onCancel}
        >
          {MESSAGES.endDayCancel}
        </Button>
        <Button id="end-day-dialog-run" loading={props.starting} onClick={props.onRun}>
          {MESSAGES.endDayRunNow}
        </Button>
      </div>
    </Stack>
  );
}
