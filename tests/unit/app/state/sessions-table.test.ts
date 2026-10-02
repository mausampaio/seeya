import { describe, expect, it } from 'vitest';
import {
  buildSessionsDirectoryFilterOptions,
  buildSessionsProjectFilterOptions,
  buildSessionsTableRows,
  DEFAULT_SESSIONS_TABLE_FILTERS,
  resolveSessionRowAction,
  type SessionsTableFilters,
} from '../../../../packages/app/src/state/sessions-table.js';
import type { SessionsPanelRow } from '../../../../packages/app/src/state/sessions-panel.js';

function row(overrides: Partial<SessionsPanelRow> = {}): SessionsPanelRow {
  return {
    sessionId: '11111111-1111-4111-8111-111111111111',
    displaySessionId: '1111',
    name: 'Payments investigation',
    cwd: '/repo/payments',
    state: 'unknown',
    stateLabel: 'no running process',
    lastActivity: null,
    matchedTabId: null,
    projectId: null,
    projectName: null,
    adopt: { kind: 'available' },
    ...overrides,
  };
}

describe('buildSessionsTableRows (V2-T68)', () => {
  it('"running" keeps only alive/idle sessions', () => {
    const alive = row({ sessionId: 'a', state: 'alive' });
    const idle = row({ sessionId: 'b', state: 'idle' });
    const unknown = row({ sessionId: 'c', state: 'unknown' });
    const rows = buildSessionsTableRows(
      [alive, idle, unknown],
      { ...DEFAULT_SESSIONS_TABLE_FILTERS, state: 'running' },
      '',
      'posix',
    );
    expect(rows.map((r) => r.sessionId).sort()).toEqual(['a', 'b']);
  });

  it('"notRunning" keeps only sessions with no live process', () => {
    const alive = row({ sessionId: 'a', state: 'alive' });
    const ended = row({ sessionId: 'b', state: 'ended' });
    const rows = buildSessionsTableRows(
      [alive, ended],
      { ...DEFAULT_SESSIONS_TABLE_FILTERS, state: 'notRunning' },
      '',
      'posix',
    );
    expect(rows.map((r) => r.sessionId)).toEqual(['b']);
  });

  it('"none" project filter keeps only sessions with no project', () => {
    const withProject = row({ sessionId: 'a', projectId: 'p', projectName: 'P', adopt: null });
    const withoutProject = row({ sessionId: 'b' });
    const rows = buildSessionsTableRows(
      [withProject, withoutProject],
      { ...DEFAULT_SESSIONS_TABLE_FILTERS, project: 'none' },
      '',
      'posix',
    );
    expect(rows.map((r) => r.sessionId)).toEqual(['b']);
  });

  it("a specific project id filter keeps only that project's own sessions", () => {
    const a = row({ sessionId: 'a', projectId: 'p1', projectName: 'P1', adopt: null });
    const b = row({ sessionId: 'b', projectId: 'p2', projectName: 'P2', adopt: null });
    const rows = buildSessionsTableRows(
      [a, b],
      { ...DEFAULT_SESSIONS_TABLE_FILTERS, project: 'p1' },
      '',
      'posix',
    );
    expect(rows.map((r) => r.sessionId)).toEqual(['a']);
  });

  it('the directory filter compares normalized cwd, ignoring separator/case differences', () => {
    const a = row({ sessionId: 'a', cwd: 'C:\\code\\seeya' });
    const b = row({ sessionId: 'b', cwd: '/repo/other' });
    const normalized = 'c:/code/seeya';
    const rows = buildSessionsTableRows(
      [a, b],
      { ...DEFAULT_SESSIONS_TABLE_FILTERS, directory: normalized },
      '',
      'win32',
    );
    expect(rows.map((r) => r.sessionId)).toEqual(['a']);
  });

  it('matches by name substring, case-insensitively', () => {
    const a = row({ sessionId: 'a', name: 'Payments investigation' });
    const b = row({ sessionId: 'b', name: 'Billing' });
    const rows = buildSessionsTableRows(
      [a, b],
      DEFAULT_SESSIONS_TABLE_FILTERS,
      'PAYMENTS',
      'posix',
    );
    expect(rows.map((r) => r.sessionId)).toEqual(['a']);
  });

  it('matches by a prefix of the full session id', () => {
    const a = row({ sessionId: '11111111-1111-4111-8111-111111111111', name: 'A' });
    const b = row({ sessionId: '22222222-2222-4222-8222-222222222222', name: 'B' });
    const rows = buildSessionsTableRows([a, b], DEFAULT_SESSIONS_TABLE_FILTERS, '1111', 'posix');
    expect(rows.map((r) => r.sessionId)).toEqual(['11111111-1111-4111-8111-111111111111']);
  });

  it('sorts by most recent last activity first, unknown always last (D-025)', () => {
    const older = row({ sessionId: 'older', lastActivity: new Date('2026-01-01T00:00:00Z') });
    const newer = row({ sessionId: 'newer', lastActivity: new Date('2026-06-01T00:00:00Z') });
    const unknown = row({ sessionId: 'unknown', lastActivity: null });
    const rows = buildSessionsTableRows(
      [older, unknown, newer],
      DEFAULT_SESSIONS_TABLE_FILTERS,
      '',
      'posix',
    );
    expect(rows.map((r) => r.sessionId)).toEqual(['newer', 'older', 'unknown']);
  });
});

