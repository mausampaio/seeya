/**
 * "Remove project" (V2-T83, `docs/INTERFACE.md` § 4a): a separate area at the very end of the
 * dialog, with an `error`-toned button — the one destructive action here. It never removes
 * anything by itself: the click calls the engine's `removeProject`, which asks its own § 9
 * confirmation (name, file count, what is NOT deleted) before touching the workspace.
 */
import type { JSX } from 'preact';
import styles from './RemoveProjectSection.module.css';
import { cx } from '../../../components/css-class.js';
import { Section } from '../../../components/Section/index.js';
import { Text } from '../../../components/Text/index.js';
import { Button } from '../../../components/Button/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import type { PendingProjectAction } from '../useProjectDetails.js';

export interface RemoveProjectSectionProps {
  readonly writeBlockedReason: string | undefined;
  readonly pending: PendingProjectAction | null;
  readonly onRemove: () => void;
}

export function RemoveProjectSection(props: RemoveProjectSectionProps): JSX.Element {
  return (
    <Section
      id="project-details-remove"
      title={MESSAGES.projectDetailsRemoveHeading}
      className={cx(styles, 'section')}
    >
      <Text as="div" variant="body-sm" tone="secondary">
        {MESSAGES.projectDetailsRemoveDescription}
      </Text>
      <div class={cx(styles, 'action')}>
        <Button
          id="project-details-remove-project"
          variant="secondary"
          tone="error"
          size="sm"
          loading={props.pending?.kind === 'removeProject'}
          disabled={props.writeBlockedReason !== undefined || props.pending !== null}
          title={props.writeBlockedReason}
          onClick={props.onRemove}
        >
          {MESSAGES.projectDetailsRemoveProject}
        </Button>
      </div>
    </Section>
  );
}
