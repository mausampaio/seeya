// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { ProjectsFilters } from '../../../../../../packages/app/src/renderer/features/projects/ProjectsFilters/index.js';

afterEach(cleanup);

describe('ProjectsFilters (V2-T67)', () => {
  it('shows the three filter options, with the current one pressed', () => {
    const { getByRole } = render(
      <ProjectsFilters
        query=""
        onQueryChange={() => {}}
        filter="running"
        onFilterChange={() => {}}
      />,
    );
    expect(getByRole('radio', { name: 'All' })).not.toBeNull();
    expect(
      getByRole('radio', { name: 'With a running session' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(getByRole('radio', { name: 'Locked' })).not.toBeNull();
  });

  it('typing in the search field calls onQueryChange', () => {
    const onQueryChange = vi.fn();
    const { getByLabelText } = render(
      <ProjectsFilters
        query=""
        onQueryChange={onQueryChange}
        filter="all"
        onFilterChange={() => {}}
      />,
    );
    fireEvent.input(getByLabelText('Search projects'), { target: { value: 'auth' } });
    expect(onQueryChange).toHaveBeenCalledWith('auth');
  });

  it('clicking a filter option calls onFilterChange with its value', () => {
    const onFilterChange = vi.fn();
    const { getByRole } = render(
      <ProjectsFilters
        query=""
        onQueryChange={() => {}}
        filter="all"
        onFilterChange={onFilterChange}
      />,
    );
    fireEvent.click(getByRole('radio', { name: 'Locked' }));
    expect(onFilterChange).toHaveBeenCalledWith('locked');
  });
});
