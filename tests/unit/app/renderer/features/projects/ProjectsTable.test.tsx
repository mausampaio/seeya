// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, type RenderResult } from '@testing-library/preact';
import { ProjectsTable } from '../../../../../../packages/app/src/renderer/features/projects/ProjectsTable/index.js';
import {
  formatSessionLastActivityText,
  type ProjectPanelRow,
  type ProjectPanelSessionRow,
} from '../../../../../../packages/app/src/state/projects-panel.js';

afterEach(cleanup);

function project(overrides: Partial<ProjectPanelRow> = {}): ProjectPanelRow {
  return {
    projectId: 'auth-hardening',
    name: 'Auth hardening',
    lockText: 'unlocked',
    lock: { kind: 'unlocked' },
    lifecycle: { kind: 'active' },
    sessions: [],
    favorite: false,
    repositoryCount: 0,
    lastActivity: null,
    ...overrides,
  };
}

/** Every pre-V2-T77 test renders a table with nothing expanded. */
const EXPANSION_PROPS = {
  expandedProjectIds: new Set<string>(),
  onToggleExpanded: () => {},
  onManage: () => {},
  sessionsPanel: {
    isResumePending: () => false,
    onResume: () => {},
    onGoToTab: () => {},
    onShowAll: () => {},
  },
};

function session(overrides: Partial<ProjectPanelSessionRow> = {}): ProjectPanelSessionRow {
  return {
    sessionId: '11111111-1111-4111-8111-111111111111',
    displaySessionId: '11111111',
    name: 'auth-hardening',
    cwd: '/ws/auth-hardening',
    state: 'ended',
    stateLabel: 'ended',
    lastActivity: new Date('2026-10-01T10:00:00.000Z'),
    matchedTabId: null,
    ...overrides,
  };
}

