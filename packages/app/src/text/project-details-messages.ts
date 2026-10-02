/**
 * The "Project details" dialog's own strings (V2-T83, `docs/INTERFACE.md` § 4a/§ 9). A separate
 * file spread into `text/messages.ts#MESSAGES` (`messages.ts` was already past AGENTS.md's ~500
 * line ceiling) — still one catalog for every caller, nobody imports this module directly except
 * `messages.ts` itself. The sentences that ALSO exist in the CLI (recovery line, "Linked
 * repository ...", the revert/remove outcomes) are not here: they live in
 * `@seeya-ai/engine/core/project-management-message.ts` and the dialog shows those verbatim.
 */
export const PROJECT_DETAILS_MESSAGES = {
  manageProjectButtonLabel: (name: string): string => `Manage project ${name}`,
  projectDetailsTitle: 'Project details',
  projectDetailsClose: 'Close',
  projectDetailsLoading: 'Loading…',
  projectDetailsNotFound: (projectId: string): string =>
    `Project "${projectId}" no longer exists in the workspace.`,
  projectDetailsLockLabel: 'Lock',
  projectDetailsPathLabel: 'Folder',
  projectDetailsLockedOpenHere:
    'This project is open in a tab. Close that tab to change it from here.',
  projectDetailsLockedByOther: (holder: string): string =>
    `${holder}. Changes are disabled until the lock is released.`,
  projectDetailsLoadError: (message: string): string => `Could not read the project: ${message}`,
  projectDetailsActionError: (message: string): string => `That did not work: ${message}`,

  projectDetailsRepositoriesHeading: 'Repositories',
  projectDetailsRepositoriesEmpty: 'No repository is associated with this project yet.',
  projectDetailsNoRemote: 'No remote',
  projectDetailsNotOnThisDevice: 'Not on this device',
  projectDetailsNotOnThisDeviceTitle:
    'This device has no folder for this repository (or the folder is gone). Add it again from the clone you have here.',
  projectDetailsAddRepository: 'Add repository…',
  projectDetailsRemoveRepository: 'Remove',
  projectDetailsRemoveRepositoryLabel: (name: string): string => `Remove repository ${name}`,

  projectDetailsAdoptionsHeading: 'Adopted sessions',
  projectDetailsAdoptionCopy: 'Copy',
  projectDetailsAdoptionOriginal: 'original',
  projectDetailsAdoptionAdoptedOn: (date: string): string => `adopted ${date}`,
  projectDetailsRevert: 'Revert…',
  projectDetailsRevertLabel: (copyId: string): string => `Revert the adoption of copy ${copyId}`,
  projectDetailsAdoptionNotFound:
    'That adoption is no longer registered for this project — nothing was changed.',

  projectDetailsRemoveHeading: 'Remove project',
  projectDetailsRemoveDescription:
    "For a project created by mistake. Takes it out of the workspace; its history stays in the workspace's own git, so it can be recovered. To retire a project you finished, archive it instead.",
  projectDetailsRemoveProject: 'Remove project…',

  confirmRevertTitle: (projectId: string): string => `Revert the adoption in "${projectId}"?`,
  confirmRevertContextCommits: (count: number): string =>
    `${count} commit${count === 1 ? '' : 's'} will be reverted, newest first.`,
  confirmRevertProceed: 'Revert',
  confirmRevertProceedExplanation:
    'Undoes those commits in one new commit, and lets the original session be adopted again.',
  confirmRevertDecline: 'Cancel',
  confirmRevertDeclineExplanation: 'Go back without changing anything.',

  confirmDeleteCopyTitle: 'Delete the adopted copy too?',
  confirmDeleteCopyKeep: 'Keep',
  confirmDeleteCopyKeepExplanation: 'Leave the copy in the session list. This is the default.',
  confirmDeleteCopyDelete: 'Delete copy',
  confirmDeleteCopyDeleteExplanation:
    'Remove the copy and its transcript for good — it was written to after the adoption.',

  confirmRemoveProjectTitle: (name: string): string => `Remove project "${name}"?`,
  confirmRemoveProjectContext: (fileCount: number): string =>
    `${fileCount} file${fileCount === 1 ? '' : 's'} will leave the workspace.`,
  confirmRemoveProjectNotDeleted:
    'Not deleted: the associated repositories, your sessions and their transcripts.',
  confirmRemoveProjectProceed: 'Remove project',
  confirmRemoveProjectProceedExplanation:
    'Deletes the project folder and commits that. The commit before it stays in the workspace history.',
  confirmRemoveProjectDecline: 'Cancel',
  confirmRemoveProjectDeclineExplanation: 'Go back without removing anything.',

  projectDetailsRemovedTitle: (projectId: string): string => `Project "${projectId}" removed`,
  projectDetailsRemovedDismiss: 'Done',
} as const;
