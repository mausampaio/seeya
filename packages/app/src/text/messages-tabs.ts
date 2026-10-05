/**
 * The strings of the window title, the status heading and the tab strip with its New tab popover (V2-T51: split out of `text/messages.ts`, which spreads it into
 * `MESSAGES` — the same pattern `project-details-messages.ts` already uses). No imports on
 * purpose, same as `messages.ts`.
 */
export const TABS_MESSAGES = {
  windowTitle: 'seeya',
  statusHeading: 'Status',
  // V2-T64 PO review: "exited (N)" — the "code" word dropped, `docs/INTERFACE.md`'s own "· exited"
  // is the exact state text a tab's own exited suffix renders (`state/tab-strip.ts
  // #buildTabStripEntries`'s own `exitedText`, kept apart from `label` so `TabStripItem` can give
  // it its own colour — the "·" separator itself is this component's own markup, not part of this
  // string).
  tabExited: (exitCode: number): string => `exited (${exitCode})`,

  // V2-T64 — the tab strip's own "+" button and its New tab popover (`docs/INTERFACE.md` § 2),
  // replacing the former command bar (`commandBar*`, removed with it).
  newTabButtonLabel: 'New tab',
  newTabPopoverHeading: 'New tab',
  newTabKindGroupLabel: 'Command',
  newTabOtherCommandLabel: 'Command',
  newTabOtherCommandPlaceholder: 'e.g. npx tsx, python -i',
  newTabDirectoryLabel: 'Directory',
  newTabDirectoryPlaceholder: 'Leave blank for the home directory',
  newTabBrowseButton: 'Browse…',
  newTabRecentDirectoriesLabel: 'Recent',
  newTabOpenButton: 'Open',
  newTabCancelButton: 'Cancel',
} as const;
