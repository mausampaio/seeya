// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { ProjectsTable } from '../../../../../../packages/app/src/renderer/features/projects/ProjectsTable/index.js';
import {
  formatSessionLastActivityText,
  type ProjectPanelRow,
} from '../../../../../../packages/app/src/state/projects-panel.js';

afterEach(cleanup);

function project(overrides: Partial<ProjectPanelRow> = {}): ProjectPanelRow {
  return {
    projectId: 'auth-hardening',
    name: 'Auth hardening',
    lockText: 'unlocked',
    lock: { kind: 'unlocked' },
    sessions: [],
    favorite: false,
    repositoryCount: 0,
    lastActivity: null,
    ...overrides,
  };
}

describe('ProjectsTable (V2-T67)', () => {
  it('renders the headers and one row per project', () => {
    const { getByText } = render(
      <ProjectsTable
        rows={[
          project({ projectId: 'a', name: 'Alpha' }),
          project({ projectId: 'b', name: 'Beta' }),
        ]}
        onToggleFavorite={() => {}}
        onRowAction={() => {}}
        isRowActionPending={() => false}
      />,
    );
    expect(getByText('Name')).not.toBeNull();
    expect(getByText('Lock')).not.toBeNull();
    expect(getByText('Alpha')).not.toBeNull();
    expect(getByText('Beta')).not.toBeNull();
  });

  it('unlocked row shows "Unlocked" and an "Open" primary action', () => {
    const onRowAction = vi.fn();
    const row = project({ lock: { kind: 'unlocked' } });
    const { getByText } = render(
      <ProjectsTable
        rows={[row]}
        onToggleFavorite={() => {}}
        onRowAction={onRowAction}
        isRowActionPending={() => false}
      />,
    );
    expect(getByText('Unlocked')).not.toBeNull();
    fireEvent.click(getByText('Open'));
    expect(onRowAction).toHaveBeenCalledWith(row);
  });

  it('a project open in this window shows "Open in this window" and a "Go to tab" action', () => {
    const row = project({ lock: { kind: 'openHere', tabId: 'tab-1' } });
    const { getByText } = render(
      <ProjectsTable
        rows={[row]}
        onToggleFavorite={() => {}}
        onRowAction={() => {}}
        isRowActionPending={() => false}
      />,
    );
    expect(getByText('Open in this window')).not.toBeNull();
    expect(getByText('Go to tab')).not.toBeNull();
  });

  it('a project locked by another session shows "Locked by session <id>" and "Read only…"', () => {
    const row = project({
      lock: { kind: 'lockedByOther', holderDisplaySessionId: 'abcd1234' },
    });
    const { getByText } = render(
      <ProjectsTable
        rows={[row]}
        onToggleFavorite={() => {}}
        onRowAction={() => {}}
        isRowActionPending={() => false}
      />,
    );
    expect(getByText('Locked by session abcd1234')).not.toBeNull();
    expect(getByText('Read only…')).not.toBeNull();
  });

  it('the action button shows loading while pending, and never for a Go to tab row', () => {
    const openRow = project({ projectId: 'open-row', lock: { kind: 'unlocked' } });
    const goToTabRow = project({
      projectId: 'go-to-tab-row',
      lock: { kind: 'openHere', tabId: 't1' },
    });
    const { getByText } = render(
      <ProjectsTable
        rows={[openRow, goToTabRow]}
        onToggleFavorite={() => {}}
        onRowAction={() => {}}
        isRowActionPending={() => true}
      />,
    );
    expect(getByText('Open').closest('button')?.getAttribute('aria-busy')).toBe('true');
    expect(getByText('Go to tab').closest('button')?.getAttribute('aria-busy')).toBeNull();
  });

  it('PO review round 1: no activity shows a dash with a title, never raw "unknown"', () => {
    const row = project({ lastActivity: null });
    const { getByText } = render(
      <ProjectsTable
        rows={[row]}
        onToggleFavorite={() => {}}
        onRowAction={() => {}}
        isRowActionPending={() => false}
      />,
    );
    const dash = getByText('—');
    expect(dash.getAttribute('title')).toBe('No activity recorded for this project yet.');
  });

  it('PO review round 1: a known last activity reuses the shared date/time format', () => {
    const lastActivity = new Date('2026-10-02T00:16:44.000Z');
    const row = project({ lastActivity });
    const expected = formatSessionLastActivityText(lastActivity);
    const { getByText } = render(
      <ProjectsTable
        rows={[row]}
        onToggleFavorite={() => {}}
        onRowAction={() => {}}
        isRowActionPending={() => false}
      />,
    );
    const cell = getByText(expected);
    expect(cell.getAttribute('title')).toBe(expected);
  });

  it('clicking the star calls onToggleFavorite with the flipped value', () => {
    const onToggleFavorite = vi.fn();
    const row = project({ favorite: false, name: 'Auth hardening' });
    const { getByRole } = render(
      <ProjectsTable
        rows={[row]}
        onToggleFavorite={onToggleFavorite}
        onRowAction={() => {}}
        isRowActionPending={() => false}
      />,
    );
    fireEvent.click(getByRole('button', { name: /Star Auth hardening/i }));
    expect(onToggleFavorite).toHaveBeenCalledWith('auth-hardening', true);
  });
});
