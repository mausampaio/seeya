import { describe, expect, it } from 'vitest';
import {
  buildProjectsTableRows,
  isActiveProject,
} from '../../../../packages/app/src/state/projects-table.js';
import type { ProjectPanelRow } from '../../../../packages/app/src/state/projects-panel.js';

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

const RUNNING_SESSION = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  displaySessionId: '11111111',
  name: 'alpha',
  cwd: '/ws/alpha',
  state: 'alive',
  stateLabel: 'alive',
  lastActivity: null,
  matchedTabId: null,
} as const;

describe('buildProjectsTableRows (V2-T67)', () => {
  it('with filter "all" and no query, keeps every row', () => {
    const rows = [project({ projectId: 'a' }), project({ projectId: 'b' })];
    expect(buildProjectsTableRows(rows, 'all', '').map((row) => row.projectId)).toEqual(['a', 'b']);
  });

  it('filter "running" keeps only a project with at least one alive/idle session', () => {
    const running = project({
      projectId: 'running',
      sessions: [
        {
          sessionId: 's1',
          displaySessionId: 's1',
          name: 'main',
          cwd: '/repo',
          state: 'alive',
          stateLabel: 'running',
          lastActivity: null,
          matchedTabId: null,
        },
      ],
    });
    const idleOnly = project({
      projectId: 'ended',
      sessions: [
        {
          sessionId: 's2',
          displaySessionId: 's2',
          name: 'main',
          cwd: '/repo',
          state: 'ended',
          stateLabel: 'ended',
          lastActivity: null,
          matchedTabId: null,
        },
      ],
    });
    expect(
      buildProjectsTableRows([running, idleOnly], 'running', '').map((row) => row.projectId),
    ).toEqual(['running']);
  });

  it('filter "locked" keeps only a project whose lock is lockedByOther', () => {
    const locked = project({
      projectId: 'locked',
      lock: { kind: 'lockedByOther', holderDisplaySessionId: 'abcd1234' },
    });
    const openHere = project({ projectId: 'open-here', lock: { kind: 'openHere', tabId: 't1' } });
    const unlocked = project({ projectId: 'unlocked', lock: { kind: 'unlocked' } });
    expect(
      buildProjectsTableRows([locked, openHere, unlocked], 'locked', '').map(
        (row) => row.projectId,
      ),
    ).toEqual(['locked']);
  });

  it('search matches by name, case-insensitively, trimmed', () => {
    const rows = [
      project({ projectId: 'a', name: 'Payments webhooks' }),
      project({ projectId: 'b', name: 'Auth hardening' }),
    ];
    expect(buildProjectsTableRows(rows, 'all', '  PAYMENTS  ').map((row) => row.projectId)).toEqual(
      ['a'],
    );
  });

  it('an empty or whitespace-only query matches every project', () => {
    const rows = [project({ projectId: 'a' }), project({ projectId: 'b' })];
    expect(buildProjectsTableRows(rows, 'all', '   ').map((row) => row.projectId)).toEqual([
      'a',
      'b',
    ]);
  });

  it('sorts most recent last activity first', () => {
    const older = project({ projectId: 'older', lastActivity: new Date('2026-09-01T00:00:00Z') });
    const newer = project({ projectId: 'newer', lastActivity: new Date('2026-09-20T00:00:00Z') });
    expect(buildProjectsTableRows([older, newer], 'all', '').map((row) => row.projectId)).toEqual([
      'newer',
      'older',
    ]);
  });

  it('a project with no known activity always sorts last, never guessed into a position (D-025)', () => {
    const unknown = project({ projectId: 'unknown', lastActivity: null });
    const known = project({ projectId: 'known', lastActivity: new Date('2026-09-01T00:00:00Z') });
    expect(buildProjectsTableRows([unknown, known], 'all', '').map((row) => row.projectId)).toEqual(
      ['known', 'unknown'],
    );
    // Two unknowns: order is stable (input order), never arbitrary.
    const unknownB = project({ projectId: 'unknown-b', lastActivity: null });
    expect(
      buildProjectsTableRows([unknown, unknownB], 'all', '').map((row) => row.projectId),
    ).toEqual(['unknown', 'unknown-b']);
  });
});

describe('buildProjectsTableRows with archived projects (V2-T84)', () => {
  const archived = (overrides: Partial<ProjectPanelRow> = {}): ProjectPanelRow =>
    project({
      projectId: 'old-thing',
      name: 'Old thing',
      lifecycle: {
        kind: 'archived',
        archivedAt: new Date('2026-10-02T00:00:00.000Z'),
        note: 'Finished',
      },
      ...overrides,
    });

  it('"all", "running" and "locked" look only at ACTIVE projects', () => {
    const rows = [
      project({
        projectId: 'live',
        sessions: [{ ...RUNNING_SESSION }],
        lock: { kind: 'lockedByOther', holderDisplaySessionId: 'abcd1234' },
      }),
      archived({
        sessions: [{ ...RUNNING_SESSION }],
        lock: { kind: 'lockedByOther', holderDisplaySessionId: 'abcd1234' },
      }),
    ];
    for (const filter of ['all', 'running', 'locked'] as const) {
      expect(buildProjectsTableRows(rows, filter, '').map((row) => row.projectId)).toEqual([
        'live',
      ]);
    }
  });

  it('"archived" shows only the archived ones', () => {
    const rows = [project({ projectId: 'live' }), archived()];
    expect(buildProjectsTableRows(rows, 'archived', '').map((row) => row.projectId)).toEqual([
      'old-thing',
    ]);
  });

  it('the search applies inside "archived", and never finds an archived project under "all"', () => {
    const rows = [archived(), archived({ projectId: 'older', name: 'Older' })];
    expect(buildProjectsTableRows(rows, 'archived', 'older').map((row) => row.projectId)).toEqual([
      'older',
    ]);
    expect(buildProjectsTableRows(rows, 'all', 'older')).toEqual([]);
  });

  it('isActiveProject reads the lifecycle', () => {
    expect(isActiveProject(project())).toBe(true);
    expect(isActiveProject(archived())).toBe(false);
  });
});
