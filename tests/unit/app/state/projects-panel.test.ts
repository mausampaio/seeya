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
    expect(data.otherSessions).toEqual([]);
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

  it('a session matching no project lands in otherSessions, with its own adopt eligibility', () => {
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
    expect(data.otherSessions).toHaveLength(1);
    expect(data.otherSessions[0]?.adopt).toEqual({ kind: 'available' });
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
    expect(data.otherSessions).toHaveLength(1);
  });
});
