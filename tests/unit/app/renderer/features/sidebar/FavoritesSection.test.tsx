// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { FavoritesSection } from '../../../../../../packages/app/src/renderer/features/sidebar/FavoritesSection/index.js';
import type { FavoriteProjectRow } from '../../../../../../packages/app/src/state/sidebar-summary.js';

afterEach(cleanup);

const OPEN_HERE_ROW: FavoriteProjectRow = {
  projectId: 'payments-webhooks',
  name: 'Payments webhooks',
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

describe('FavoritesSection (D-052, V2-T75)', () => {
  it('shows the empty state with no favorites', () => {
    const { getByText } = render(
      <FavoritesSection rows={[]} onOpenProject={() => {}} onToggleFavorite={() => {}} />,
    );
    expect(getByText('No favorites yet — star a project to pin it here.')).not.toBeNull();
  });

  it('renders a row with its name, badge and indented sessions when open here', () => {
    const { getByText, getByRole } = render(
      <FavoritesSection
        rows={[OPEN_HERE_ROW]}
        onOpenProject={() => {}}
        onToggleFavorite={() => {}}
      />,
    );
    expect(getByRole('button', { name: 'Payments webhooks' })).not.toBeNull();
    expect(getByText('open here')).not.toBeNull();
    expect(getByText(/main session/)).not.toBeNull();
  });

  it('clicking the name opens the project', () => {
    const onOpenProject = vi.fn();
    const { getByRole } = render(
      <FavoritesSection
        rows={[OPEN_HERE_ROW]}
        onOpenProject={onOpenProject}
        onToggleFavorite={() => {}}
      />,
    );
    fireEvent.click(getByRole('button', { name: 'Payments webhooks' }));
    expect(onOpenProject).toHaveBeenCalledWith('payments-webhooks');
  });

  it('clicking the star unfavorites the project', () => {
    const onToggleFavorite = vi.fn();
    const { getByRole } = render(
      <FavoritesSection
        rows={[OPEN_HERE_ROW]}
        onOpenProject={() => {}}
        onToggleFavorite={onToggleFavorite}
      />,
    );
    fireEvent.click(getByRole('button', { name: /Unstar Payments webhooks|star/i }));
    expect(onToggleFavorite).toHaveBeenCalledWith('payments-webhooks', false);
  });

  it('renders the New project anchor with the exact legacy id, unbound', () => {
    const { container } = render(
      <FavoritesSection rows={[]} onOpenProject={() => {}} onToggleFavorite={() => {}} />,
    );
    const button = container.querySelector('#new-project-button');
    expect(button).not.toBeNull();
  });
});
