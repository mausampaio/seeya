/**
 * "Project details" (V2-T83, `docs/INTERFACE.md` § 4a): the window's home for what used to exist
 * only on the CLI — `add-repo`, `remove-repo`, `revert-adoption` and `remove`. Opened by the
 * `Manage project` icon button on a Projects tab row (`ProjectsTable`), through
 * `project-details-bridge.ts`; the row's own main action (`Go to tab`/`Open`/`Read only…`) is
 * untouched.
 *
 * **Why its own feature folder, mounted by `App.tsx`.** It is a modal opened from the Projects tab
 * but not part of that tab's own region: a `<dialog>` inside `#page-projects` would never show
 * while another tab is active (`display: none`, `Projects.tsx`'s own docstring), and the three
 * confirmations it triggers (`features/confirmations/`) are mounted at the same level for the
 * same reason. The dialog is the one place that decides what is shown; every sentence in it that
 * also exists in the CLI comes from the engine (`core/project-management-message.ts`).
 *
 * Three states of the body, never mixed: the project was removed (only the result, with the "how
 * to recover" line — the project no longer exists to show), loading/not found/read failed (a
 * single line), or the project itself (header, optional lock notice, the last action's result,
 * then the sections). The footer is always just `Close`.
 *
 * @example
 * <ProjectDetailsDialog/> // mounted once, in App.tsx
 */
import type { JSX } from 'preact';
import styles from './ProjectDetailsDialog.module.css';
import { cx } from '../../components/css-class.js';
import { Dialog } from '../../components/Dialog/index.js';
import { Text } from '../../components/Text/index.js';
import { Button } from '../../components/Button/index.js';
import { InfoBox } from '../../components/InfoBox/index.js';
import { Stack } from '../../components/Stack/index.js';
import { MESSAGES } from '../../../text/messages.js';
import { formatProjectRowLockText } from '../../../state/projects-panel.js';
import { resolveWriteBlockedReason } from '../../../state/project-details.js';
import type { ProjectActionResponse } from '../../../state/project-details-result.js';
import { ProjectDetailsHeader } from './ProjectDetailsHeader/index.js';
import { RepositoriesSection } from './RepositoriesSection/index.js';
import { AdoptionsSection } from './AdoptionsSection/index.js';
import { RemoveProjectSection } from './RemoveProjectSection/index.js';
import { useProjectDetails, type ProjectDetailsControls } from './useProjectDetails.js';

function ActionResult(props: { readonly result: ProjectActionResponse }): JSX.Element {
  return (
    <InfoBox tone={props.result.tone === 'success' ? 'success' : props.result.tone}>
      <Stack gap="xs">
        {props.result.lines.map((line) => (
          <Text key={line} as="div" variant="body-sm" className={cx(styles, 'resultLine')}>
            {line}
          </Text>
        ))}
      </Stack>
    </InfoBox>
  );
}

function RemovedBody(props: {
  readonly projectId: string;
  readonly removed: ProjectActionResponse;
}): JSX.Element {
  return (
    <Stack gap="md">
      <Text as="div" variant="heading-3" id="project-details-removed-title">
        {MESSAGES.projectDetailsRemovedTitle(props.projectId)}
      </Text>
      <ActionResult result={props.removed} />
    </Stack>
  );
}

function ProjectBody(props: { readonly controls: ProjectDetailsControls }): JSX.Element {
  const { controls } = props;
  const { details } = controls;
  if (controls.loadError !== null && details === null) {
    return (
      <Text as="div" variant="body-sm" tone="secondary" id="project-details-load-error">
        {controls.loadError}
      </Text>
    );
  }
  if (details === null) {
    return (
      <Text as="div" variant="body-sm" tone="secondary">
        {MESSAGES.projectDetailsLoading}
      </Text>
    );
  }
  if (details.kind === 'notFound') {
    return (
      <Text as="div" variant="body-sm" tone="secondary" id="project-details-not-found">
        {MESSAGES.projectDetailsNotFound(details.projectId)}
      </Text>
    );
  }
  const blockedReason = resolveWriteBlockedReason(details.writeAccess, controls.row?.lock ?? null);
  return (
    <>
      <ProjectDetailsHeader
        name={details.name}
        projectId={details.projectId}
        lockText={controls.row === null ? null : formatProjectRowLockText(controls.row.lock)}
        dir={details.dir}
        homeDir={controls.homeDir}
        platformHint={controls.platformHint}
      />
      {blockedReason !== undefined && (
        <InfoBox tone="warning" className={cx(styles, 'notice')}>
          <Text as="div" variant="body-sm" id="project-details-locked-notice">
            {blockedReason}
          </Text>
        </InfoBox>
      )}
      {controls.result !== null && (
        <div class={cx(styles, 'notice')} id="project-details-result">
          <ActionResult result={controls.result} />
        </div>
      )}
      <RepositoriesSection
        repositories={details.repositories}
        writeBlockedReason={blockedReason}
        pending={controls.pending}
        homeDir={controls.homeDir}
        platformHint={controls.platformHint}
        onAdd={controls.onAddRepository}
        onRemove={controls.onRemoveRepository}
      />
      <AdoptionsSection
        adoptions={details.adoptions}
        writeBlockedReason={blockedReason}
        pending={controls.pending}
        onRevert={controls.onRevertAdoption}
      />
      <RemoveProjectSection
        writeBlockedReason={blockedReason}
        pending={controls.pending}
        onRemove={controls.onRemoveProject}
      />
    </>
  );
}

export function ProjectDetailsDialog(): JSX.Element {
  const controls = useProjectDetails();
  return (
    <Dialog
      id="project-details-dialog"
      title={MESSAGES.projectDetailsTitle}
      open={controls.open}
      onClose={controls.close}
      className={cx(styles, 'dialog')}
      footer={
        <Button id="project-details-close" variant="secondary" onClick={controls.close}>
          {controls.removed === null
            ? MESSAGES.projectDetailsClose
            : MESSAGES.projectDetailsRemovedDismiss}
        </Button>
      }
    >
      {controls.projectId !== null && controls.removed !== null ? (
        <RemovedBody projectId={controls.projectId} removed={controls.removed} />
      ) : (
        <ProjectBody controls={controls} />
      )}
    </Dialog>
  );
}
