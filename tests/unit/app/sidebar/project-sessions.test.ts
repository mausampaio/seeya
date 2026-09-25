import { describe, expect, it } from 'vitest';
import {
  groupOtherSessionsByDirectory,
  groupSessionsByProject,
  resolveAdoptEligibility,
} from '../../../../packages/app/src/sidebar/project-sessions.js';
import { buildSidebarRows } from '../../../../packages/app/src/sidebar/sidebar-data.js';
import { emptyTabs } from '../../../../packages/app/src/tabs/tab-model.js';
import {
  createConfig,
  createSessionWithPid,
  createSessionWithoutPid,
} from '../../core/_fixtures.js';

const NOW = new Date('2026-09-24T12:00:00.000Z');

function rowsFor(sessions: Parameters<typeof buildSidebarRows>[0]['sessions']) {
  return buildSidebarRows({ sessions, rejected: [] }, createConfig(), NOW, emptyTabs());
}

describe('groupSessionsByProject (V2-T30 item 1)', () => {
  it('matches a session to a project by cwd (D-025 evidence, normalized comparison)', () => {
    const session = createSessionWithoutPid({
      sessionId: '11111111-1111-4111-8111-111111111111',
      cwd: 'C:\\seeya\\workspace\\auth-hardening\\',
    });
    const rows = rowsFor([session]);

    const grouping = groupSessionsByProject(
      rows,
      [{ projectId: 'auth-hardening', dir: 'c:/seeya/workspace/auth-hardening' }],
      [],
      new Map(),
      'win32',
    );

    expect(grouping.sessionsByProjectId.get('auth-hardening')).toHaveLength(1);
    expect(grouping.otherSessions).toEqual([]);
  });

  it('matches by the adopted fork session id, never by the original (D-025)', () => {
    const original = createSessionWithoutPid({
      sessionId: '11111111-1111-4111-8111-111111111111',
      cwd: '/code/somewhere-else',
    });
    const fork = createSessionWithoutPid({
      sessionId: '22222222-2222-4222-8222-222222222222',
      cwd: '/code/somewhere-else',
    });
    const rows = rowsFor([original, fork]);
    const adoptions = [
      {
        originalSessionId: original.sessionId,
        forkSessionId: fork.sessionId,
        projectId: 'auth-hardening',
        adoptedAt: NOW,
      },
    ];

    const grouping = groupSessionsByProject(
      rows,
      [{ projectId: 'auth-hardening', dir: '/seeya/workspace/auth-hardening' }],
      adoptions,
      new Map(),
      'posix',
    );

    const projectSessionIds = grouping.sessionsByProjectId
      .get('auth-hardening')
      ?.map((row) => row.sessionId);
    expect(projectSessionIds).toEqual([fork.sessionId]);
    expect(grouping.otherSessions.map((row) => row.sessionId)).toEqual([original.sessionId]);
  });

  it('matches by the project lock holder session id', () => {
    const holder = createSessionWithoutPid({
      sessionId: '33333333-3333-4333-8333-333333333333',
      cwd: '/code/elsewhere',
    });
    const rows = rowsFor([holder]);

    const grouping = groupSessionsByProject(
      rows,
      [{ projectId: 'auth-hardening', dir: '/seeya/workspace/auth-hardening' }],
      [],
      new Map([['auth-hardening', holder.sessionId]]),
      'posix',
    );

    expect(grouping.sessionsByProjectId.get('auth-hardening')?.map((r) => r.sessionId)).toEqual([
      holder.sessionId,
    ]);
  });

  it('a session matching no evidence for any project lands in "Other sessions" — never a repository guess', () => {
    const unrelated = createSessionWithoutPid({ cwd: '/code/unrelated-repo' });
    const rows = rowsFor([unrelated]);

    const grouping = groupSessionsByProject(
      rows,
      [{ projectId: 'auth-hardening', dir: '/seeya/workspace/auth-hardening' }],
      [],
      new Map(),
      'posix',
    );

    expect(grouping.sessionsByProjectId.get('auth-hardening')).toEqual([]);
    expect(grouping.otherSessions.map((row) => row.cwd)).toEqual(['/code/unrelated-repo']);
  });

  it('an empty session list produces empty groups for every project, never an error', () => {
    const grouping = groupSessionsByProject(
      [],
      [{ projectId: 'auth-hardening', dir: '/seeya/workspace/auth-hardening' }],
      [],
      new Map(),
      'posix',
    );

    expect(grouping.sessionsByProjectId.get('auth-hardening')).toEqual([]);
    expect(grouping.otherSessions).toEqual([]);
  });
});

