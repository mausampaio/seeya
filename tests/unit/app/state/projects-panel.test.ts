import { describe, expect, it } from 'vitest';
import {
  buildProjectsPanelData,
  formatProjectRowLockCellText,
  formatProjectRowLockText,
  resolveProjectRowAction,
} from '../../../../packages/app/src/state/projects-panel.js';
import { buildSidebarRows } from '../../../../packages/app/src/sidebar/sidebar-data.js';
import {
  addTab,
  createTab,
  emptyTabs,
  withPid,
} from '../../../../packages/app/src/tabs/tab-model.js';
import {
  createConfig,
  createSessionWithPid,
  createSessionWithoutPid,
} from '../../core/_fixtures.js';
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
    lifecycle: { kind: 'active' },
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
    expect(data.projects[0]?.lock).toEqual({ kind: 'unlocked' });
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
    // V2-T67: the Projects tab's own lock column/action reads the same lock state —
    // `lockedByOther` with the short display id, since this project has no matching open tab.
    expect(data.projects[0]?.lock).toEqual({
      kind: 'lockedByOther',
      holderDisplaySessionId: '33333333',
    });
  });

  it('a held lock with no matched tab still reports lockedByOther, never openHere', () => {
    const lockStatus = new Map<string, ProjectLockStatus>([
      [
        'auth-hardening',
        {
          kind: 'heldByLiveSession',
          lock: { sessionId: undefined, pid: 4242, procStart: undefined, acquiredAt: NOW },
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

    // D-025: an unidentified holder (no sessionId on the lock) never guesses a display id.
    expect(data.projects[0]?.lock).toEqual({ kind: 'lockedByOther', holderDisplaySessionId: null });
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
    // V2-T67, Q-108: a stale lock reads as `unlocked` in the Projects tab — opening it already
    // succeeds with no confirmation, so the row action/text never names a holder that's gone.
    expect(data.projects[0]?.lock).toEqual({ kind: 'unlocked' });
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

  describe('favorite (V2-T63)', () => {
    it('defaults to false when no favoriteProjectIds is given', () => {
      const data = buildProjectsPanelData(
        [],
        [{ manifest: manifest(), dir: '/seeya/workspace/auth-hardening' }],
        [],
        new Map(),
        'posix',
      );
      expect(data.projects[0]?.favorite).toBe(false);
    });

    it('marks a project favorite when its id is in favoriteProjectIds', () => {
      const data = buildProjectsPanelData(
        [],
        [{ manifest: manifest(), dir: '/seeya/workspace/auth-hardening' }],
        [],
        new Map(),
        'posix',
        [],
        new Set(['auth-hardening']),
      );
      expect(data.projects[0]?.favorite).toBe(true);
    });

    it('never marks a project not in favoriteProjectIds', () => {
      const data = buildProjectsPanelData(
        [],
        [{ manifest: manifest(), dir: '/seeya/workspace/auth-hardening' }],
        [],
        new Map(),
        'posix',
        [],
        new Set(['billing']),
      );
      expect(data.projects[0]?.favorite).toBe(false);
    });
  });

  describe('lock/action/repositoryCount/lastActivity (V2-T67)', () => {
    it('a project with a session open in this window reports openHere, never lockedByOther', () => {
      const session = createSessionWithPid({
        sessionId: '11111111-1111-4111-8111-111111111111',
        cwd: '/seeya/workspace/auth-hardening',
        pid: 4242,
      });
      const tabs = addTab(
        emptyTabs(),
        withPid(createTab({ id: 'tab-1', command: 'claude', args: [], cwd: session.cwd }), 4242),
      );
      const rows = buildSidebarRows(
        { sessions: [session], rejected: [] },
        createConfig(),
        NOW,
        tabs,
      );
      const lockStatus = new Map<string, ProjectLockStatus>([
        [
          'auth-hardening',
          {
            kind: 'heldByLiveSession',
            lock: {
              sessionId: session.sessionId,
              pid: 4242,
              procStart: undefined,
              acquiredAt: NOW,
            },
          },
        ],
      ]);

      const data = buildProjectsPanelData(
        rows,
        [{ manifest: manifest(), dir: '/seeya/workspace/auth-hardening' }],
        [],
        lockStatus,
        'posix',
      );

      expect(data.projects[0]?.lock).toEqual({ kind: 'openHere', tabId: 'tab-1' });
    });

    it('resolveProjectRowAction/formatProjectRowLockText follow the lock kind', () => {
      const active = { kind: 'active' } as const;
      expect(resolveProjectRowAction({ lock: { kind: 'unlocked' }, lifecycle: active })).toEqual({
        kind: 'open',
      });
      expect(
        resolveProjectRowAction({ lock: { kind: 'openHere', tabId: 't' }, lifecycle: active }),
      ).toEqual({
        kind: 'goToTab',
        tabId: 't',
      });
      expect(
        resolveProjectRowAction({
          lock: { kind: 'lockedByOther', holderDisplaySessionId: null },
          lifecycle: active,
        }),
      ).toEqual({ kind: 'readOnly' });
      // V2-T84: an archived project's one action is Unarchive…, whatever the lock says.
      const archived = {
        kind: 'archived',
        archivedAt: new Date('2026-10-02T00:00:00.000Z'),
        note: null,
      } as const;
      for (const lock of [
        { kind: 'unlocked' },
        { kind: 'openHere', tabId: 't' },
        { kind: 'lockedByOther', holderDisplaySessionId: null },
      ] as const) {
        expect(resolveProjectRowAction({ lock, lifecycle: archived })).toEqual({
          kind: 'unarchive',
        });
      }
      expect(formatProjectRowLockText({ kind: 'unlocked' })).toBe('Unlocked');
      expect(formatProjectRowLockText({ kind: 'openHere', tabId: 't' })).toBe(
        'Open in this window',
      );
      expect(
        formatProjectRowLockText({ kind: 'lockedByOther', holderDisplaySessionId: 'abcd1234' }),
      ).toBe('Locked by session abcd1234');
      expect(
        formatProjectRowLockText({ kind: 'lockedByOther', holderDisplaySessionId: null }),
      ).toBe('Locked by an unidentified session');
    });

    it('repositoryCount mirrors the manifest’s own repositories length', () => {
      const data = buildProjectsPanelData(
        [],
        [
          {
            manifest: manifest({
              repositories: [{ hasRemote: false, name: 'api' }],
            }),
            dir: '/seeya/workspace/auth-hardening',
          },
        ],
        [],
        new Map(),
        'posix',
      );
      expect(data.projects[0]?.repositoryCount).toBe(1);
    });

    it('lastActivity is the most recent session activity, null when no session has any', () => {
      const withActivity = createSessionWithoutPid({
        sessionId: '11111111-1111-4111-8111-111111111111',
        cwd: '/seeya/workspace/auth-hardening',
      });
      const rows = buildSidebarRows(
        { sessions: [withActivity], rejected: [] },
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
      expect(data.projects[0]?.lastActivity).toEqual(withActivity.lastActivity);

      const emptyData = buildProjectsPanelData(
        [],
        [{ manifest: manifest(), dir: '/seeya/workspace/auth-hardening' }],
        [],
        new Map(),
        'posix',
      );
      expect(emptyData.projects[0]?.lastActivity).toBeNull();
    });
  });

  describe('ignoredProjects (V2-T72 item 2)', () => {
    it('is empty when nothing was rejected — the ordinary case', () => {
      const data = buildProjectsPanelData([], [], [], new Map(), 'posix', []);
      expect(data.ignoredProjects).toEqual([]);
    });

    it('derives the project id from the rejected seeya.json path (POSIX) and keeps the reason', () => {
      const data = buildProjectsPanelData([], [], [], new Map(), 'posix', [
        {
          file: '/seeya/workspace/broken-project/seeya.json',
          raw: undefined,
          reason: 'repositories: expected array, received object',
        },
      ]);
      expect(data.ignoredProjects).toEqual([
        {
          projectId: 'broken-project',
          reason: 'repositories: expected array, received object',
          fullReason: 'repositories: expected array, received object',
        },
      ]);
    });

    it('derives the project id from a Windows-shaped path too — the same logic, no platform branch', () => {
      const data = buildProjectsPanelData([], [], [], new Map(), 'win32', [
        {
          file: 'C:\\seeya\\workspace\\broken-project\\seeya.json',
          raw: undefined,
          reason: 'invalid JSON',
        },
      ]);
      expect(data.ignoredProjects).toEqual([
        { projectId: 'broken-project', reason: 'invalid JSON', fullReason: 'invalid JSON' },
      ]);
    });

    it('PO review round 1: abbreviates a home-rooted reason with ~ and keeps the full message for a tooltip', () => {
      const data = buildProjectsPanelData(
        [],
        [],
        [],
        new Map(),
        'posix',
        [
          {
            file: '/seeya/workspace/broken-project/seeya.json',
            raw: undefined,
            reason: '/home/x/.seeya/workspace/broken-project/seeya.json is not valid JSON',
          },
        ],
        new Set(),
        '/home/x',
      );
      expect(data.ignoredProjects[0]?.reason).toBe(
        '~/.seeya/workspace/broken-project/seeya.json is not valid JSON',
      );
      expect(data.ignoredProjects[0]?.fullReason).toBe(
        '/home/x/.seeya/workspace/broken-project/seeya.json is not valid JSON',
      );
    });

    it('reports every rejected entry, not just the first', () => {
      const data = buildProjectsPanelData([], [], [], new Map(), 'posix', [
        { file: '/seeya/workspace/a/seeya.json', raw: undefined, reason: 'bad a' },
        { file: '/seeya/workspace/b/seeya.json', raw: undefined, reason: 'bad b' },
      ]);
      expect(data.ignoredProjects.map((row) => row.projectId)).toEqual(['a', 'b']);
    });
  });
});

describe("formatProjectRowLockCellText (V2-T84, the Lock column's compact spelling)", () => {
  it('spells the locked case "Locked · <id>" and leaves the other two as the full text', () => {
    expect(
      formatProjectRowLockCellText({ kind: 'lockedByOther', holderDisplaySessionId: '33333333' }),
    ).toBe('Locked · 33333333');
    expect(
      formatProjectRowLockCellText({ kind: 'lockedByOther', holderDisplaySessionId: null }),
    ).toBe('Locked · unknown');
    expect(formatProjectRowLockCellText({ kind: 'unlocked' })).toBe('Unlocked');
    expect(formatProjectRowLockCellText({ kind: 'openHere', tabId: 't' })).toBe(
      'Open in this window',
    );
  });
});
