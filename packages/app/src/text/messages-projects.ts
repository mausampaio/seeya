/**
 * The strings of the Projects tab, the New project dialog and the project open/adopt confirmations (V2-T51: split out of `text/messages.ts`, which spreads it into
 * `MESSAGES` — the same pattern `project-details-messages.ts` already uses). No imports on
 * purpose, same as `messages.ts`.
 */
export const PROJECTS_MESSAGES = {
  // Correction (real-window screenshot review): this button is icon-only now (the "+" glyph
  // lives in the JSX/JS directly, `new-project-dialog-view.ts`) — this string is its
  // `aria-label`, so it stays without the ellipsis a text button would carry.
  newProjectButton: 'New project',
  newProjectDialogTitle: 'New project',
  newProjectIdLabel: 'Project id',
  newProjectSubmit: 'Create',
  newProjectCancel: 'Cancel',
  // V2-T67, same "never fails in silence" reasoning the Projects tab's own row actions follow.
  newProjectUnexpectedError: (message: string): string =>
    `seeya: create failed unexpectedly (${message}).`,
  // V2-T71 (`docs/INTERFACE.md` § 9's own "New project: campo Project id com o formato explicado
  // no erro"): shown next to the field the instant the typed id doesn't match `core/
  // project-id.ts#isValidProjectId` — the EXACT wording the task fixed, with the example id it
  // names. The engine's own `invalidId`/`alreadyExists` rejections (a submit the client-side
  // check let through, or a duplicate id — never silent, D-034) still surface through
  // `formatCreateProjectErrorText` below, unchanged.
  newProjectIdFormatError:
    'Use lowercase letters, digits and hyphens — for example payments-webhooks.',
  projectLockConfirmTitle: (projectId: string): string => `Project "${projectId}" is locked`,
  projectLockConfirmProceed: 'Open read-only',
  projectLockConfirmDecline: 'Cancel',
  // V2-T71 — one line beside each button (`docs/INTERFACE.md` § 9's own "o que cada opção faz
  // escrito ao lado dela").
  projectLockConfirmProceedExplanation:
    'You can look around, but nothing you change here will be saved until the other session ' +
    'finishes.',
  projectLockConfirmDeclineExplanation: 'Go back without opening the project.',
  leftoverChangesConfirmTitle: (projectId: string): string =>
    `Project "${projectId}" has uncommitted changes from a previous session`,
  leftoverChangesConfirmContext: (count: number): string =>
    `${count} file${count === 1 ? '' : 's'} changed, left uncommitted by a previous session:`,
  leftoverChangesConfirmCommit: 'Commit now',
  leftoverChangesConfirmProceed: 'Continue without committing',
  // V2-T71 — one line beside each button.
  leftoverChangesConfirmProceedExplanation:
    "Proceed, and the new session will be told what's still pending.",
  leftoverChangesConfirmCommitExplanation:
    'Commit these changes now (attributed to an unidentified session) before continuing.',
  // V2-T70 (`docs/INTERFACE.md` § 7): the single adoption dialog — picker, explanation and
  // review/result, replacing the four separate dialogs V2-T30 item 5 used to show.
  adoptPickTitle: 'Adopt into project',
  adoptPickExistingLabel: 'Existing project',
  adoptPickNewLabel: 'New project',
  adoptPickNewProjectIdLabel: 'Project id',
  adoptPickSubmit: 'Open the copy',
  adoptPickCancel: 'Cancel',
  adoptPickNoProjectChosen: 'Choose an existing project or type a new project id.',
  adoptPickInvalidNewProjectId:
    'Use lowercase letters, digits and hyphens — for example payments-webhooks.',
  adoptPickNoExistingProjects: 'No projects yet — type a new project id below.',
  adoptPickExplanationHeading: 'What happens next',
  adoptReviewTitle: 'Review before committing',
  adoptReviewEmpty: 'Nothing changed inside the project.',
  // PO review round 2 (`docs/INTERFACE.md` § 9's own "uma linha de contexto, o que cada opção
  // faz escrito ao lado dela" — the pattern `leftoverChangesConfirmContext`/
  // `leftoverChangesConfirm{Commit,Proceed}Explanation` above already established): the context
  // line sits in the scrollable body, above the file list; the two explanations sit in the
  // dialog's own fixed footer, above the buttons they describe.
  adoptReviewContext: (count: number, projectId: string): string =>
    `${count} file${count === 1 ? '' : 's'} changed in project "${projectId}":`,
  adoptReviewCommit: 'Commit',
  adoptReviewDiscard: 'Discard',
  adoptReviewDiscardExplanation: "Discard the copy's changes — nothing is recorded in the project.",
  adoptReviewCommitExplanation: 'Commit these changes to the project, attributed to this adoption.',
  adoptResultTitle: 'Adoption result',
  adoptResultOpenProject: 'Open project',
  adoptResultClose: 'Close',
  // V2-T70: the adoption review dialog's own per-file type badge (`state/adoption-review.ts`'s
  // own `AdoptionReviewRow.kind`).
  adoptReviewKindAdded: 'A',
  adoptReviewKindModified: 'M',
  adoptReviewKindDeleted: 'D',

  // V2-T67 — the Projects tab (`docs/INTERFACE.md` § 4), replacing the imperative
  // `renderer/legacy/projects-list-view.tsx` this task deletes.
  projectsTabTitle: 'Projects',
  projectsTabCount: (count: number): string => `${count} ${count === 1 ? 'project' : 'projects'}`,
  projectsSearchLabel: 'Search projects',
  projectsSearchPlaceholder: 'Search by name',
  projectsFilterGroupLabel: 'Filter projects',
  projectsFilterAll: 'All',
  projectsFilterRunning: 'With a running session',
  projectsFilterLocked: 'Locked',
  projectsTableHeaderName: 'Name',
  projectsTableHeaderLock: 'Lock',
  projectsTableHeaderSessions: 'Sessions',
  projectsTableHeaderRepositories: 'Repositories',
  projectsTableHeaderLastActivity: 'Last activity',
  // `docs/INTERFACE.md` § 4's own three lock texts, verbatim — `ProjectRowLock`
  // (`state/projects-panel.ts`) is the one place that decides WHICH of these a row shows.
  projectsLockOpenHere: 'Open in this window',
  projectsLockUnlocked: 'Unlocked',
  projectsLockLockedBy: (displaySessionId: string): string =>
    `Locked by session ${displaySessionId}`,
  projectsLockLockedByUnknown: 'Locked by an unidentified session',
  // V2-T84 (PO's own pending item on this table): the Lock COLUMN's shorter spelling — the full
  // sentence above stays on the cell's `title` and everywhere else a lock is described. At the
  // window's 1200px floor the full text lost the last characters of the session id.
  projectsLockLockedByCompact: (displaySessionId: string): string => `Locked · ${displaySessionId}`,
  projectsLockLockedByUnknownCompact: 'Locked · unknown',
  projectsActionGoToTab: 'Go to tab',
  projectsActionOpen: 'Open',
  projectsActionReadOnly: 'Read only…',
  projectsEmptyTitle: 'No projects yet',
  projectsEmptyDescription: 'Create a project to get started.',
  projectsNoMatchTitle: 'No projects match',
  projectsNoMatchDescription: 'Try a different search or filter.',
  // PO review round 1: the raw enum-ish "unknown" read as an error, not an absence of data —
  // a dash in secondary tone reads as "nothing recorded" instead, with the `title` saying so
  // explicitly (D-025: never a guessed date, just a clearer way to say there isn't one).
  projectsLastActivityUnknown: '—',
  projectsLastActivityUnknownTitle: 'No activity recorded for this project yet.',
} as const;
