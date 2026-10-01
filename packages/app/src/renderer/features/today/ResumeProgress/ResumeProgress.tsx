/**
 * D-052 (V2-T66, `docs/INTERFACE.md` § 3): "Progresso da retomada (`Resuming i of N: <nome>…`)...
 * aparecem na própria aba, acima dos cartões." Replaces the bare `#today-progress` `<p>`
 * `renderer/legacy/today-panel-view.ts` used to write to directly.
 *
 * `null` renders nothing — `Today.tsx` only mounts this while `useToday`'s own `progress` is set
 * (between the first `resumeProgress` push and the summary replacing it).
 *
 * @example
 * <ResumeProgress progress={{ index: 2, total: 3, name: 'payments-webhooks' }} />
 */
import type { JSX } from 'preact';
import styles from './ResumeProgress.module.css';
import { cx } from '../../../components/css-class.js';
import { Surface } from '../../../components/Surface/index.js';
import { Text } from '../../../components/Text/index.js';
import { Spinner } from '../../../components/Spinner/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import type { ResumeProgressUpdateEvent } from '../../../../ipc/channels.js';

export interface ResumeProgressProps {
  readonly progress: ResumeProgressUpdateEvent | null;
}

export function ResumeProgress(props: ResumeProgressProps): JSX.Element | null {
  if (props.progress === null) {
    return null;
  }
  const { index, total, name } = props.progress;
  return (
    <Surface padding="sm" className={cx(styles, 'progress')}>
      <Spinner size={16} />
      <Text as="p" variant="body-sm" weight={500}>
        {MESSAGES.todayResumeProgress(index, total, name)}
      </Text>
    </Surface>
  );
}
