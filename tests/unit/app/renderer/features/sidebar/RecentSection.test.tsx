// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { RecentSection } from '../../../../../../packages/app/src/renderer/features/sidebar/RecentSection/index.js';

afterEach(cleanup);

describe('RecentSection (D-052, V2-T75)', () => {
  it('shows the empty state with nothing recent', () => {
    const { getByText } = render(<RecentSection rows={[]} onOpenProject={() => {}} />);
    expect(getByText('Nothing recent yet.')).not.toBeNull();
  });

  it('renders a row per recent project', () => {
    const { getByRole } = render(
      <RecentSection
        rows={[{ projectId: 'auth-hardening', name: 'Auth hardening', lastActivity: new Date() }]}
        onOpenProject={() => {}}
      />,
    );
    expect(getByRole('button', { name: 'Auth hardening' })).not.toBeNull();
  });

  it('clicking a row opens that project', () => {
    const onOpenProject = vi.fn();
    const { getByRole } = render(
      <RecentSection
        rows={[{ projectId: 'auth-hardening', name: 'Auth hardening', lastActivity: new Date() }]}
        onOpenProject={onOpenProject}
      />,
    );
    fireEvent.click(getByRole('button', { name: 'Auth hardening' }));
    expect(onOpenProject).toHaveBeenCalledWith('auth-hardening');
  });
});
