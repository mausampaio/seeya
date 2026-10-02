import { describe, expect, it } from 'vitest';
import { buildRecentNewTabDirectories } from '../../../../packages/app/src/state/recent-directories.js';
import type {
  OtherSessionDirectoryPanelRow,
  ProjectPanelRow,
  ProjectPanelSessionRow,
  ProjectsPanelData,
} from '../../../../packages/app/src/state/projects-panel.js';

let nextSessionId = 0;

function sessionRow(overrides: Partial<ProjectPanelSessionRow> = {}): ProjectPanelSessionRow {
  nextSessionId += 1;
  return {
    sessionId: `session-${nextSessionId}`,
    displaySessionId: `sess${nextSessionId}`,
    name: `session-${nextSessionId}`,
    cwd: '/code/app',
    state: 'idle',
    stateLabel: 'idle',
    lastActivity: null,
    matchedTabId: null,
    ...overrides,
  };
}

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

function otherGroup(
  overrides: Partial<OtherSessionDirectoryPanelRow> = {},
): OtherSessionDirectoryPanelRow {
  return {
    dir: '/code/other',
    sessionCount: 1,
    sessions: [{ ...sessionRow(), adopt: { kind: 'available' } }],
    ...overrides,
  };
}

function panelData(overrides: Partial<ProjectsPanelData> = {}): ProjectsPanelData {
  return { projects: [], otherSessionsByDirectory: [], ignoredProjects: [], ...overrides };
}

describe('buildRecentNewTabDirectories (V2-T64)', () => {
  it('is empty with no session evidence anywhere', () => {
    expect(buildRecentNewTabDirectories(panelData())).toEqual([]);
  });

  it('ignores a session with no activity evidence (D-025)', () => {
    const data = panelData({
      projects: [project({ sessions: [sessionRow({ cwd: '/code/app', lastActivity: null })] })],
    });
    expect(buildRecentNewTabDirectories(data)).toEqual([]);
  });

  it('orders by most recent activity first, across projects and other sessions', () => {
    const data = panelData({
      projects: [
        project({
          sessions: [
            sessionRow({ cwd: '/code/older', lastActivity: new Date('2026-09-01T00:00:00Z') }),
          ],
        }),
      ],
      otherSessionsByDirectory: [
        otherGroup({
          dir: '/code/newest',
          sessions: [
            {
              ...sessionRow({
                cwd: '/code/newest',
                lastActivity: new Date('2026-09-30T00:00:00Z'),
              }),
              adopt: { kind: 'available' },
            },
          ],
        }),
      ],
    });
    expect(buildRecentNewTabDirectories(data)).toEqual(['/code/newest', '/code/older']);
  });

  it('never repeats a directory — keeps its most recent activity', () => {
    const data = panelData({
      projects: [
        project({
          sessions: [
            sessionRow({ cwd: '/code/app', lastActivity: new Date('2026-09-01T00:00:00Z') }),
            sessionRow({ cwd: '/code/app', lastActivity: new Date('2026-09-29T00:00:00Z') }),
          ],
        }),
      ],
    });
    expect(buildRecentNewTabDirectories(data)).toEqual(['/code/app']);
  });

  it('caps at the given max (default 3)', () => {
    const data = panelData({
      projects: [
        project({
          sessions: [
            sessionRow({ cwd: '/code/a', lastActivity: new Date('2026-09-04T00:00:00Z') }),
            sessionRow({ cwd: '/code/b', lastActivity: new Date('2026-09-03T00:00:00Z') }),
            sessionRow({ cwd: '/code/c', lastActivity: new Date('2026-09-02T00:00:00Z') }),
            sessionRow({ cwd: '/code/d', lastActivity: new Date('2026-09-01T00:00:00Z') }),
          ],
        }),
      ],
    });
    expect(buildRecentNewTabDirectories(data)).toEqual(['/code/a', '/code/b', '/code/c']);
    expect(buildRecentNewTabDirectories(data, 2)).toEqual(['/code/a', '/code/b']);
  });
});
