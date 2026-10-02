/**
 * "Repositories" (V2-T83, `docs/INTERFACE.md` § 4a): one row per associated repository — name,
 * remote (or `No remote`), and the folder on THIS device (or `Not on this device`, D-025: the map
 * has no entry, or its folder is gone — never a path the dialog cannot vouch for). `Add
 * repository…` opens the OS folder picker (`PickDirectory` through the hook) and `Remove` is one
 * click, no confirmation — the CLI's own precedent: reversible through the workspace history.
 *
 * Writes are disabled together, with the reason in each button's `title`, while the project is
 * locked by a live session (`writeBlockedReason`) or while another action is already running
 * (`busy`) — the engine would refuse the first and serialize the second anyway (D-047 item 8).
 */
import type { JSX } from 'preact';
import styles from './RepositoriesSection.module.css';
import { cx } from '../../../components/css-class.js';
import { Section } from '../../../components/Section/index.js';
import { Text } from '../../../components/Text/index.js';
import { Button } from '../../../components/Button/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import { formatDirectoryPathForDisplay } from '../../../../sidebar/directory-label.js';
import type { PathPlatformHint } from '@seeya-ai/engine/core/cwd-normalization.js';
import type { ProjectDetailsRepositoryRow } from '../../../../state/project-details.js';
import type { PendingProjectAction } from '../useProjectDetails.js';

export interface RepositoriesSectionProps {
  readonly repositories: readonly ProjectDetailsRepositoryRow[];
  /** Why writes are off right now, or `undefined` when they are on. */
  readonly writeBlockedReason: string | undefined;
  readonly pending: PendingProjectAction | null;
  readonly homeDir: string;
  readonly platformHint: PathPlatformHint;
  readonly onAdd: () => void;
  readonly onRemove: (name: string) => void;
}

function LocalPath(props: {
  readonly row: ProjectDetailsRepositoryRow;
  readonly homeDir: string;
  readonly platformHint: PathPlatformHint;
}): JSX.Element {
  const { localPath } = props.row;
  if (localPath.kind === 'notOnThisDevice') {
    return (
      <Text
        as="span"
        variant="caption"
        tone="tertiary"
        title={MESSAGES.projectDetailsNotOnThisDeviceTitle}
      >
        {MESSAGES.projectDetailsNotOnThisDevice}
      </Text>
    );
  }
  return (
    <Text as="span" variant="code" tone="secondary" truncate title={localPath.path}>
      {formatDirectoryPathForDisplay(localPath.path, props.homeDir, props.platformHint)}
    </Text>
  );
}

function RepositoryRow(
  props: RepositoriesSectionProps & {
    readonly row: ProjectDetailsRepositoryRow;
  },
): JSX.Element {
  const { row } = props;
  const removing = props.pending?.kind === 'removeRepository' && props.pending.name === row.name;
  return (
    <li class={cx(styles, 'item')} data-repository-name={row.name}>
      <div class={cx(styles, 'text')}>
        <Text as="span" variant="body-sm" weight={500} truncate title={row.name}>
          {row.name}
        </Text>
        {row.remote === null ? (
          <Text as="span" variant="caption" tone="tertiary">
            {MESSAGES.projectDetailsNoRemote}
          </Text>
        ) : (
          <Text as="span" variant="code" tone="secondary" truncate title={row.remote}>
            {row.remote}
          </Text>
        )}
        <LocalPath row={row} homeDir={props.homeDir} platformHint={props.platformHint} />
      </div>
      <Button
        size="sm"
        variant="ghost"
        loading={removing}
        disabled={props.writeBlockedReason !== undefined || props.pending !== null}
        title={props.writeBlockedReason ?? MESSAGES.projectDetailsRemoveRepositoryLabel(row.name)}
        onClick={() => props.onRemove(row.name)}
      >
        {MESSAGES.projectDetailsRemoveRepository}
      </Button>
    </li>
  );
}

export function RepositoriesSection(props: RepositoriesSectionProps): JSX.Element {
  return (
    <Section
      id="project-details-repositories"
      title={MESSAGES.projectDetailsRepositoriesHeading}
      className={cx(styles, 'section')}
      action={
        <Button
          id="project-details-add-repository"
          size="sm"
          variant="secondary"
          loading={props.pending?.kind === 'addRepository'}
          disabled={props.writeBlockedReason !== undefined || props.pending !== null}
          title={props.writeBlockedReason}
          onClick={props.onAdd}
        >
          {MESSAGES.projectDetailsAddRepository}
        </Button>
      }
    >
      {props.repositories.length === 0 ? (
        <Text as="div" variant="body-sm" tone="secondary">
          {MESSAGES.projectDetailsRepositoriesEmpty}
        </Text>
      ) : (
        <ul class={cx(styles, 'list')}>
          {props.repositories.map((row) => (
            <RepositoryRow key={row.name} {...props} row={row} />
          ))}
        </ul>
      )}
    </Section>
  );
}
