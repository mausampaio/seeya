// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { SessionsFilters } from '../../../../../../packages/app/src/renderer/features/sessions/SessionsFilters/index.js';
import { DEFAULT_SESSIONS_TABLE_FILTERS } from '../../../../../../packages/app/src/state/sessions-table.js';

afterEach(cleanup);

const BASE_PROPS = {
  query: '',
  onQueryChange: () => {},
  filters: DEFAULT_SESSIONS_TABLE_FILTERS,
  onStateFilterChange: () => {},
  onProjectFilterChange: () => {},
  onDirectoryFilterChange: () => {},
  projectOptions: [],
  directoryOptions: [],
  homeDir: '',
  platformHint: 'posix' as const,
};

/** The options of the select whose trigger button is `trigger` (V2-T81: no native `<select>` any
 * more — the trigger's `aria-controls` names the listbox, which holds the `role="option"` items). */
function optionsOf(trigger: HTMLElement): HTMLElement[] {
  const list = document.getElementById(trigger.getAttribute('aria-controls') ?? '');
  return Array.from(list?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
}

describe('SessionsFilters (V2-T68)', () => {
  it('renders the search field and the three state options', () => {
    const { getByLabelText, getByText } = render(<SessionsFilters {...BASE_PROPS} />);
    expect(getByLabelText('Search by name or id')).not.toBeNull();
    expect(getByText('All')).not.toBeNull();
    expect(getByText('Running')).not.toBeNull();
    expect(getByText('Not running')).not.toBeNull();
  });

  it('typing in the search field calls onQueryChange', () => {
    const onQueryChange = vi.fn();
    const { getByLabelText } = render(
      <SessionsFilters {...BASE_PROPS} onQueryChange={onQueryChange} />,
    );
    fireEvent.input(getByLabelText('Search by name or id'), { target: { value: 'auth' } });
    expect(onQueryChange).toHaveBeenCalledWith('auth');
  });

  it('clicking a state option calls onStateFilterChange', () => {
    const onStateFilterChange = vi.fn();
    const { getByText } = render(
      <SessionsFilters {...BASE_PROPS} onStateFilterChange={onStateFilterChange} />,
    );
    fireEvent.click(getByText('Running'));
    expect(onStateFilterChange).toHaveBeenCalledWith('running');
  });

  it('the project select offers "Any project", "No project", and each real project', () => {
    const { getByLabelText } = render(
      <SessionsFilters
        {...BASE_PROPS}
        projectOptions={[{ value: 'auth-hardening', label: 'Auth hardening' }]}
      />,
    );
    const labels = optionsOf(getByLabelText('Project')).map((option) => option.textContent);
    expect(labels).toEqual(['Any project', 'No project', 'Auth hardening']);
  });

  it('choosing a project calls onProjectFilterChange with its id', () => {
    const onProjectFilterChange = vi.fn();
    const { getByLabelText } = render(
      <SessionsFilters
        {...BASE_PROPS}
        projectOptions={[{ value: 'auth-hardening', label: 'Auth hardening' }]}
        onProjectFilterChange={onProjectFilterChange}
      />,
    );
    const trigger = getByLabelText('Project');
    fireEvent.click(trigger);
    fireEvent.click(
      optionsOf(trigger).find((option) => option.dataset.value === 'auth-hardening') as HTMLElement,
    );
    expect(onProjectFilterChange).toHaveBeenCalledWith('auth-hardening');
  });

  it('the directory select shows each directory by its display path, with the full path as a title', () => {
    const { getByLabelText } = render(
      <SessionsFilters
        {...BASE_PROPS}
        directoryOptions={[{ value: 'key', dir: '/repo/payments' }]}
        homeDir=""
        platformHint="posix"
      />,
    );
    const option = optionsOf(getByLabelText('Directory')).find(
      (entry) => entry.dataset.value === 'key',
    );
    expect(option?.textContent).toContain('/repo/payments');
    expect(option?.title).toBe('/repo/payments');
  });
});
