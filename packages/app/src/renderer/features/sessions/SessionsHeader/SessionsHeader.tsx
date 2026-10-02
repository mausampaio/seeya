/**
 * V2-T68 (`docs/INTERFACE.md` § 5): "Título `Sessions`, total e quantas rodando."
 *
 * @example
 * <SessionsHeader totalCount={12} runningCount={3} />
 */
import type { JSX } from 'preact';
import styles from './SessionsHeader.module.css';
import { cx } from '../../../components/css-class.js';
import { Text } from '../../../components/Text/index.js';
import { MESSAGES } from '../../../../text/messages.js';

export interface SessionsHeaderProps {
  readonly totalCount: number;
  readonly runningCount: number;
}

export function SessionsHeader(props: SessionsHeaderProps): JSX.Element {
  return (
    <div class={cx(styles, 'header')}>
      <div class={cx(styles, 'titleGroup')}>
        <Text as="h1" variant="heading-3">
          {MESSAGES.sessionsTabTitle}
        </Text>
        <Text as="span" variant="body-sm" tone="secondary">
          {MESSAGES.sessionsTabCount(props.totalCount)}
        </Text>
        <Text as="span" variant="body-sm" tone="secondary">
          · {MESSAGES.sessionsTabRunningCount(props.runningCount)}
        </Text>
      </div>
    </div>
  );
}
