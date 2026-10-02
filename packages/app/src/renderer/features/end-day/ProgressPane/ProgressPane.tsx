/**
 * D-052 (V2-T69, `docs/INTERFACE.md` § 6 item 2): End day's "em andamento" — the headline
 * ("Capturing i of N: name…"), a `ProgressBar`, the per-session status list, and `Hide` (which only
 * ever changes `visible` on the state machine — the capture itself keeps running in the background
 * either way, `state/end-day-panel.ts`'s own docstring). `props.current` is never absent here: the
 * gap before the first session actually starts is the `starting` phase's own job
 * (`EndDayDialog.tsx`, which shows the frozen preview instead), never this pane's.
 */
import type { JSX } from 'preact';
import styles from './ProgressPane.module.css';
import { cx } from '../../../components/css-class.js';
import { Stack } from '../../../components/Stack/index.js';
import { Text } from '../../../components/Text/index.js';
import { ProgressBar } from '../../../components/ProgressBar/index.js';
import { StatusList, type StatusListItem } from '../../../components/StatusList/index.js';
import type { Tone } from '../../../components/props.js';
import { MESSAGES } from '../../../../text/messages.js';
import type {
  EndDayCurrentCapture,
  EndDaySessionProgress,
  EndDaySessionProgressStatus,
} from '../../../../state/end-day-panel.js';

export interface ProgressPaneProps {
  readonly sessions: readonly EndDaySessionProgress[];
  readonly current: EndDayCurrentCapture;
}

const STATUS_BADGE: Record<
  EndDaySessionProgressStatus,
  { readonly label: string; readonly tone: Tone }
> = {
  waiting: { label: MESSAGES.endDayStatusWaiting, tone: 'neutral' },
  capturing: { label: MESSAGES.endDayStatusCapturing, tone: 'info' },
  captured: { label: MESSAGES.endDayStatusCaptured, tone: 'success' },
  ineligible: { label: MESSAGES.endDayStatusIneligible, tone: 'neutral' },
  failed: { label: MESSAGES.endDayStatusFailed, tone: 'error' },
};

function toItem(session: EndDaySessionProgress): StatusListItem {
  return { id: session.sessionId, title: session.name, badges: [STATUS_BADGE[session.status]] };
}

function finishedCount(sessions: readonly EndDaySessionProgress[]): number {
  return sessions.filter(
    (session) => session.status !== 'waiting' && session.status !== 'capturing',
  ).length;
}

function headline(current: EndDayCurrentCapture): string {
  return MESSAGES.endDayCaptureProgress(current.index, current.total, current.name);
}

export function ProgressPane(props: ProgressPaneProps): JSX.Element {
  const text = headline(props.current);
  return (
    <Stack gap="lg" className={cx(styles, 'pane')}>
      <Text as="p" variant="body-md" weight={500}>
        {text}
      </Text>
      <ProgressBar value={finishedCount(props.sessions)} max={props.current.total} label={text} />
      <StatusList items={props.sessions.map(toItem)} emptyMessage={MESSAGES.endDayNothingToShow} />
    </Stack>
  );
}
