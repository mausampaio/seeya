/**
 * D-052 (V2-T75): "All projects"/"Sessions" (`docs/INTERFACE.md` § 1 items 5/6) — real `NavItem`s
 * now, replacing the imperative rendering inside the deleted `renderer/legacy/sidebar-favorites-view.tsx`.
 * `NavItem.module.css`'s own `gap` between rows is what fixes the V2-T63 aceite's own "All
 * projects/Sessions colados um no outro".
 *
 * The "Ignored projects" heading/list (`docs/INTERFACE.md` § 1 item 5) stay a LEGACY-owned anchor
 * here — `renderer/legacy/other-sessions-and-ignored-view.ts` still fills them on every push
 * (split out of `renderer/legacy/projects-list-view.tsx` by V2-T67, unchanged behaviour — that
 * region's own redesign is a future task, not this one). No
 * `hidden` prop is bound from here on purpose: legacy code toggles `.hidden` on these two elements
 * directly, on every push, not just once — binding a REACTIVE `hidden` from this component would
 * fight that on the next time `<NavList/>` itself re-renders for an unrelated reason (a running-
 * count change, say).
 *
 * @example
 * <NavList allProjectsCount={12} runningSessionsCount={3} activeTabId={activeTabId} onOpenProjects={..} onOpenSessions={..}/>
 */
import type { JSX } from 'preact';
import styles from './NavList.module.css';
import { cx } from '../../../components/css-class.js';
import { NavItem } from '../../../components/NavItem/index.js';
import { Chip } from '../../../components/Chip/index.js';
import { ChatBalloonIcon, FolderIcon } from '../../../components/Icon/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import { isPageTabActive } from '../useSidebar.js';

export interface NavListProps {
  readonly allProjectsCount: number;
  readonly runningSessionsCount: number;
  readonly activeTabId: string | null;
  readonly onOpenProjects: () => void;
  readonly onOpenSessions: () => void;
}

export function NavList(props: NavListProps): JSX.Element {
  return (
    <div class={cx(styles, 'list')}>
      <NavItem
        id="all-projects-link"
        icon={<FolderIcon />}
        label={MESSAGES.sidebarAllProjectsLabel}
        trailing={props.allProjectsCount}
        active={isPageTabActive(props.activeTabId, 'projects')}
        onClick={props.onOpenProjects}
      />
      <h2 id="ignored-projects-heading" class={cx(styles, 'ignoredHeading')}>
        Ignored projects
      </h2>
      <ul id="ignored-projects-list" class={cx(styles, 'ignoredList')} />
      <NavItem
        id="sessions-link"
        icon={<ChatBalloonIcon />}
        label={MESSAGES.sidebarSessionsLabel}
        trailing={
          <Chip tone={props.runningSessionsCount > 0 ? 'success' : 'neutral'} size="sm">
            {MESSAGES.sidebarSessionsCount(props.runningSessionsCount)}
          </Chip>
        }
        active={isPageTabActive(props.activeTabId, 'sessions')}
        onClick={props.onOpenSessions}
      />
    </div>
  );
}
