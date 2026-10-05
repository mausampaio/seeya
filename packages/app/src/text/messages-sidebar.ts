/**
 * The strings of the lateral: its toggle, favorites, recents, ignored projects and page tab labels (V2-T51: split out of `text/messages.ts`, which spreads it into
 * `MESSAGES` — the same pattern `project-details-messages.ts` already uses). No imports on
 * purpose, same as `messages.ts`.
 */
export const SIDEBAR_MESSAGES = {
  // V2-T30 — the "Projects" section, its dialogs, and the sidebar's collapse toggle.
  // V2-T63 correction: the side-strip toggle's own glyph is a static `<ChevronLeftIcon/>` now
  // (`app-shell.tsx`/`ui/icons.tsx`), not a text pair swapped at runtime — see
  // `electron/sidebar-collapse-view.ts#applySidebarCollapsed`'s own docstring for why it never
  // needed a second "reopen" glyph.
  // Maintainer acceptance, 2026-09-25: the side-strip toggle above wasn't discoverable ("um
  // controle que só se acha sabendo que existe é defeito") — this second, obvious button lives in
  // the toolbar next to "+" instead, with a tooltip naming the keyboard shortcut
  // (state/sidebar-toggle-shortcut.ts's own docstring has why it's scoped to "no terminal
  // focused"). V2-T64 PO review: its own icon is a real `ChevronLeftIcon`/`ChevronRightIcon` now
  // (`state/sidebar-collapse.ts#SidebarToggleButtonIcon`), never a text glyph pair — this module
  // keeps only the tooltip text, text being its whole job (this file's own top comment).
  sidebarToggleTooltipShow: 'Show sidebar (Ctrl+B)',
  sidebarToggleTooltipHide: 'Hide sidebar (Ctrl+B)',
  otherSessionsHeading: 'Other sessions',
  otherSessionsEmpty: 'No other sessions.',
  adoptButton: 'Adopt…',
  // V2-T72 item 2 — a project whose `seeya.json` failed to parse/validate no longer just
  // disappears from the window (the maintainer's own "o projeto some"): it shows here, with the
  // same reason the CLI's own "Ignored entries:" already prints, so it's clear what to fix.
  ignoredProjectsHeading: 'Ignored projects',
  ignoredProjectRowLabel: (projectId: string, reason: string): string => `${projectId}: ${reason}`,
  // V2-T55 item 2 — "Other sessions" groups by directory instead of one row per session.
  otherSessionsDirectoryRowLabel: (dir: string, sessionCount: number): string =>
    `${dir} (${sessionCount} session${sessionCount === 1 ? '' : 's'})`,
  // V2-T55 item 3 — the modal a directory row opens: name, short id (copyable), state, last
  // activity, one line each. `stateLabel` is already the formatted V2-T52 word, never the raw enum.
  otherSessionsDirDialogTitle: (dir: string): string => `Sessions in ${dir}`,
  otherSessionsDirDialogClose: 'Close',
  otherSessionsSessionCopyIdTitle: 'Copy id',
  otherSessionsSessionCopyIdCopied: 'Copied!',
  otherSessionsSessionLastActivityLabel: (lastActivityText: string): string =>
    `last activity: ${lastActivityText}`,
  sessionLastActivityUnknown: 'unknown',
  // V2-T55 item 4 — the window's own id-search field, always available regardless of relevanceHours.
  sessionSearchLabel: 'Find session by id',
  sessionSearchPlaceholder: 'Session id or the start of it',
  sessionSearchButton: 'Find',
  sessionSearchNotFound: (query: string): string => `No session matches "${query}".`,
  sessionSearchAmbiguous: (query: string, count: number): string =>
    `"${query}" matches ${count} sessions — type a few more characters.`,
  // V2-T63 — the lateral redesign (docs/INTERFACE.md § 1) and the reusable page-tab mechanism
  // (§ 2's own "abas de página": Today/Projects/Sessions).
  sidebarFavoritesHeading: 'Favorites',
  sidebarFavoriteStarLabel: (favorite: boolean, name: string): string =>
    favorite ? `Unstar ${name}` : `Star ${name}`,
  sidebarFavoriteOpenHere: 'open here',
  sidebarFavoriteLocked: 'locked',
  sidebarFavoritesEmpty: 'No favorites yet — star a project to pin it here.',
  sidebarRecentHeading: 'Recent',
  sidebarRecentEmpty: 'Nothing recent yet.',
  // Correction (real-window screenshot review): "All projects"/"Sessions" are nav rows now —
  // icon + label + a right-aligned count, built as separate DOM pieces
  // (`electron/sidebar-favorites-view.ts`), never one combined string like "All projects (2)".
  sidebarAllProjectsLabel: 'All projects',
  sidebarSessionsLabel: 'Sessions',
  sidebarSessionsCount: (runningCount: number): string => `${runningCount} running`,
  pageTabLabelToday: 'Today',
  pageTabLabelProjects: 'Projects',
  pageTabLabelSessions: 'Sessions',
} as const;
