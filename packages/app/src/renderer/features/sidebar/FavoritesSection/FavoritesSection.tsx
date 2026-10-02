/**
 * D-052 (V2-T75): the lateral's own Favorites section (`docs/INTERFACE.md` § 1 item 3) — a real
 * component now, replacing the imperative rendering inside the deleted
 * `renderer/legacy/sidebar-favorites-view.tsx`.
 *
 * PO review (2026-10-01): row rendering (star, name, active highlight, lock status, indented
 * sessions) moved into the shared `ProjectRow` component (`renderer/features/sidebar/ProjectRow/`)
 * — `RecentSection` renders the identical shape for its own rows now, differing only by the
 * leading icon/action (`ProjectRow`'s own `leading` prop). This file is left with only what is
 * actually specific to Favorites: the section heading/`+` action and which `leading` variant to
 * pass.
 *
 * @example
 * <FavoritesSection rows={favorites} onOpenProject={openProject} onToggleFavorite={toggleFavorite}/>
 */
import type { JSX } from 'preact';
import styles from './FavoritesSection.module.css';
import { cx } from '../../../components/css-class.js';
import { Section } from '../../../components/Section/index.js';
import { IconButton } from '../../../components/IconButton/index.js';
import { Text } from '../../../components/Text/index.js';
import { PlusIcon } from '../../../components/Icon/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import type { FavoriteProjectRow } from '../../../../state/sidebar-summary.js';
import { ProjectRow } from '../ProjectRow/index.js';

export interface FavoritesSectionProps {
  readonly rows: readonly FavoriteProjectRow[];
  readonly onOpenProject: (projectId: string) => void;
  readonly onToggleFavorite: (projectId: string, favorite: boolean) => void;
}

export function FavoritesSection(props: FavoritesSectionProps): JSX.Element {
  return (
    <Section
      id="favorites-section"
      title={MESSAGES.sidebarFavoritesHeading}
      action={
        // No `onClick` here on purpose — `renderer/legacy/new-project-dialog-view.ts#wireNewProjectDialog`
        // attaches the real click handler to this exact `id` after mount (unchanged by this task,
        // D-052's own "o que ainda não é reescrito... fica funcionando") — the same passthrough-anchor
        // pattern `#end-day-button` used before V2-T69 made it a real reactive `<Button>`.
        <IconButton id="new-project-button" size="sm" aria-label={MESSAGES.newProjectButton}>
          {/* PO review (defect 2, V2-T75): 24px — fills this button's own 24px (`size="sm"`) box
           * exactly, the identity's own preferred grid (§ 6.4). The real legibility bug this icon
           * exposed wasn't the size or the stroke width (both already correct) — see
           * `Icon.tsx`'s own `sizeStyle` docstring for the `getComputedStyle`-confirmed root
           * cause and fix. */}
          <PlusIcon size={24} />
        </IconButton>
      }
    >
      {props.rows.length === 0 ? (
        <Text as="p" variant="caption" tone="tertiary" className={cx(styles, 'empty')}>
          {MESSAGES.sidebarFavoritesEmpty}
        </Text>
      ) : (
        <ul class={cx(styles, 'list')}>
          {props.rows.map((row) => (
            <ProjectRow
              key={row.projectId}
              projectId={row.projectId}
              name={row.name}
              badge={row.badge}
              sessions={row.sessions}
              activeTab={row.activeTab}
              leading={{ kind: 'favoriteStar', onToggleFavorite: props.onToggleFavorite }}
              onOpenProject={props.onOpenProject}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}
