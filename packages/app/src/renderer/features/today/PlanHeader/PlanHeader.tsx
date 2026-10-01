/**
 * D-052 (V2-T66, `docs/INTERFACE.md` § 3): "Título `Plan for <dia>` (`(N days ago)` quando for o
 * caso) e uma linha de contexto: quando foi capturado e quantas sessões." Replaces the plain `<p>`
 * `renderer/legacy/today-panel-view.ts#renderTodayPanel` used for the title, with no context line
 * at all before this task.
 *
 * @example
 * <PlanHeader day="2026-09-30" daysAgo={1} capturedAt={new Date(...)} sessionCount={3} />
 */
import type { JSX } from 'preact';
import styles from './PlanHeader.module.css';
import { cx } from '../../../components/css-class.js';
import { Text } from '../../../components/Text/index.js';
import { MESSAGES } from '../../../../text/messages.js';

export interface PlanHeaderProps {
  readonly day: string;
  readonly daysAgo: number;
  readonly capturedAt: Date | null;
  readonly sessionCount: number;
}

export function PlanHeader(props: PlanHeaderProps): JSX.Element {
  return (
    <div class={cx(styles, 'header')}>
      <Text as="h1" variant="heading-3">
        {MESSAGES.todayPlanTitle(props.day, props.daysAgo)}
      </Text>
      <Text as="p" variant="body-sm" tone="secondary">
        {MESSAGES.todayContextLine(props.capturedAt, props.sessionCount)}
      </Text>
    </div>
  );
}
