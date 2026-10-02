import { describe, expect, it } from 'vitest';
import { flattenSessionsPanelRows } from '../../../../packages/app/src/state/sessions-panel.js';
import type { ProjectsPanelData } from '../../../../packages/app/src/state/projects-panel.js';
import type { ProjectPanelSessionRow } from '../../../../packages/app/src/state/projects-panel.js';

function session(overrides: Partial<ProjectPanelSessionRow> = {}): ProjectPanelSessionRow {
  return {
    sessionId: '11111111-1111-4111-8111-111111111111',
    displaySessionId: '1111',
    name: 'Payments investigation',
    cwd: '/repo/payments',
    state: 'unknown',
    stateLabel: 'no running process',
    lastActivity: null,
    matchedTabId: null,
    ...overrides,
  };
}

function panel(overrides: Partial<ProjectsPanelData> = {}): ProjectsPanelData {
  return { projects: [], otherSessionsByDirectory: [], ignoredProjects: [], ...overrides };
}

describe('flattenSessionsPanelRows (V2-T68)', () => {
  it('carries a project session with its own projectId/projectName and no adopt eligibility', () => {
    const rows = flattenSessionsPanelRows(
      panel({
        projects: [
          {
            projectId: 'auth-hardening',
            name: 'Auth hardening',
            lockText: 'unlocked',
            lock: { kind: 'unlocked' },
            sessions: [session({ sessionId: 'a' })],
            favorite: false,
            repositoryCount: 0,
            lastActivity: null,
          },
        ],
      }),
    );
    expect(rows).toEqual([
      {
        ...session({ sessionId: 'a' }),
        projectId: 'auth-hardening',
        projectName: 'Auth hardening',
        adopt: null,
      },
    ]);
  });

  it('carries an "other" session with no project and its own adopt eligibility', () => {
    const rows = flattenSessionsPanelRows(
      panel({
        otherSessionsByDirectory: [
          {
            dir: '/repo/other',
            sessionCount: 1,
            sessions: [{ ...session({ sessionId: 'b' }), adopt: { kind: 'available' } }],
          },
        ],
      }),
    );
    expect(rows).toEqual([
      {
        ...session({ sessionId: 'b' }),
        projectId: null,
        projectName: null,
        adopt: { kind: 'available' },
      },
    ]);
  });

  it('flattens every project before every "other" session, preserving each group\'s own order', () => {
    const rows = flattenSessionsPanelRows(
      panel({
        projects: [
          {
            projectId: 'p',
            name: 'P',
            lockText: 'unlocked',
            lock: { kind: 'unlocked' },
            sessions: [session({ sessionId: 'a' }), session({ sessionId: 'b' })],
            favorite: false,
            repositoryCount: 0,
            lastActivity: null,
          },
        ],
        otherSessionsByDirectory: [
          {
            dir: '/repo/other',
            sessionCount: 1,
            sessions: [{ ...session({ sessionId: 'c' }), adopt: { kind: 'available' } }],
          },
        ],
      }),
    );
    expect(rows.map((row) => row.sessionId)).toEqual(['a', 'b', 'c']);
  });

  it('an empty panel flattens to an empty list', () => {
    expect(flattenSessionsPanelRows(panel())).toEqual([]);
  });
});