describe('ProjectsTable expanded sessions (V2-T77, docs/INTERFACE.md § 5a)', () => {
  const sessionIds = [1, 2, 3, 4, 5, 6, 7].map(
    (n) => `${n}`.repeat(8) + '-1111-4111-8111-111111111111',
  );

  function renderExpanded(
    sessions: readonly ProjectPanelSessionRow[],
    handlers: Partial<typeof EXPANSION_PROPS.sessionsPanel> = {},
  ): RenderResult {
    return render(
      <ProjectsTable
        rows={[project({ sessions })]}
        onToggleFavorite={() => {}}
        onRowAction={() => {}}
        isRowActionPending={() => false}
        expandedProjectIds={new Set(['auth-hardening'])}
        onManage={() => {}}
        onToggleExpanded={() => {}}
        sessionsPanel={{ ...EXPANSION_PROPS.sessionsPanel, ...handlers }}
      />,
    );
  }

  it('the expand button names its state and toggles the row', () => {
    const onToggleExpanded = vi.fn();
    const { getByRole } = render(
      <ProjectsTable
        {...EXPANSION_PROPS}
        rows={[project()]}
        onToggleFavorite={() => {}}
        onRowAction={() => {}}
        isRowActionPending={() => false}
        onToggleExpanded={onToggleExpanded}
      />,
    );
    const button = getByRole('button', { name: 'Show sessions of Auth hardening' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(button);
    expect(onToggleExpanded).toHaveBeenCalledWith('auth-hardening');
  });

  it('a collapsed row renders no sessions at all', () => {
    const { queryByText } = render(
      <ProjectsTable
        {...EXPANSION_PROPS}
        rows={[project({ sessions: [session()] })]}
        onToggleFavorite={() => {}}
        onRowAction={() => {}}
        isRowActionPending={() => false}
      />,
    );
    expect(queryByText('11111111')).toBeNull();
  });

  it('an expanded row lists id, state and last activity, with Resume on one with no process', () => {
    const onResume = vi.fn();
    const { getByText, getByRole } = renderExpanded([session()], { onResume });
    expect(getByText('11111111')).not.toBeNull();
    expect(getByText('ended')).not.toBeNull();
    fireEvent.click(getByText('Resume'));
    expect(onResume).toHaveBeenCalledWith('auth-hardening', '11111111-1111-4111-8111-111111111111');
    expect(getByRole('button', { name: 'Hide sessions of Auth hardening' })).not.toBeNull();
  });

  it('the session open in this window offers Go to tab, a running one elsewhere offers nothing', () => {
    const onGoToTab = vi.fn();
    const { getByText, queryAllByText } = renderExpanded(
      [
        session({
          sessionId: 'aaaaaaaa-1111',
          displaySessionId: 'aaaaaaaa',
          matchedTabId: 'tab-9',
          state: 'alive',
        }),
        session({ sessionId: 'bbbbbbbb-1111', displaySessionId: 'bbbbbbbb', state: 'alive' }),
      ],
      { onGoToTab },
    );
    fireEvent.click(getByText('Go to tab'));
    expect(onGoToTab).toHaveBeenCalledWith('tab-9');
    expect(queryAllByText('Resume')).toHaveLength(0);
  });

  it('shows at most five sessions, most recent first, and a link to the rest in Sessions', () => {
    const onShowAll = vi.fn();
    const many = sessionIds.map((sessionId, index) =>
      session({
        sessionId,
        displaySessionId: sessionId.slice(0, 8),
        lastActivity: new Date(Date.UTC(2026, 9, 1, index)),
      }),
    );
    const { queryByText, getByText } = renderExpanded(many, { onShowAll });
    expect(queryByText('11111111')).toBeNull();
    expect(queryByText('22222222')).toBeNull();
    expect(getByText('77777777')).not.toBeNull();
    fireEvent.click(getByText('Show all 7 in Sessions'));
    expect(onShowAll).toHaveBeenCalledWith('auth-hardening');
  });

  it('a project with no sessions says so instead of rendering an empty list', () => {
    const { getByText } = renderExpanded([]);
    expect(getByText('No sessions yet. Open the project to start one.')).not.toBeNull();
  });

  it('Resume shows loading for the pending session', () => {
    const { container } = render(
      <ProjectsTable
        rows={[project({ sessions: [session()] })]}
        onToggleFavorite={() => {}}
        onRowAction={() => {}}
        isRowActionPending={() => false}
        expandedProjectIds={new Set(['auth-hardening'])}
        onManage={() => {}}
        onToggleExpanded={() => {}}
        sessionsPanel={{ ...EXPANSION_PROPS.sessionsPanel, isResumePending: () => true }}
      />,
    );
    expect(
      container.querySelector('[data-resume-session-id] button[aria-busy="true"]'),
    ).not.toBeNull();
  });
});

describe('ProjectsTable (V2-T67)', () => {
  it('renders the headers and one row per project', () => {
    const { getByText } = render(
      <ProjectsTable
        {...EXPANSION_PROPS}
        rows={[
          project({ projectId: 'a', name: 'Alpha' }),
          project({ projectId: 'b', name: 'Beta' }),
        ]}
        onToggleFavorite={() => {}}
        onRowAction={() => {}}
        isRowActionPending={() => false}
        {...EXPANSION_PROPS}
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
        {...EXPANSION_PROPS}
        rows={[row]}
        onToggleFavorite={() => {}}
        onRowAction={onRowAction}
        isRowActionPending={() => false}
        {...EXPANSION_PROPS}
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
        {...EXPANSION_PROPS}
        rows={[row]}
        onToggleFavorite={() => {}}
        onRowAction={() => {}}
        isRowActionPending={() => false}
        {...EXPANSION_PROPS}
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
        {...EXPANSION_PROPS}
        rows={[row]}
        onToggleFavorite={() => {}}
        onRowAction={() => {}}
        isRowActionPending={() => false}
        {...EXPANSION_PROPS}
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
        {...EXPANSION_PROPS}
        rows={[openRow, goToTabRow]}
        onToggleFavorite={() => {}}
        onRowAction={() => {}}
        isRowActionPending={() => true}
        onManage={() => {}}
      />,
    );
    expect(getByText('Open').closest('button')?.getAttribute('aria-busy')).toBe('true');
    expect(getByText('Go to tab').closest('button')?.getAttribute('aria-busy')).toBeNull();
  });

  it('PO review round 1: no activity shows a dash with a title, never raw "unknown"', () => {
    const row = project({ lastActivity: null });
    const { getByText } = render(
      <ProjectsTable
        {...EXPANSION_PROPS}
        rows={[row]}
        onToggleFavorite={() => {}}
        onRowAction={() => {}}
        isRowActionPending={() => false}
        {...EXPANSION_PROPS}
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
        {...EXPANSION_PROPS}
        rows={[row]}
        onToggleFavorite={() => {}}
        onRowAction={() => {}}
        isRowActionPending={() => false}
        {...EXPANSION_PROPS}
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
        {...EXPANSION_PROPS}
        rows={[row]}
        onToggleFavorite={onToggleFavorite}
        onRowAction={() => {}}
        isRowActionPending={() => false}
        {...EXPANSION_PROPS}
      />,
    );
    fireEvent.click(getByRole('button', { name: /Star Auth hardening/i }));
    expect(onToggleFavorite).toHaveBeenCalledWith('auth-hardening', true);
  });

  // V2-T83 (`docs/INTERFACE.md` § 4a): a separate icon-only button opens "Project details"; the
  // row's own main action is untouched.
  it('has a "Manage project" icon button that calls onManage and leaves the row action alone', () => {
    const onManage = vi.fn();
    const onRowAction = vi.fn();
    const row = project({ name: 'Auth hardening' });
    const { getByRole } = render(
      <ProjectsTable
        rows={[row]}
        onToggleFavorite={() => {}}
        onRowAction={onRowAction}
        isRowActionPending={() => false}
        {...EXPANSION_PROPS}
        onManage={onManage}
      />,
    );
    const button = getByRole('button', { name: 'Manage project Auth hardening' });
    expect(button.getAttribute('title')).toBe('Manage project Auth hardening');
    fireEvent.click(button);
    expect(onManage).toHaveBeenCalledWith(row);
    expect(onRowAction).not.toHaveBeenCalled();
  });

  it('offers "Manage project" on a locked row too — reading is never blocked', () => {
    const row = project({ lock: { kind: 'lockedByOther', holderDisplaySessionId: 'abcd1234' } });
    const { getByRole } = render(
      <ProjectsTable
        rows={[row]}
        onToggleFavorite={() => {}}
        onRowAction={() => {}}
        isRowActionPending={() => false}
        {...EXPANSION_PROPS}
      />,
    );
    const button = getByRole('button', { name: /Manage project/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });
});

describe('ProjectsTable archived view (V2-T84, docs/INTERFACE.md § 4b)', () => {
  const ARCHIVED = {
    kind: 'archived',
    archivedAt: new Date('2026-10-02T10:00:00.000Z'),
    note: 'Finished — shipped',
  } as const;

  function renderArchived(
    overrides: Partial<ProjectPanelRow> = {},
    handlers: { onRowAction?: (row: ProjectPanelRow) => void } = {},
  ): RenderResult {
    return render(
      <ProjectsTable
        {...EXPANSION_PROPS}
        rows={[
          project({ projectId: 'old-thing', name: 'Old thing', lifecycle: ARCHIVED, ...overrides }),
        ]}
        onToggleFavorite={() => {}}
        onRowAction={handlers.onRowAction ?? (() => {})}
        isRowActionPending={() => false}
        archivedView
      />,
    );
  }

  it('heads the lock column "Archived" and shows the archive date and the note under the name', () => {
    const { getByText, queryByText } = renderArchived();
    expect(getByText('Archived')).not.toBeNull();
    expect(queryByText('Lock')).toBeNull();
    expect(getByText('2026-10-02')).not.toBeNull();
    expect(getByText('Finished — shipped')).not.toBeNull();
  });

  it('the one action is Unarchive… (never Open, Go to tab or Read only…), and it asks via onRowAction', () => {
    const onRowAction = vi.fn();
    const { getByText, queryByText } = renderArchived({}, { onRowAction });
    expect(queryByText('Open')).toBeNull();
    expect(queryByText('Go to tab')).toBeNull();
    expect(queryByText('Read only…')).toBeNull();
    fireEvent.click(getByText('Unarchive…'));
    expect(onRowAction).toHaveBeenCalledTimes(1);
  });

  it('an archived row has no sessions chevron — so there is never a Resume offered on it', () => {
    const { queryByRole } = renderArchived({ sessions: [session()] });
    expect(queryByRole('button', { name: /sessions of Old thing/ })).toBeNull();
  });

  it('a project locked by another session turns Unarchive… off with the reason as a tooltip', () => {
    const { getByText } = renderArchived({
      lock: { kind: 'lockedByOther', holderDisplaySessionId: 'abcd1234' },
    });
    const button = getByText('Unarchive…').closest('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('title')).toMatch(
      /Locked by session abcd1234\. Unarchiving is disabled/,
    );
  });

  it('an archived project without a note shows no second line', () => {
    const { queryByText } = renderArchived({ lifecycle: { ...ARCHIVED, note: null } });
    expect(queryByText('Finished — shipped')).toBeNull();
  });

  it('outside the archived view an active row still shows Lock and its ordinary action', () => {
    const { getByText } = render(
      <ProjectsTable
        {...EXPANSION_PROPS}
        rows={[project()]}
        onToggleFavorite={() => {}}
        onRowAction={() => {}}
        isRowActionPending={() => false}
      />,
    );
    expect(getByText('Lock')).not.toBeNull();
    expect(getByText('Open')).not.toBeNull();
  });
});
