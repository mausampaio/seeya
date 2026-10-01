/**
 * D-052 (V2-T75): the lateral's own Recent section (`docs/INTERFACE.md` § 1 item 4) — a real
 * component now, replacing the imperative rendering inside the deleted
 * `renderer/legacy/sidebar-favorites-view.tsx`.
 *
 * PO review (2026-10-01): a project seen here read as a plain folder+name before, even when it was
 * the very project open in this window (`badge === 'openHere'`) — no highlight, no lock status, no
 * indented sessions, the exact facts Favorites already showed for the same project. Row rendering
 * now goes through the shared `ProjectRow` component (`renderer/features/sidebar/ProjectRow/`),
 * identical to Favorites except the leading icon (a plain folder, never favoritable from here —
 * `leading={{ kind: 'folder' }}`).
 *
 * @example
 * <RecentSection rows={recent} onOpenProject={openProject}/>
 */
import type { JSX } from 'preact';
import styles from './RecentSection.module.css';
import { cx } from '../../../components/css-class.js';
import { Section } from '../../../components/Section/index.js';
import { Text } from '../../../components/Text/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import type { RecentProjectRow } from '../../../../state/sidebar-summary.js';
import { ProjectRow } from '../ProjectRow/index.js';

export interface RecentSectionProps {
  readonly rows: readonly RecentProjectRow[];
  readonly onOpenProject: (projectId: string) => void;
}

export function RecentSection(props: RecentSectionProps): JSX.Element {
  return (
    <Section id="recent-section" title={MESSAGES.sidebarRecentHeading}>
      {props.rows.length === 0 ? (
        <Text as="p" variant="caption" tone="tertiary" className={cx(styles, 'empty')}>
          {MESSAGES.sidebarRecentEmpty}
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
              leading={{ kind: 'folder' }}
              onOpenProject={props.onOpenProject}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}
