/**
 * V2-T68 (`docs/INTERFACE.md` § 5): "Busca por nome ou id...; filtros de estado (`All` · `Running`
 * · `Not running`), projeto (`Any project`, `No project`, cada projeto) e diretório." Four
 * controls on one row, same shape `ProjectsFilters.tsx` already establishes for a search field
 * plus a `SegmentedControl` — this one adds two `Select`s for project/directory.
 *
 * @example
 * <SessionsFilters query={query} onQueryChange={setQuery} filters={filters}
 *   onStateFilterChange={setStateFilter} onProjectFilterChange={setProjectFilter}
 *   onDirectoryFilterChange={setDirectoryFilter} projectOptions={projectOptions}
 *   directoryOptions={directoryOptions} homeDir={homeDir} platformHint="posix" />
 */
import type { JSX } from 'preact';
import type { PathPlatformHint } from '@seeya-ai/engine/core/cwd-normalization.js';
import { formatDirectoryPathForDisplay } from '../../../../sidebar/directory-label.js';
import styles from './SessionsFilters.module.css';
import { cx } from '../../../components/css-class.js';
import { TextField } from '../../../components/TextField/index.js';
import { SegmentedControl } from '../../../components/SegmentedControl/index.js';
import { Select } from '../../../components/Select/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import type {
  SessionsDirectoryFilterOption,
  SessionsProjectFilterOption,
  SessionsStateFilter,
  SessionsTableFilters,
} from '../../../../state/sessions-table.js';

// `id` on each state option — this tab's own verification instrumentation (`main/main.ts`)
// targets these, same precedent `ProjectsFilters.tsx`'s own `FILTER_OPTIONS` sets.
const STATE_FILTER_OPTIONS: readonly { value: SessionsStateFilter; id: string; label: string }[] = [
  { value: 'all', id: 'sessions-filter-state-all', label: MESSAGES.sessionsFilterStateAll },
  {
    value: 'running',
    id: 'sessions-filter-state-running',
    label: MESSAGES.sessionsFilterStateRunning,
  },
  {
    value: 'notRunning',
    id: 'sessions-filter-state-not-running',
    label: MESSAGES.sessionsFilterStateNotRunning,
  },
];

export interface SessionsFiltersProps {
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly filters: SessionsTableFilters;
  readonly onStateFilterChange: (state: SessionsStateFilter) => void;
  readonly onProjectFilterChange: (project: string) => void;
  readonly onDirectoryFilterChange: (directory: string) => void;
  readonly projectOptions: readonly SessionsProjectFilterOption[];
  readonly directoryOptions: readonly SessionsDirectoryFilterOption[];
  readonly homeDir: string;
  readonly platformHint: PathPlatformHint;
}

export function SessionsFilters(props: SessionsFiltersProps): JSX.Element {
  const projectSelectOptions = [
    { value: 'any', label: MESSAGES.sessionsFilterProjectAny },
    { value: 'none', label: MESSAGES.sessionsFilterProjectNone },
    ...props.projectOptions,
  ];
  const directorySelectOptions = [
    { value: 'any', label: MESSAGES.sessionsFilterDirectoryAny },
    ...props.directoryOptions.map((option) => ({
      value: option.value,
      label: formatDirectoryPathForDisplay(option.dir, props.homeDir, props.platformHint),
      title: option.dir,
    })),
  ];
  return (
    <div class={cx(styles, 'filters')}>
      <TextField
        id="sessions-search-input"
        label={MESSAGES.sessionsSearchLabel}
        placeholder={MESSAGES.sessionsSearchPlaceholder}
        value={props.query}
        onInput={props.onQueryChange}
        className={cx(styles, 'search')}
      />
      <SegmentedControl
        ariaLabel={MESSAGES.sessionsFilterStateGroupLabel}
        value={props.filters.state}
        options={STATE_FILTER_OPTIONS}
        onChange={(value) => props.onStateFilterChange(value as SessionsStateFilter)}
      />
      <Select
        id="sessions-filter-project"
        label={MESSAGES.sessionsFilterProjectLabel}
        value={props.filters.project}
        options={projectSelectOptions}
        onChange={props.onProjectFilterChange}
      />
      <Select
        id="sessions-filter-directory"
        label={MESSAGES.sessionsFilterDirectoryLabel}
        value={props.filters.directory}
        options={directorySelectOptions}
        onChange={props.onDirectoryFilterChange}
      />
    </div>
  );
}
