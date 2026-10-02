/**
 * "Archive project" (V2-T84, `docs/INTERFACE.md` § 4b): the recommended way to retire a project,
 * sitting above `Remove project` (which is for a project created by mistake). Two states, never
 * mixed (D-024 — `lifecycle` is the engine's own discriminated union):
 *
 * - **active**: the description and `Archive project…`, which opens the confirmation (with the
 *   optional note) — it never archives by itself.
 * - **archived**: the state — the date and note, the SAME text `seeya project show`/`list` print
 *   (`core/project-management-message.ts#formatArchiveStateText`) — and `Unarchive`, which runs
 *   directly (it is reversible and nothing is lost either way), with `loading` and the result
 *   shown by the dialog.
 *
 * Both buttons are off while another action runs, and off with the reason when another session
 * holds the project's lock (the engine would refuse anyway, D-047 item 8).
 */
import type { JSX } from 'preact';
import styles from './ArchiveSection.module.css';
import { cx } from '../../../components/css-class.js';
import { Section } from '../../../components/Section/index.js';
import { Text } from '../../../components/Text/index.js';
import { Button } from '../../../components/Button/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import { formatArchiveStateText } from '@seeya-ai/engine/core/project-management-message.js';
import type { ProjectLifecycle } from '@seeya-ai/engine/core/types.js';
import type { PendingProjectAction } from '../useProjectDetails.js';

export interface ArchiveSectionProps {
  readonly lifecycle: ProjectLifecycle;
  readonly writeBlockedReason: string | undefined;
  readonly pending: PendingProjectAction | null;
  readonly onArchive: () => void;
  readonly onUnarchive: () => void;
}

export function ArchiveSection(props: ArchiveSectionProps): JSX.Element {
  const { lifecycle } = props;
  const disabled = props.writeBlockedReason !== undefined || props.pending !== null;
  if (lifecycle.kind === 'archived') {
    return (
      <Section
        id="project-details-archive"
        title={MESSAGES.projectDetailsArchivedHeading}
        className={cx(styles, 'section')}
      >
        <Text as="div" variant="body-sm" id="project-details-archived-state">
          {formatArchiveStateText(lifecycle.archivedAt, lifecycle.note)}
        </Text>
        <Text as="div" variant="body-sm" tone="secondary">
          {MESSAGES.projectDetailsArchivedDescription}
        </Text>
        <div class={cx(styles, 'action')}>
          <Button
            id="project-details-unarchive"
            variant="secondary"
            size="sm"
            loading={props.pending?.kind === 'unarchiveProject'}
            disabled={disabled}
            title={props.writeBlockedReason}
            onClick={props.onUnarchive}
          >
            {MESSAGES.projectDetailsUnarchive}
          </Button>
        </div>
      </Section>
    );
  }
  return (
    <Section
      id="project-details-archive"
      title={MESSAGES.projectDetailsArchiveHeading}
      className={cx(styles, 'section')}
    >
      <Text as="div" variant="body-sm" tone="secondary">
        {MESSAGES.projectDetailsArchiveDescription}
      </Text>
      <div class={cx(styles, 'action')}>
        <Button
          id="project-details-archive-project"
          variant="secondary"
          size="sm"
          disabled={disabled}
          title={props.writeBlockedReason}
          onClick={props.onArchive}
        >
          {MESSAGES.projectDetailsArchiveProject}
        </Button>
      </div>
    </Section>
  );
}
