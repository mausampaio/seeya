/**
 * D-052 (V2-T67, `docs/INTERFACE.md` § 4): the Projects tab — replaces
 * `renderer/legacy/projects-list-view.tsx`'s own imperative rendering of `#projects-list` entirely
 * (apagado by this task). Mounted once, as a static child of `#page-projects`
 * (`renderer/features/tabs/TabStrip.tsx`), the same "mounts once for the life of the window"
 * lifetime `<Today/>`/`<Sidebar/>` already have — `TabStrip.tsx` never conditionally mounts/
 * unmounts a page pane, only toggles its `hidden` attribute.
 *
 * **Why `<NewProjectDialog/>` is NOT rendered here.** A `<dialog>` inside an ancestor with
 * `display: none` (`.page-pane[hidden]`, the exact state THIS component's own `#page-projects`
 * parent is in whenever another tab is active) never shows, even via `.showModal()` — confirmed
 * against the HTML spec before writing this. `NewProjectDialog` is mounted once, directly by
 * `App.tsx` (same level as `DialogsShell`/`SettingsDialog`), reachable from BOTH the sidebar's own
 * `+` and this tab's own "New project" button through `new-project-dialog-bridge.ts`.
 *
 * Three top-level states, decided here rather than inside `ProjectsTable` (D-041 — the table
 * itself has no opinion about WHY it has no rows to show): no project exists at all
 * (`EmptyState` with its own `New project` action — `docs/INTERFACE.md` § 4's own "lista vazia");
 * a search/filter that matches nothing (`EmptyState`, no action — nothing to invent a shortcut
 * for); otherwise, the table. There is no dedicated "erro de leitura" state: `getProjectsPanel`'s
 * own IPC call has no documented failure shape today (`ProjectsPanelData` is never a union with an
 * error case) — D-025, this component never invents a branch the data can't actually produce.
 *
 * @example
 * <Projects/>
 */
import type { JSX } from 'preact';
import styles from './Projects.module.css';
import { cx } from '../../components/css-class.js';
import { EmptyState } from '../../components/EmptyState/index.js';
import { Button } from '../../components/Button/index.js';
import { MESSAGES } from '../../../text/messages.js';
import { ProjectsHeader } from './ProjectsHeader/index.js';
import { ProjectsFilters } from './ProjectsFilters/index.js';
import { ProjectsTable } from './ProjectsTable/index.js';
import { IgnoredProjectsSection } from './IgnoredProjectsSection/index.js';
import { ProjectResumeNotice } from './ProjectResumeNotice/index.js';
import { useProjects } from './useProjects.js';

export function Projects(): JSX.Element {
  const controls = useProjects();
  const { panel } = controls;

  return (
    <div class={cx(styles, 'projects')}>
      <ProjectsHeader count={panel.projects.length} onNewProject={controls.openNewProject} />
      {panel.projects.length > 0 && (
        <ProjectsFilters
          query={controls.query}
          onQueryChange={controls.setQuery}
          filter={controls.filter}
          onFilterChange={controls.setFilter}
        />
      )}
      {controls.resumeResult !== null && (
        <ProjectResumeNotice
          result={controls.resumeResult}
          onDismiss={controls.dismissResumeResult}
        />
      )}
      {panel.projects.length === 0 ? (
        <EmptyState
          title={MESSAGES.projectsEmptyTitle}
          description={MESSAGES.projectsEmptyDescription}
          action={<Button onClick={controls.openNewProject}>{MESSAGES.newProjectButton}</Button>}
        />
      ) : controls.rows.length === 0 ? (
        <EmptyState
          title={MESSAGES.projectsNoMatchTitle}
          description={MESSAGES.projectsNoMatchDescription}
        />
      ) : (
        <ProjectsTable
          rows={controls.rows}
          onToggleFavorite={controls.onToggleFavorite}
          onRowAction={controls.onRowAction}
          isRowActionPending={controls.isRowActionPending}
          expandedProjectIds={controls.expandedProjectIds}
          onToggleExpanded={controls.onToggleExpanded}
          sessionsPanel={controls.sessionsPanel}
          onManage={controls.onManage}
        />
      )}
      <IgnoredProjectsSection rows={panel.ignoredProjects} />
    </div>
  );
}
