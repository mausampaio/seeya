/**
 * D-052 (V2-T75): the lateral, rewritten as a real component tree (`docs/INTERFACE.md` § 1) —
 * logo, collapse toggle, `TodayCard`, `FavoritesSection`, `RecentSection`, `NavList`,
 * `SidebarFooter`, and its own resize handle. Replaces the old imperative rendering entirely
 * (`renderer/legacy/sidebar-favorites-view.tsx`, `sidebar-collapse-view.ts`, `sidebar-resize-view.ts`
 * — all deleted by this task) and the sidebar-only rules that lived in
 * `renderer/legacy/legacy.css` (also removed by this task). No `getElementById`/`innerHTML`/
 * imperative mounting anywhere in this file or its own subcomponents (D-052's own rule for the
 * lateral) — everything here is props/state driven.
 *
 * `collapsed`/`onToggleCollapse` come from `App.tsx`, which ALSO drives the toolbar's own reopen
 * button with the same state — the button that reopens the lateral necessarily lives outside it.
 *
 * @example
 * <Sidebar collapsed={collapsed} onToggleCollapse={toggle}/>
 */
import type { JSX } from 'preact';
import { useRef } from 'preact/hooks';
import styles from './Sidebar.module.css';
import { cx, mergeClassName } from '../../components/css-class.js';
import { IconButton } from '../../components/IconButton/index.js';
import { ChevronLeftIcon } from '../../components/Icon/index.js';
import { useSidebar, isPageTabActive } from './useSidebar.js';
import { useSidebarResize } from './useSidebarResize.js';
import { TodayCard } from './TodayCard/index.js';
import { FavoritesSection } from './FavoritesSection/index.js';
import { RecentSection } from './RecentSection/index.js';
import { NavList } from './NavList/index.js';
import { SidebarFooter } from './SidebarFooter/index.js';

export interface SidebarProps {
  readonly collapsed: boolean;
  readonly onToggleCollapse: () => void;
}

export function Sidebar(props: SidebarProps): JSX.Element {
  const sidebarRef = useRef<HTMLElement>(null);
  const { width, dragging, handlePointerDown } = useSidebarResize(sidebarRef);
  const data = useSidebar();

  const sidebarClassName = mergeClassName(cx(styles, 'sidebar', props.collapsed && 'collapsed'));
  const handleClassName = mergeClassName(
    cx(styles, 'resizeHandle', dragging && 'resizeHandleDragging'),
  );

  return (
    <>
      <aside
        id="sidebar"
        ref={sidebarRef}
        class={sidebarClassName}
        style={{ '--sidebar-width': `${width}px` }}
      >
        <div class={cx(styles, 'main')}>
          <div class={cx(styles, 'header')}>
            <div class={cx(styles, 'logo')}>
              <img class={cx(styles, 'logoLight')} src="logo/seeya-logo.svg" alt="seeya" />
              <img class={cx(styles, 'logoDark')} src="logo/seeya-logo-on-dark.svg" alt="seeya" />
            </div>
            <IconButton
              id="sidebar-collapse-toggle"
              size="sm"
              aria-label="Collapse sidebar"
              onClick={props.onToggleCollapse}
            >
              {/* PO review (defect 2, V2-T75) — see FavoritesSection.tsx's own "new-project-button"
               * comment for the measurement behind the 20px override. */}
              <ChevronLeftIcon size={24} />
            </IconButton>
          </div>
          <div class={cx(styles, 'content')}>
            <TodayCard
              summary={data.todayCard}
              active={isPageTabActive(data.activeTabId, 'today')}
              onClick={data.openToday}
            />
            <FavoritesSection
              rows={data.favorites}
              onOpenProject={data.openProject}
              onToggleFavorite={data.toggleFavorite}
            />
            <RecentSection rows={data.recent} onOpenProject={data.openProject} />
            <NavList
              allProjectsCount={data.allProjectsCount}
              runningSessionsCount={data.runningSessionsCount}
              activeTabId={data.activeTabId}
              onOpenProjects={data.openProjects}
              onOpenSessions={data.openSessions}
            />
          </div>
          <SidebarFooter />
        </div>
      </aside>
      <div id="sidebar-resize-handle" class={handleClassName} onPointerDown={handlePointerDown} />
    </>
  );
}
