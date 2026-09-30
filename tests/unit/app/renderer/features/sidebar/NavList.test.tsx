// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { NavList } from '../../../../../../packages/app/src/renderer/features/sidebar/NavList/index.js';
import { pageTabId } from '../../../../../../packages/app/src/tabs/page-tab.js';

afterEach(cleanup);

describe('NavList (D-052, V2-T75)', () => {
  it('shows the plain project count and the sessions pill', () => {
    const { getByRole, getByText } = render(
      <NavList
        allProjectsCount={12}
        runningSessionsCount={3}
        activeTabId={null}
        onOpenProjects={() => {}}
        onOpenSessions={() => {}}
      />,
    );
    expect(getByRole('button', { name: /All projects/ })).not.toBeNull();
    expect(getByText('12')).not.toBeNull();
    expect(getByText('3 running')).not.toBeNull();
  });

  it('highlights the row whose page tab is active', () => {
    const { getByRole } = render(
      <NavList
        allProjectsCount={0}
        runningSessionsCount={0}
        activeTabId={pageTabId('sessions')}
        onOpenProjects={() => {}}
        onOpenSessions={() => {}}
      />,
    );
    expect(getByRole('button', { name: /All projects/ }).getAttribute('aria-current')).toBe(
      'false',
    );
    expect(getByRole('button', { name: /Sessions/ }).getAttribute('aria-current')).toBe('true');
  });

  it('clicking a row calls the matching handler', () => {
    const onOpenProjects = vi.fn();
    const onOpenSessions = vi.fn();
    const { getByRole } = render(
      <NavList
        allProjectsCount={0}
        runningSessionsCount={0}
        activeTabId={null}
        onOpenProjects={onOpenProjects}
        onOpenSessions={onOpenSessions}
      />,
    );
    fireEvent.click(getByRole('button', { name: /All projects/ }));
    fireEvent.click(getByRole('button', { name: /Sessions/ }));
    expect(onOpenProjects).toHaveBeenCalledTimes(1);
    expect(onOpenSessions).toHaveBeenCalledTimes(1);
  });

  it('renders the ignored-projects legacy anchors with their exact ids', () => {
    const { container } = render(
      <NavList
        allProjectsCount={0}
        runningSessionsCount={0}
        activeTabId={null}
        onOpenProjects={() => {}}
        onOpenSessions={() => {}}
      />,
    );
    expect(container.querySelector('#ignored-projects-heading')).not.toBeNull();
    expect(container.querySelector('#ignored-projects-list')).not.toBeNull();
  });
});
