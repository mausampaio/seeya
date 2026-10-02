/**
 * V2-T67 (`docs/INTERFACE.md` § 4): "Busca por nome; filtro `All` · `With a running session` ·
 * `Locked`" — the search `TextField` and the `SegmentedControl` filter together, since they always
 * sit on the same row and share no state of their own (both are controlled by `useProjects.ts`).
 *
 * @example
 * <ProjectsFilters query={query} onQueryChange={setQuery} filter={filter} onFilterChange={setFilter} />
 */
import type { JSX } from 'preact';
import styles from './ProjectsFilters.module.css';
import { cx } from '../../../components/css-class.js';
import { TextField } from '../../../components/TextField/index.js';
import { SegmentedControl } from '../../../components/SegmentedControl/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import type { ProjectsTableFilter } from '../../../../state/projects-table.js';

const FILTER_OPTIONS: readonly { readonly value: ProjectsTableFilter; readonly label: string }[] = [
  { value: 'all', label: MESSAGES.projectsFilterAll },
  { value: 'running', label: MESSAGES.projectsFilterRunning },
  { value: 'locked', label: MESSAGES.projectsFilterLocked },
];

export interface ProjectsFiltersProps {
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly filter: ProjectsTableFilter;
  readonly onFilterChange: (filter: ProjectsTableFilter) => void;
}

export function ProjectsFilters(props: ProjectsFiltersProps): JSX.Element {
  return (
    <div class={cx(styles, 'filters')}>
      <TextField
        id="projects-search-input"
        label={MESSAGES.projectsSearchLabel}
        placeholder={MESSAGES.projectsSearchPlaceholder}
        value={props.query}
        onInput={props.onQueryChange}
        className={cx(styles, 'search')}
      />
      <SegmentedControl
        ariaLabel={MESSAGES.projectsFilterGroupLabel}
        value={props.filter}
        options={FILTER_OPTIONS}
        onChange={(value) => props.onFilterChange(value as ProjectsTableFilter)}
      />
    </div>
  );
}
