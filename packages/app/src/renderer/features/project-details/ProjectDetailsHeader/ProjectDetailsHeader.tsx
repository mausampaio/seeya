/**
 * The "Project details" dialog's header (V2-T83, `docs/INTERFACE.md` § 4a): name, id (mono), the
 * SAME lock text the Projects tab's Lock column shows (`state/projects-panel.ts
 * #formatProjectRowLockText`, handed in already formatted — one wording, never a second one), and
 * the project folder abbreviated with `~` (`formatDirectoryPathForDisplay`), the full path one
 * hover away in `title`.
 */
import type { JSX } from 'preact';
import styles from './ProjectDetailsHeader.module.css';
import { cx } from '../../../components/css-class.js';
import { Text } from '../../../components/Text/index.js';
import { Stack } from '../../../components/Stack/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import { formatDirectoryPathForDisplay } from '../../../../sidebar/directory-label.js';
import type { PathPlatformHint } from '@seeya-ai/engine/core/cwd-normalization.js';

export interface ProjectDetailsHeaderProps {
  readonly name: string;
  readonly projectId: string;
  /** `null` when the project's Projects-tab row is not available (e.g. it was just removed). */
  readonly lockText: string | null;
  readonly dir: string;
  readonly homeDir: string;
  readonly platformHint: PathPlatformHint;
}

export function ProjectDetailsHeader(props: ProjectDetailsHeaderProps): JSX.Element {
  const displayDir = formatDirectoryPathForDisplay(props.dir, props.homeDir, props.platformHint);
  return (
    <Stack gap="xs" className={cx(styles, 'header')}>
      <Text as="p" variant="heading-3" id="project-details-name" truncate title={props.name}>
        {props.name}
      </Text>
      <Text as="p" variant="code" tone="secondary" id="project-details-id">
        {props.projectId}
      </Text>
      {props.lockText !== null && (
        <Text as="p" variant="body-sm" tone="secondary" id="project-details-lock">
          {MESSAGES.projectDetailsLockLabel}: {props.lockText}
        </Text>
      )}
      <Text
        as="p"
        variant="body-sm"
        tone="secondary"
        truncate
        id="project-details-path"
        title={props.dir}
      >
        {MESSAGES.projectDetailsPathLabel}: {displayDir}
      </Text>
    </Stack>
  );
}
