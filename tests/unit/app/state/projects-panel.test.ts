import { describe, expect, it } from 'vitest';
import { buildProjectsPanelData } from '../../../../packages/app/src/state/projects-panel.js';
import { buildSidebarRows } from '../../../../packages/app/src/sidebar/sidebar-data.js';
import { emptyTabs } from '../../../../packages/app/src/tabs/tab-model.js';
import { createConfig, createSessionWithoutPid } from '../../core/_fixtures.js';
import type { ProjectManifest } from '@seeya-ai/engine/core/types.js';
import type { ProjectLockStatus } from '@seeya-ai/engine/application/project-lock.js';

const NOW = new Date('2026-09-24T12:00:00.000Z');

function manifest(overrides: Partial<ProjectManifest> = {}): ProjectManifest {
  return {
    id: 'auth-hardening',
    name: 'Auth hardening',
    defaultHarness: 'claude',
    repositories: [],
    trackers: [],
    ...overrides,
  };
}

describe('buildProjectsPanelData (V2-T30 item 1)', () => {
  it('a project with a matching session shows it, with a plain-English unlocked lock line', () => {
    const session = createSessionWithoutPid({
      sessionId: '11111111-1111-4111-8111-111111111111',
      cwd: '/seeya/workspace/auth-hardening',
    });
    const rows = buildSidebarRows(
      { sessions: [session], rejected: [] },
      createConfig(),
      NOW,
      emptyTabs(),
    );

    const data = buildProjectsPanelData(
      rows,
      [{ manifest: manifest(), dir: '/seeya/workspace/auth-hardening' }],
      [],
      new Map<string, ProjectLockStatus>(),
      'posix',
    );

    expect(data.projects).toHaveLength(1);
    expect(data.projects[0]?.lockText).toBe('unlocked');
    expect(data.projects[0]?.sessions.map((row) => row.sessionId)).toEqual([session.sessionId]);
    // V2-T55 item 5: the short id and formatted state label ride along on every session row.
    expect(data.projects[0]?.sessions[0]?.displaySessionId).toBe('11111111');
    expect(data.otherSessionsByDirectory).toEqual([]);
  });

  it('a held lock names the holder in plain English', () => {
    const lockStatus = new Map<string, ProjectLockStatus>([
      [
        'auth-hardening',
        {
          kind: 'heldByLiveSession',
          lock: {
            sessionId: '33333333-3333-4333-8333-333333333333',
            pid: 4242,
            procStart: undefined,
            acquiredAt: NOW,
          },
        },
      ],
    ]);

    const data = buildProjectsPanelData(
      [],
      [{ manifest: manifest(), dir: '/seeya/workspace/auth-hardening' }],
      [],
      lockStatus,
      'posix',
    );

    expect(data.projects[0]?.lockText).toContain('held by session 33333333');
  });

  it('a stale lock says so and names it reclaimable', () => {
    const lockStatus = new Map<string, ProjectLockStatus>([
      [
        'auth-hardening',
        {
          kind: 'staleLock',
          lock: {
            sessionId: undefined,
            pid: 4242,
            procStart: undefined,
            acquiredAt: NOW,
          },
        },
      ],
    ]);

    const data = buildProjectsPanelData(
      [],
      [{ manifest: manifest(), dir: '/seeya/workspace/auth-hardening' }],
      [],
      lockStatus,
      'posix',
    );

    expect(data.projects[0]?.lockText).toContain('stale');
    expect(data.projects[0]?.lockText).toContain('reclaimable');
  });

  it('a session matching no project lands in otherSessionsByDirectory, with its own adopt eligibility', () => {
    const session = createSessionWithoutPid({ cwd: '/code/unrelated' });
    const rows = buildSidebarRows(
      { sessions: [session], rejected: [] },
      createConfig(),
      NOW,
      emptyTabs(),
    );

    const data = buildProjectsPanelData(
      rows,
      [{ manifest: manifest(), dir: '/seeya/workspace/auth-hardening' }],
      [],
      new Map(),
      'posix',
    );

    expect(data.projects[0]?.sessions).toEqual([]);
    expect(data.otherSessionsByDirectory).toHaveLength(1);
    expect(data.otherSessionsByDirectory[0]?.dir).toBe('/code/unrelated');
    expect(data.otherSessionsByDirectory[0]?.sessionCount).toBe(1);
    const row = data.otherSessionsByDirectory[0]?.sessions[0];
    expect(row?.adopt).toEqual({ kind: 'available' });
    // V2-T52: the enum stays 'unknown' (createSessionWithoutPid has no pid), the label reads a fact.
    expect(row?.state).toBe('unknown');
    expect(row?.stateLabel).toBe('no running process');
    expect(row?.lastActivity).toEqual(session.lastActivity);
  });

  it('no projects at all still reports every session as "other" (D-025, no project to invent)', () => {
    const session = createSessionWithoutPid();
    const rows = buildSidebarRows(
      { sessions: [session], rejected: [] },
      createConfig(),
      NOW,
      emptyTabs(),
    );

    const data = buildProjectsPanelData(rows, [], [], new Map(), 'posix');

    expect(data.projects).toEqual([]);
    expect(data.otherSessionsByDirectory).toHaveLength(1);
  });

  /**
   * V2-T55 item 2's own motivating case: many sessions, launched from the same handful of
   * directories, become a confusing flat list. Two "other" sessions from the SAME directory
   * collapse into one directory row with `sessionCount: 2` — never two separate rows.
   */
  it('other sessions sharing a directory collapse into one directory row with a count', () => {
    const first = createSessionWithoutPid({
      sessionId: '11111111-1111-4111-8111-111111111111',
      cwd: '/code/unrelated',
    });
    const second = createSessionWithoutPid({
      sessionId: '22222222-2222-4222-8222-222222222222',
      cwd: '/code/unrelated',
    });
    const rows = buildSidebarRows(
      { sessions: [first, second], rejected: [] },
      createConfig(),
      NOW,
      emptyTabs(),
    );

    const data = buildProjectsPanelData(rows, [], [], new Map(), 'posix');

    expect(data.otherSessionsByDirectory).toHaveLength(1);
    expect(data.otherSessionsByDirectory[0]?.sessionCount).toBe(2);
    expect(data.otherSessionsByDirectory[0]?.sessions.map((row) => row.sessionId).sort()).toEqual(
      [first.sessionId, second.sessionId].sort(),
    );
  });

  it('other sessions in different directories produce one row per directory', () => {
    const a = createSessionWithoutPid({
      sessionId: '11111111-1111-4111-8111-111111111111',
      cwd: '/code/a',
    });
    const b = createSessionWithoutPid({
      sessionId: '22222222-2222-4222-8222-222222222222',
      cwd: '/code/b',
    });
    const rows = buildSidebarRows(
      { sessions: [a, b], rejected: [] },
      createConfig(),
      NOW,
      emptyTabs(),
    );

    const data = buildProjectsPanelData(rows, [], [], new Map(), 'posix');

    expect(data.otherSessionsByDirectory).toHaveLength(2);
    expect(data.otherSessionsByDirectory.map((group) => group.dir)).toEqual(['/code/a', '/code/b']);
  });
});