describe('resolveAdoptEligibility (V2-T30 item 5)', () => {
  it('a live session is disabled, with the reason named', () => {
    const [row] = rowsFor([createSessionWithPid({ pid: 111, lastTranscriptWrite: NOW })]);
    const eligibility = resolveAdoptEligibility(row!, []);

    expect(eligibility).toEqual({
      kind: 'unavailable',
      reason: 'running right now — resuming it here would open a second copy',
    });
  });

  it('an idle session is disabled too — idle is still a live process (D-025)', () => {
    const [row] = rowsFor([
      createSessionWithPid({
        pid: 111,
        lastTranscriptWrite: new Date(NOW.getTime() - 999 * 60 * 1000),
      }),
    ]);
    const eligibility = resolveAdoptEligibility(row!, []);

    expect(eligibility.kind).toBe('unavailable');
  });

  it('an already-adopted original is disabled, naming the project it went to', () => {
    const original = createSessionWithoutPid({
      sessionId: '11111111-1111-4111-8111-111111111111',
    });
    const [row] = rowsFor([original]);

    const eligibility = resolveAdoptEligibility(row!, [
      {
        originalSessionId: original.sessionId,
        forkSessionId: '22222222-2222-4222-8222-222222222222',
        projectId: 'auth-hardening',
        adoptedAt: NOW,
      },
    ]);

    expect(eligibility).toEqual({
      kind: 'unavailable',
      reason: 'already adopted into project "auth-hardening"',
    });
  });

  it('an ended session with no prior adoption is available (the permitted case, not just the forbidden ones)', () => {
    const ended = createSessionWithPid({ pid: 111, processIsAlive: false });
    const [row] = rowsFor([ended]);

    expect(resolveAdoptEligibility(row!, [])).toEqual({ kind: 'available' });
  });
});

describe('groupOtherSessionsByDirectory (V2-T55 item 2)', () => {
  it('two sessions in the same directory collapse into one row with the right count', () => {
    const rows = rowsFor([
      createSessionWithoutPid({
        sessionId: '11111111-1111-4111-8111-111111111111',
        cwd: 'c:\\code\\shared',
      }),
      createSessionWithoutPid({
        sessionId: '22222222-2222-4222-8222-222222222222',
        cwd: 'c:\\code\\shared',
      }),
    ]);

    const groups = groupOtherSessionsByDirectory(rows, 'win32');

    expect(groups).toHaveLength(1);
    expect(groups[0]?.sessionCount).toBe(2);
    expect(groups[0]?.sessions).toHaveLength(2);
  });

  it('a different spelling of the same directory (trailing slash, separator, case) still merges', () => {
    const rows = rowsFor([
      createSessionWithoutPid({
        sessionId: '11111111-1111-4111-8111-111111111111',
        cwd: 'C:\\code\\Shared\\',
      }),
      createSessionWithoutPid({
        sessionId: '22222222-2222-4222-8222-222222222222',
        cwd: 'c:/code/shared',
      }),
    ]);

    const groups = groupOtherSessionsByDirectory(rows, 'win32');

    expect(groups).toHaveLength(1);
    expect(groups[0]?.sessionCount).toBe(2);
  });

  it('sessions in different directories produce one row each, sorted by directory', () => {
    const rows = rowsFor([
      createSessionWithoutPid({
        sessionId: '11111111-1111-4111-8111-111111111111',
        cwd: 'c:\\code\\zzz',
      }),
      createSessionWithoutPid({
        sessionId: '22222222-2222-4222-8222-222222222222',
        cwd: 'c:\\code\\aaa',
      }),
    ]);

    const groups = groupOtherSessionsByDirectory(rows, 'win32');

    expect(groups.map((group) => group.dir)).toEqual(['c:\\code\\aaa', 'c:\\code\\zzz']);
  });

  it('no sessions produces no groups', () => {
    expect(groupOtherSessionsByDirectory([], 'win32')).toEqual([]);
  });
});