describe('buildSessionsProjectFilterOptions (V2-T68)', () => {
  it('lists each distinct project, sorted by name', () => {
    const rows = [
      row({ sessionId: 'a', projectId: 'b-project', projectName: 'Beta', adopt: null }),
      row({ sessionId: 'b', projectId: 'a-project', projectName: 'Alpha', adopt: null }),
      row({ sessionId: 'c', projectId: 'a-project', projectName: 'Alpha', adopt: null }),
      row({ sessionId: 'd' }),
    ];
    expect(buildSessionsProjectFilterOptions(rows)).toEqual([
      { value: 'a-project', label: 'Alpha' },
      { value: 'b-project', label: 'Beta' },
    ]);
  });
});

describe('buildSessionsDirectoryFilterOptions (V2-T68)', () => {
  it('collapses two differently-spelled paths to the same directory into one option', () => {
    const rows = [
      row({ sessionId: 'a', cwd: 'C:\\code\\seeya' }),
      row({ sessionId: 'b', cwd: 'c:/code/seeya' }),
      row({ sessionId: 'c', cwd: 'C:\\other' }),
    ];
    const options = buildSessionsDirectoryFilterOptions(rows, 'win32');
    expect(options).toHaveLength(2);
    expect(options.map((option) => option.dir)).toContain('C:\\code\\seeya');
  });
});

describe('resolveSessionRowAction (V2-T68)', () => {
  it('a session open in a tab is "goToTab", regardless of state', () => {
    const action = resolveSessionRowAction(row({ matchedTabId: 'tab-1', state: 'alive' }));
    expect(action).toEqual({ kind: 'goToTab', tabId: 'tab-1' });
  });

  it('a running session with no tab here is "runningElsewhere"', () => {
    expect(resolveSessionRowAction(row({ state: 'idle' }))).toEqual({ kind: 'runningElsewhere' });
  });

  it('a not-running session that belongs to a project is "projectResume" (V2-T77), never adoptable', () => {
    const action = resolveSessionRowAction(
      row({ state: 'ended', projectId: 'p', projectName: 'P', adopt: null }),
    );
    expect(action).toEqual({ kind: 'projectResume', projectId: 'p' });
  });

  it('a project session open in a tab is still "goToTab", and a running one has no action', () => {
    expect(
      resolveSessionRowAction(row({ matchedTabId: 't', projectId: 'p', projectName: 'P' })),
    ).toEqual({ kind: 'goToTab', tabId: 't' });
    expect(
      resolveSessionRowAction(row({ state: 'alive', projectId: 'p', projectName: 'P' })),
    ).toEqual({ kind: 'runningElsewhere' });
  });

  it('a not-running session with no project is "standalone", carrying its own adopt eligibility', () => {
    const action = resolveSessionRowAction(
      row({ state: 'unknown', adopt: { kind: 'unavailable', reason: 'already adopted' } }),
    );
    expect(action).toEqual({
      kind: 'standalone',
      adopt: { kind: 'unavailable', reason: 'already adopted' },
    });
  });

  it('a filter object is a plain SessionsTableFilters — sanity type check', () => {
    const filters: SessionsTableFilters = DEFAULT_SESSIONS_TABLE_FILTERS;
    expect(filters).toEqual({ state: 'all', project: 'any', directory: 'any' });
  });
});
