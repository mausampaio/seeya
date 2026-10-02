/**
 * V2-T77 (`docs/INTERFACE.md` § 5a: "falha nunca em silêncio"): what happened to the last
 * `Resume` of a project session — shown above the table in BOTH the Projects and the Sessions tab,
 * since both can start one. A refusal (`resumed: false`: session running, not in the project, a
 * declined question) reads as a warning; a session that ran and closed reads as plain information.
 * Dismissable; also replaced by the next attempt (`useProjectSessionResume.ts`).
 */
import type { JSX } from 'preact';
import styles from './ProjectResumeNotice.module.css';
import { cx } from '../../../components/css-class.js';
import { InfoBox } from '../../../components/InfoBox/index.js';
import { Text } from '../../../components/Text/index.js';
import { Button } from '../../../components/Button/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import type { ProjectSessionResumeResult } from '../../../hooks/useProjectSessionResume.js';

export interface ProjectResumeNoticeProps {
  readonly result: ProjectSessionResumeResult;
  readonly onDismiss: () => void;
}

export function ProjectResumeNotice(props: ProjectResumeNoticeProps): JSX.Element {
  return (
    <InfoBox tone={props.result.resumed ? 'info' : 'warning'} className={cx(styles, 'notice')}>
      <div class={cx(styles, 'row')} role="status">
        <Text as="p" variant="body-sm">
          {props.result.text}
        </Text>
        <Button size="sm" variant="ghost" onClick={props.onDismiss}>
          {MESSAGES.projectSessionsDismissResult}
        </Button>
      </div>
    </InfoBox>
  );
}
