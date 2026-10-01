/**
 * D-052 (V2-T75): the lateral's own Recent section (`docs/INTERFACE.md` § 1 item 4) — a real
 * component now, replacing the imperative rendering inside the deleted
 * `renderer/legacy/sidebar-favorites-view.tsx`. A folder icon in the same slot Favorites' own star
 * occupies, so the two lists' rows line up (V2-T63 aceite correction).
 *
 * @example
 * <RecentSection rows={recent} onOpenProject={openProject}/>
 */
import type { JSX } from 'preact';
import styles from './RecentSection.module.css';
import { cx } from '../../../components/css-class.js';
import { Section } from '../../../components/Section/index.js';
import { FolderIcon } from '../../../components/Icon/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import type { RecentProjectRow } from '../../../../state/sidebar-summary.js';

export interface RecentSectionProps {
  readonly rows: readonly RecentProjectRow[];
  readonly onOpenProject: (projectId: string) => void;
}

export function RecentSection(props: RecentSectionProps): JSX.Element {
  return (
    <Section id="recent-section" title={MESSAGES.sidebarRecentHeading}>
      {props.rows.length === 0 ? (
        <p class={cx(styles, 'empty')}>{MESSAGES.sidebarRecentEmpty}</p>
      ) : (
        <ul class={cx(styles, 'list')}>
          {props.rows.map((row) => (
            <li key={row.projectId} class={cx(styles, 'row')}>
              <span class={cx(styles, 'icon')} aria-hidden="true">
                <FolderIcon />
              </span>
              <button
                type="button"
                class={cx(styles, 'name')}
                onClick={() => props.onOpenProject(row.projectId)}
              >
                {row.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
