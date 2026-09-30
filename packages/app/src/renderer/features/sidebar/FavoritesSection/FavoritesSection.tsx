/**
 * D-052 (V2-T75): the lateral's own Favorites section (`docs/INTERFACE.md` § 1 item 3) — a real
 * component now, replacing the imperative rendering inside the deleted
 * `renderer/legacy/sidebar-favorites-view.tsx`. Star, name and the lock badge
 * (`openHere`/`locked`/none); a favorite open in THIS window also shows its own sessions,
 * indented — `state/sidebar-summary.ts#buildFavoriteProjectRows` already decided which.
 *
 * @example
 * <FavoritesSection rows={favorites} onOpenProject={openProject} onNewProject={openNewProjectDialog}/>
 */
import type { JSX } from 'preact';
import styles from './FavoritesSection.module.css';
import { cx } from '../../../components/css-class.js';
import { Section } from '../../../components/Section/index.js';
import { IconButton } from '../../../components/IconButton/index.js';
import { Chip } from '../../../components/Chip/index.js';
import { PlusIcon, StarIcon } from '../../../components/Icon/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import type { FavoriteProjectRow } from '../../../../state/sidebar-summary.js';

export interface FavoritesSectionProps {
  readonly rows: readonly FavoriteProjectRow[];
  readonly onOpenProject: (projectId: string) => void;
  readonly onToggleFavorite: (projectId: string, favorite: boolean) => void;
}

function FavoriteRow(props: {
  readonly row: FavoriteProjectRow;
  readonly onOpenProject: (projectId: string) => void;
  readonly onToggleFavorite: (projectId: string, favorite: boolean) => void;
}): JSX.Element {
  const { row } = props;
  return (
    <li class={cx(styles, 'row')}>
      <button
        type="button"
        class={cx(styles, 'star')}
        aria-pressed="true"
        aria-label={MESSAGES.sidebarFavoriteStarLabel(true, row.name)}
        onClick={(event) => {
          event.stopPropagation();
          props.onToggleFavorite(row.projectId, false);
        }}
      >
        <StarIcon filled />
      </button>
      <button
        type="button"
        class={cx(styles, 'name')}
        onClick={() => props.onOpenProject(row.projectId)}
      >
        {row.name}
      </button>
      {row.badge !== 'none' && (
        <Chip tone={row.badge === 'openHere' ? 'success' : 'warning'} size="sm">
          {row.badge === 'openHere'
            ? MESSAGES.sidebarFavoriteOpenHere
            : MESSAGES.sidebarFavoriteLocked}
        </Chip>
      )}
      {row.sessions.length > 0 && (
        <ul class={cx(styles, 'sessions')}>
          {row.sessions.map((session) => (
            <li key={session.sessionId} class={cx(styles, 'sessionRow')}>
              {MESSAGES.projectSessionRowLabel(
                session.name,
                session.displaySessionId,
                session.stateLabel,
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function FavoritesSection(props: FavoritesSectionProps): JSX.Element {
  return (
    <Section
      id="favorites-section"
      title={MESSAGES.sidebarFavoritesHeading}
      action={
        // No `onClick` here on purpose — `renderer/legacy/new-project-dialog-view.ts#wireNewProjectDialog`
        // attaches the real click handler to this exact `id` after mount (unchanged by this task,
        // D-052's own "o que ainda não é reescrito... fica funcionando"), same passthrough-anchor
        // pattern `SidebarFooter`'s own `end-day-button`/`autostart-control-button` use.
        <IconButton id="new-project-button" size="sm" aria-label={MESSAGES.newProjectButton}>
          <PlusIcon />
        </IconButton>
      }
    >
      {props.rows.length === 0 ? (
        <p class={cx(styles, 'empty')}>{MESSAGES.sidebarFavoritesEmpty}</p>
      ) : (
        <ul class={cx(styles, 'list')}>
          {props.rows.map((row) => (
            <FavoriteRow
              key={row.projectId}
              row={row}
              onOpenProject={props.onOpenProject}
              onToggleFavorite={props.onToggleFavorite}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}
