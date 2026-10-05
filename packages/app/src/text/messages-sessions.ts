/**
 * The strings of the Sessions tab and the project sessions list (V2-T51: split out of `text/messages.ts`, which spreads it into
 * `MESSAGES` — the same pattern `project-details-messages.ts` already uses). No imports on
 * purpose, same as `messages.ts`.
 */
export const SESSIONS_MESSAGES = {
  // V2-T68 — the Sessions tab (`docs/INTERFACE.md` § 5), replacing the directory modal and the
  // id-search field this task deletes (`other-sessions-dir-dialog-view.ts`/`session-search-view.ts`).
  sessionsTabTitle: 'Sessions',
  sessionsTabCount: (count: number): string => `${count} ${count === 1 ? 'session' : 'sessions'}`,
  sessionsTabRunningCount: (count: number): string => `${count} running`,
  sessionsSearchLabel: 'Search by name or id',
  sessionsSearchPlaceholder: 'Name, id, or the start of it',
  sessionsFilterStateGroupLabel: 'Filter by state',
  sessionsFilterStateAll: 'All',
  sessionsFilterStateRunning: 'Running',
  sessionsFilterStateNotRunning: 'Not running',
  sessionsFilterProjectLabel: 'Project',
  sessionsFilterProjectAny: 'Any project',
  sessionsFilterProjectNone: 'No project',
  sessionsFilterDirectoryLabel: 'Directory',
  sessionsFilterDirectoryAny: 'Any directory',
  sessionsTableHeaderName: 'Name',
  sessionsTableHeaderId: 'Id',
  sessionsTableHeaderState: 'State',
  sessionsTableHeaderDirectory: 'Directory',
  sessionsTableHeaderProject: 'Project',
  sessionsTableHeaderLastActivity: 'Last activity',
  sessionsNoProject: 'No project',
  sessionsActionResume: 'Resume',
  sessionsEmptyTitle: 'No sessions yet',
  sessionsEmptyDescription: 'Discovered sessions will show up here.',
  sessionsNoMatchTitle: 'No sessions match',
  sessionsNoMatchDescription: 'Try a different search or filter.',

  // V2-T77 (`docs/INTERFACE.md` § 5a) — a project's own sessions, listed under its row in the
  // Projects tab, each with `Resume` (the project's `open` flow, not the simple resume).
  projectSessionsExpandLabel: (projectName: string, expanded: boolean): string =>
    `${expanded ? 'Hide' : 'Show'} sessions of ${projectName}`,
  projectSessionsListLabel: (projectName: string): string => `Sessions of ${projectName}`,
  projectSessionsNone: 'No sessions yet. Open the project to start one.',
  projectSessionsShowAll: (totalCount: number): string => `Show all ${totalCount} in Sessions`,
  projectSessionsResumeTitle:
    'Resumes this session through the same flow as Open: lock, hooks, CLAUDE.md.',
  projectSessionsDismissResult: 'Dismiss',
} as const;
