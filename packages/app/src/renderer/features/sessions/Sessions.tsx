/**
 * D-052 (V2-T68, `docs/INTERFACE.md` § 5): the Sessions tab — replaces the directory modal
 * (`renderer/legacy/other-sessions-dir-dialog-view.ts`) and the id-search field
 * (`renderer/legacy/session-search-view.ts`), both apagados by this task, plus the "Other
 * sessions" directory list half of `renderer/legacy/other-sessions-and-ignored-view.ts` (renamed
 * `ignored-projects-view.ts`, keeping only the sidebar's own "Ignored projects" list, which stays
 * untouched legacy content). Mounted once, as a static child of `#page-sessions`
 * (`renderer/features/tabs/TabStrip.tsx`), the same "mounts once for the life of the window"
 * lifetime `<Today/>`/`<Projects/>` already have.
 *
 * Four top-level states, decided here (D-041 — the table itself has no opinion about WHY it has
 * no rows): no session discovered AT ALL (`EmptyState`, docs/INTERFACE.md § 5's own "lista
 * vazia"); the direct id lookup came back ambiguous or empty (two more `docs/INTERFACE.md`-named
 * states); a search/filter that matches nothing locally (`EmptyState`, "busca ou filtro sem
 * resultado"); otherwise, the table.
 *
 * @example
 * <Sessions/>
 */
import type { JSX } from 'preact';
import styles from './Sessions.module.css';
import { cx } from '../../components/css-class.js';
import { EmptyState } from '../../components/EmptyState/index.js';
import { Text } from '../../components/Text/index.js';
import { MESSAGES } from '../../../text/messages.js';
import { SessionsHeader } from './SessionsHeader/index.js';
import { SessionsFilters } from './SessionsFilters/index.js';
import { SessionsTable } from './SessionsTable/index.js';
import { useSessions } from './useSessions.js';

export function Sessions(): JSX.Element {
  const controls = useSessions();

  return (
    <div class={cx(styles, 'sessions')}>
      <SessionsHeader totalCount={controls.totalCount} runningCount={controls.runningCount} />
      {controls.hasAnySession && (
        <SessionsFilters
          query={controls.query}
          onQueryChange={controls.setQuery}
          filters={controls.filters}
          onStateFilterChange={controls.setStateFilter}
          onProjectFilterChange={controls.setProjectFilter}
          onDirectoryFilterChange={controls.setDirectoryFilter}
          projectOptions={controls.projectOptions}
          directoryOptions={controls.directoryOptions}
          homeDir={controls.homeDir}
          platformHint={controls.platformHint}
        />
      )}
      {!controls.hasAnySession ? (
        <EmptyState
          title={MESSAGES.sessionsEmptyTitle}
          description={MESSAGES.sessionsEmptyDescription}
        />
      ) : controls.directSearch.kind === 'notFound' ? (
        <EmptyState
          title={MESSAGES.sessionsNoMatchTitle}
          description={MESSAGES.sessionSearchNotFound(controls.directSearch.query)}
        />
      ) : controls.rows.length === 0 ? (
        <EmptyState
          title={MESSAGES.sessionsNoMatchTitle}
          description={MESSAGES.sessionsNoMatchDescription}
        />
      ) : (
        <>
          {controls.directSearch.kind === 'ambiguous' && (
            <Text
              as="p"
              variant="body-sm"
              tone="secondary"
              className={cx(styles, 'ambiguousNotice')}
            >
              {MESSAGES.sessionSearchAmbiguous(
                controls.directSearch.query,
                controls.directSearch.rows.length,
              )}
            </Text>
          )}
          <SessionsTable
            rows={controls.rows}
            homeDir={controls.homeDir}
            platformHint={controls.platformHint}
            isResumePending={controls.isResumePending}
            onRowAction={controls.onRowAction}
            onAdopt={controls.onAdopt}
          />
        </>
      )}
    </div>
  );
}
