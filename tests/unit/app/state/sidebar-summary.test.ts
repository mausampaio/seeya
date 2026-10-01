import { describe, expect, it } from 'vitest';
import {
  buildFavoriteProjectRows,
  buildRecentProjectRows,
  countRunningSessions,
} from '../../../../packages/app/src/state/sidebar-summary.js';
import type {
  ProjectPanelRow,
  ProjectPanelSessionRow,
} from '../../../../packages/app/src/state/projects-panel.js';

function session(overrides: Partial<ProjectPanelSessionRow> = {}): ProjectPanelSessionRow {
  return {
    sessionId: '11111111-1111-4111-8111-111111111111',
    displaySessionId: '11111111',
    name: 'alpha',
    cwd: '/seeya/workspace/auth-hardening',
    state: 'unknown',
    stateLabel: 'no running process',
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
    sessions: [],
    favorite: false,
    ...overrides,
  };
}

describe('buildFavoriteProjectRows (V2-T63 item 3)', () => {
  it('only includes projects marked favorite', () => {
    const rows = buildFavoriteProjectRows([
      project({ projectId: 'a', favorite: true }),
      project({ projectId: 'b', favorite: false }),
    ]);
    expect(rows.map((row) => row.projectId)).toEqual(['a']);
  });

  it('badge is "openHere" when one of the project\'s own sessions is matched to a tab', () => {
    const rows = buildFavoriteProjectRows([
      project({
        favorite: true,
        lockText: 'unlocked',
        sessions: [session({ matchedTabId: 'tab-1' })],
      }),
    ]);
    expect(rows[0]?.badge).toBe('openHere');
    // The project open in this window shows its sessions, indented (docs/INTERFACE.md § 1 item 3).
    expect(rows[0]?.sessions).toHaveLength(1);
  });

  it('badge is "locked" when the lock isn\'t unlocked and no session here is open', () => {
    const rows = buildFavoriteProjectRows([
      project({ favorite: true, lockText: 'held by session 22222222 (pid 4242) since ...' }),
    ]);
    expect(rows[0]?.badge).toBe('locked');
    expect(rows[0]?.sessions).toEqual([]);
  });

  it('badge is "none" when unlocked and no session here is open — no sessions shown', () => {
    const rows = buildFavoriteProjectRows([
      project({ favorite: true, lockText: 'unlocked', sessions: [session()] }),
    ]);
    expect(rows[0]?.badge).toBe('none');
    expect(rows[0]?.sessions).toEqual([]);
  });
});

describe('buildRecentProjectRows (V2-T63 item 4)', () => {
  it('excludes a project with no session evidence at all (D-025)', () => {
    const rows = buildRecentProjectRows([project({ sessions: [] })]);
    expect(rows).toEqual([]);
  });

  it('never repeats a favorite, even with more recent activity', () => {
    const rows = buildRecentProjectRows([
      project({
        projectId: 'favorite-one',
        favorite: true,
        sessions: [session({ lastActivity: new Date('2026-09-30T12:00:00.000Z') })],
      }),
      project({
        projectId: 'plain-one',
        favorite: false,
        sessions: [session({ lastActivity: new Date('2026-09-29T12:00:00.000Z') })],
      }),
    ]);
    expect(rows.map((row) => row.projectId)).toEqual(['plain-one']);
  });

  it('sorts by the most recent session activity, descending', () => {
    const rows = buildRecentProjectRows([
      project({
        projectId: 'older',
        sessions: [session({ lastActivity: new Date('2026-09-28T12:00:00.000Z') })],
      }),
      project({
        projectId: 'newer',
        sessions: [session({ lastActivity: new Date('2026-09-30T12:00:00.000Z') })],
      }),
    ]);
    expect(rows.map((row) => row.projectId)).toEqual(['newer', 'older']);
  });

  it('caps at 5, even with more candidates', () => {
    const projects = Array.from({ length: 7 }, (_unused, index) =>
      project({
        projectId: `p${String(index)}`,
        sessions: [session({ lastActivity: new Date(2026, 8, index + 1) })],
      }),
    );
    expect(buildRecentProjectRows(projects)).toHaveLength(5);
  });

  it("uses the MOST RECENT of a project's several sessions, not the first", () => {
    const rows = buildRecentProjectRows([
      project({
        sessions: [
          session({ sessionId: 'old', lastActivity: new Date('2026-09-01T00:00:00.000Z') }),
          session({ sessionId: 'new', lastActivity: new Date('2026-09-30T00:00:00.000Z') }),
        ],
      }),
    ]);
    expect(rows[0]?.lastActivity).toEqual(new Date('2026-09-30T00:00:00.000Z'));
  });

  // PO review (2026-10-01): Recent now carries the same badge/sessions shape as Favorites
  // (`ProjectSidebarRow`), rendered by the shared `ProjectRow` component — a project open in this
  // window reads the same whether it was found via Favorites or Recent.
  it('badge is "openHere" with the project\'s own sessions, same as Favorites', () => {
    const rows = buildRecentProjectRows([
      project({
        sessions: [
          session({ matchedTabId: 'tab-1', lastActivity: new Date('2026-09-30T12:00:00.000Z') }),
        ],
      }),
    ]);
    expect(rows[0]?.badge).toBe('openHere');
    expect(rows[0]?.sessions).toHaveLength(1);
  });

  it('badge is "locked" with no sessions shown when the lock is held elsewhere', () => {
    const rows = buildRecentProjectRows([
      project({
        lockText: 'held by session 22222222 (pid 4242) since ...',
        sessions: [session({ lastActivity: new Date('2026-09-30T12:00:00.000Z') })],
      }),
    ]);
    expect(rows[0]?.badge).toBe('locked');
    expect(rows[0]?.sessions).toEqual([]);
  });
});

describe('countRunningSessions (V2-T63 item 6)', () => {
  it('counts alive/idle sessions across projects and other sessions, never unknown/ended', () => {
    const count = countRunningSessions(
      [
        project({
          sessions: [session({ state: 'alive' }), session({ state: 'unknown' })],
        }),
      ],
      [{ sessions: [session({ state: 'idle' }), session({ state: 'ended' })] }],
    );
    expect(count).toBe(2);
  });

  it('is zero with nothing running', () => {
    expect(countRunningSessions([], [])).toBe(0);
  });
});
