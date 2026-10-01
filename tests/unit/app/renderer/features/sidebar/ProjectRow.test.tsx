// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { ProjectRow } from '../../../../../../packages/app/src/renderer/features/sidebar/ProjectRow/index.js';
import type { ProjectPanelSessionRow } from '../../../../../../packages/app/src/state/projects-panel.js';

afterEach(cleanup);

const SESSION: ProjectPanelSessionRow = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  displaySessionId: '1111',
  name: 'main session',
  cwd: '/repo',
  state: 'alive',
  stateLabel: 'running',
  lastActivity: null,
  matchedTabId: 'tab-1',
};

describe('ProjectRow (D-052, V2-T75, PO review 2026-10-01 — shared by Favorites and Recent)', () => {
  it('renders a plain folder row with no lock status and no sessions', () => {
    const { getByRole, queryByText } = render(
      <ProjectRow
        projectId="auth-hardening"
        name="Auth hardening"
        badge="none"
        sessions={[]}
        leading={{ kind: 'folder' }}
        onOpenProject={() => {}}
      />,
    );
    expect(getByRole('button', { name: 'Auth hardening' })).not.toBeNull();
    expect(queryByText('open here')).toBeNull();
    expect(queryByText('locked')).toBeNull();
  });

  it('shows "open here" and the indented sessions when the badge is openHere', () => {
    const { getByText } = render(
      <ProjectRow
        projectId="auth-hardening"
        name="Auth hardening"
        badge="openHere"
        sessions={[SESSION]}
        leading={{ kind: 'folder' }}
        onOpenProject={() => {}}
      />,
    );
    expect(getByText('open here')).not.toBeNull();
    expect(getByText(/main session/)).not.toBeNull();
    expect(getByText('1111')).not.toBeNull();
  });

  it('shows "locked" with no sessions when the badge is locked', () => {
    const { getByText, queryByText } = render(
      <ProjectRow
        projectId="auth-hardening"
        name="Auth hardening"
        badge="locked"
        sessions={[]}
        leading={{ kind: 'folder' }}
        onOpenProject={() => {}}
      />,
    );
    expect(getByText('locked')).not.toBeNull();
    expect(queryByText(/main session/)).toBeNull();
  });

  it('clicking the name opens the project', () => {
    const onOpenProject = vi.fn();
    const { getByRole } = render(
      <ProjectRow
        projectId="auth-hardening"
        name="Auth hardening"
        badge="none"
        sessions={[]}
        leading={{ kind: 'folder' }}
        onOpenProject={onOpenProject}
      />,
    );
    fireEvent.click(getByRole('button', { name: 'Auth hardening' }));
    expect(onOpenProject).toHaveBeenCalledWith('auth-hardening');
  });

  it('renders the star and calls onToggleFavorite when leading is favoriteStar', () => {
    const onToggleFavorite = vi.fn();
    const { getByRole } = render(
      <ProjectRow
        projectId="auth-hardening"
        name="Auth hardening"
        badge="none"
        sessions={[]}
        leading={{ kind: 'favoriteStar', onToggleFavorite }}
        onOpenProject={() => {}}
      />,
    );
    fireEvent.click(getByRole('button', { name: /Auth hardening/i, pressed: true }));
    expect(onToggleFavorite).toHaveBeenCalledWith('auth-hardening', false);
  });
});
