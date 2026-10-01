// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { RecentSection } from '../../../../../../packages/app/src/renderer/features/sidebar/RecentSection/index.js';
import type { RecentProjectRow } from '../../../../../../packages/app/src/state/sidebar-summary.js';

afterEach(cleanup);

const PLAIN_ROW: RecentProjectRow = {
  projectId: 'auth-hardening',
  name: 'Auth hardening',
  lastActivity: new Date('2026-09-30T12:00:00.000Z'),
  badge: 'none',
  sessions: [],
  activeTab: false,
};

describe('RecentSection (D-052, V2-T75)', () => {
  it('shows the empty state with nothing recent', () => {
    const { getByText } = render(<RecentSection rows={[]} onOpenProject={() => {}} />);
    expect(getByText('Nothing recent yet.')).not.toBeNull();
  });

  it('renders a row per recent project', () => {
    const { getByRole } = render(<RecentSection rows={[PLAIN_ROW]} onOpenProject={() => {}} />);
    expect(getByRole('button', { name: 'Auth hardening' })).not.toBeNull();
  });

  it('clicking a row opens that project', () => {
    const onOpenProject = vi.fn();
    const { getByRole } = render(
      <RecentSection rows={[PLAIN_ROW]} onOpenProject={onOpenProject} />,
    );
    fireEvent.click(getByRole('button', { name: 'Auth hardening' }));
    expect(onOpenProject).toHaveBeenCalledWith('auth-hardening');
  });

  // PO review (2026-10-01): Recent now shows the same active-highlight/lock/session facts
  // Favorites already did, via the shared `ProjectRow` component.
  it('shows the lock status and indented sessions when the project is open in this window', () => {
    const openHereRow: RecentProjectRow = {
      ...PLAIN_ROW,
      badge: 'openHere',
      sessions: [
        {
          sessionId: '11111111-1111-4111-8111-111111111111',
          displaySessionId: '1111',
          name: 'main session',
          cwd: '/repo',
          state: 'alive',
          stateLabel: 'running',
          lastActivity: null,
          matchedTabId: 'tab-1',
        },
      ],
    };
    const { getByText } = render(<RecentSection rows={[openHereRow]} onOpenProject={() => {}} />);
    expect(getByText('open here')).not.toBeNull();
    expect(getByText(/main session/)).not.toBeNull();
  });
});
