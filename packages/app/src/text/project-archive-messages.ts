/**
 * The archive feature's own strings (V2-T84, `docs/INTERFACE.md` § 4b/§ 9). A separate file spread
 * into `text/messages.ts#MESSAGES`, same split `project-details-messages.ts` already uses. The
 * sentences that ALSO exist in the CLI (what archiving did, "already archived", the archive state
 * line) live in `@seeya-ai/engine/core/project-management-message.ts` and are shown verbatim.
 */
export const PROJECT_ARCHIVE_MESSAGES = {
  projectsFilterArchived: 'Archived',
  /** The column that replaces `Lock` while the `Archived` filter is on — a lock is meaningless on
   * a project nobody opens. */
  projectsTableHeaderArchived: 'Archived',
  projectsActionUnarchive: 'Unarchive…',
  projectsUnarchiveBlockedByLock: (holder: string): string =>
    `${holder}. Unarchiving is disabled until the lock is released.`,
  projectsNoArchivedTitle: 'No archived projects',
  projectsNoArchivedDescription:
    'A project you archive from its details leaves the day-to-day views and shows up here.',
  /** Sessions tab: the project-session `Resume` is off for an archived project — the tooltip says
   * why, never a click that fails afterwards. */
  sessionsResumeArchivedReason: 'This project is archived. Unarchive it to resume its sessions.',

  projectDetailsArchiveHeading: 'Archive project',
  projectDetailsArchiveDescription:
    'Recommended when the project is finished, paused or abandoned: it leaves the day-to-day views, nothing is deleted, and you can unarchive it any time.',
  projectDetailsArchiveProject: 'Archive project…',
  projectDetailsArchivedHeading: 'Archived',
  projectDetailsArchivedDescription:
    'This project is hidden from Favorites, Recent and the default project list. Nothing was deleted.',
  projectDetailsUnarchive: 'Unarchive',

  confirmArchiveTitle: (name: string): string => `Archive project "${name}"?`,
  confirmArchiveChangesLine:
    'It leaves Favorites, Recent and the default Projects list. Its sessions stay in the Sessions tab, and End day still captures them.',
  confirmArchiveNothingDeletedLine:
    'Nothing is deleted. You can unarchive it from the Archived filter of the Projects tab.',
  confirmArchiveNoteLabel: 'Note (optional)',
  confirmArchiveNotePlaceholder: 'e.g. Finished — shipped',
  confirmArchiveProceed: 'Archive',
  confirmArchiveProceedExplanation: 'Archives the project and commits that in the workspace.',
  confirmArchiveDecline: 'Cancel',
  confirmArchiveDeclineExplanation: 'Go back without changing anything.',

  confirmUnarchiveTitle: (name: string): string => `Unarchive project "${name}"?`,
  confirmUnarchiveContextLine: 'An archived project cannot be opened until it is unarchived.',
  confirmUnarchiveProceed: 'Unarchive',
  confirmUnarchiveProceedExplanation:
    'Brings it back into Favorites, Recent and the project list. Nothing is opened.',
  confirmUnarchiveAndOpen: 'Unarchive and open',
  confirmUnarchiveAndOpenExplanation: 'Unarchives it and then opens it in a tab right away.',
  confirmUnarchiveDecline: 'Cancel',
  confirmUnarchiveDeclineExplanation: 'Go back; the project stays archived.',
} as const;
