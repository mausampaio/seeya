// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/preact';
import { createFakeSeeyaApi } from '../../_fake-seeya-api.js';
import { useSessions } from '../../../../../../packages/app/src/renderer/features/sessions/useSessions.js';
import { showProjectSessionsInSessionsTab } from '../../../../../../packages/app/src/renderer/features/sessions/sessions-filter-bridge.js';
import { registerTabSelector } from '../../../../../../packages/app/src/renderer/features/tabs/tab-select-bridge.js';
import type { ProjectPanelOtherSessionRow } from '../../../../../../packages/app/src/state/projects-panel.js';
import type { ProjectsPanelData } from '../../../../../../packages/app/src/state/projects-panel.js';

const { openAdoptionDialog } = vi.hoisted(() => ({ openAdoptionDialog: vi.fn() }));
vi.mock(
  '../../../../../../packages/app/src/renderer/features/adoption/adoption-dialog-bridge.js',
  () => ({
    openAdoptionDialog,
  }),
);

afterEach(cleanup);

function otherSession(
  overrides: Partial<ProjectPanelOtherSessionRow> = {},
): ProjectPanelOtherSessionRow {
  return {
    sessionId: '11111111-1111-4111-8111-111111111111',
    displaySessionId: '1111',
    name: 'Payments investigation',
    cwd: '/repo/payments',
    state: 'unknown',
    stateLabel: 'no running process',
    lastActivity: null,
    matchedTabId: null,
    adopt: { kind: 'available' },
    ...overrides,
  };
}

function panelWithOtherSessions(
  sessions: readonly ProjectPanelOtherSessionRow[],
): ProjectsPanelData {
  return {
    projects: [],
    otherSessionsByDirectory:
      sessions.length === 0
        ? []
        : [{ dir: sessions[0]!.cwd, sessionCount: sessions.length, sessions }],
    ignoredProjects: [],
  };
}

describe('useSessions (V2-T68)', () => {
  it('fetches the panel at mount and flattens it into rows', async () => {
    window.seeya = createFakeSeeyaApi({
      getProjectsPanel: vi.fn(() =>
        Promise.resolve(panelWithOtherSessions([otherSession({ sessionId: 'a' })])),
      ),
    });
    const { result } = renderHook(() => useSessions());
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(result.current.totalCount).toBe(1);
  });

  it('a "goToTab" row action selects the tab, never calling resumeSession', async () => {
    const selector = vi.fn();
    registerTabSelector(selector);
    const resumeSession = vi.fn();
    const row = otherSession({ matchedTabId: 'tab-7' });
    window.seeya = createFakeSeeyaApi({
      getProjectsPanel: vi.fn(() => Promise.resolve(panelWithOtherSessions([row]))),
      resumeSession,
    });
    const { result } = renderHook(() => useSessions());
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    void act(() => result.current.onRowAction(result.current.rows[0]!));
    expect(selector).toHaveBeenCalledWith('tab-7');
    expect(resumeSession).not.toHaveBeenCalled();
  });

  it('a "standalone" row action calls resumeSession and marks it pending until it settles', async () => {
    let resolveResume: (() => void) | undefined;
    const resumeSession = vi.fn(
      () =>
        new Promise<{ resumed: boolean }>((resolve) => {
          resolveResume = () => resolve({ resumed: true });
        }),
    );
    window.seeya = createFakeSeeyaApi({
      getProjectsPanel: vi.fn(() =>
        Promise.resolve(panelWithOtherSessions([otherSession({ sessionId: 'a' })])),
      ),
      resumeSession,
    });
    const { result } = renderHook(() => useSessions());
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    const row = result.current.rows[0]!;
    void act(() => result.current.onRowAction(row));
    expect(resumeSession).toHaveBeenCalledWith({
      sessionId: row.sessionId,
      cwd: row.cwd,
      name: row.name,
    });
    await waitFor(() => expect(result.current.isResumePending(row)).toBe(true));
    resolveResume?.();
    await waitFor(() => expect(result.current.isResumePending(row)).toBe(false));
  });

  it('a "projectResume" row action calls the project resume channel, never the simple resumeSession (V2-T77)', async () => {
    const resumeSession = vi.fn();
    const resumeProjectSession = vi.fn(() =>
      Promise.resolve({ outcomeText: 'refused', resumed: false }),
    );
    const session = {
      sessionId: '33333333-3333-4333-8333-333333333333',
      displaySessionId: '33333333',
      name: 'auth-hardening',
      cwd: '/ws/auth-hardening',
      state: 'ended' as const,
      stateLabel: 'ended',
      lastActivity: null,
      matchedTabId: null,
    };
    const panel: ProjectsPanelData = {
      projects: [
        {
          projectId: 'auth-hardening',
          name: 'Auth hardening',
          lockText: 'unlocked',
          lock: { kind: 'unlocked' },
          sessions: [session],
          favorite: false,
          repositoryCount: 0,
          lastActivity: null,
        },
      ],
      otherSessionsByDirectory: [],
      ignoredProjects: [],
    };
    window.seeya = createFakeSeeyaApi({
      getProjectsPanel: vi.fn(() => Promise.resolve(panel)),
      resumeSession,
      resumeProjectSession,
    });
    const { result } = renderHook(() => useSessions());
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    void act(() => result.current.onRowAction(result.current.rows[0]!));
    expect(resumeProjectSession).toHaveBeenCalledWith({
      projectId: 'auth-hardening',
      sessionId: session.sessionId,
    });
    expect(resumeSession).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.resumeResult?.text).toBe('refused'));
  });

  it('"Show all in Sessions" filters to the project and clears the query (V2-T77)', async () => {
    window.seeya = createFakeSeeyaApi({
      getProjectsPanel: vi.fn(() =>
        Promise.resolve(panelWithOtherSessions([otherSession({ sessionId: 'a' })])),
      ),
    });
    const { result } = renderHook(() => useSessions());
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    void act(() => result.current.setQuery('zzz'));
    void act(() => showProjectSessionsInSessionsTab('auth-hardening'));
    expect(result.current.filters.project).toBe('auth-hardening');
    expect(result.current.query).toBe('');
  });

  it('onAdopt opens the single adoption dialog with the session card', async () => {
    window.seeya = createFakeSeeyaApi({
      getProjectsPanel: vi.fn(() =>
        Promise.resolve(panelWithOtherSessions([otherSession({ sessionId: 'a', name: 'Alpha' })])),
      ),
    });
    const { result } = renderHook(() => useSessions());
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    const row = result.current.rows[0]!;
    void act(() => result.current.onAdopt(row));
    expect(openAdoptionDialog).toHaveBeenCalledWith({
      sessionId: row.sessionId,
      name: row.name,
      displaySessionId: row.displaySessionId,
      cwd: row.cwd,
      state: row.state,
      stateLabel: row.stateLabel,
    });
  });

  it('a query shaped like an id, with no local match, falls back to the direct lookup', async () => {
    const found = otherSession({ sessionId: 'ffff', displaySessionId: 'ffff', name: 'Found' });
    const findSessionById = vi.fn(() =>
      Promise.resolve({ kind: 'found' as const, session: found }),
    );
    window.seeya = createFakeSeeyaApi({
      getProjectsPanel: vi.fn(() =>
        Promise.resolve(panelWithOtherSessions([otherSession({ sessionId: 'aaaa' })])),
      ),
      findSessionById,
    });
    const { result } = renderHook(() => useSessions());
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    void act(() => result.current.setQuery('ffff'));
    await waitFor(() => expect(result.current.directSearch.kind).toBe('found'));
    expect(findSessionById).toHaveBeenCalledWith({ idOrPrefix: 'ffff' });
    expect(result.current.rows).toEqual([{ ...found, projectId: null, projectName: null }]);
  });

  it('a query matching a known session never triggers the direct lookup', async () => {
    const findSessionById = vi.fn();
    window.seeya = createFakeSeeyaApi({
      getProjectsPanel: vi.fn(() =>
        Promise.resolve(panelWithOtherSessions([otherSession({ sessionId: 'abcdabcd' })])),
      ),
      findSessionById,
    });
    const { result } = renderHook(() => useSessions());
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    void act(() => result.current.setQuery('abcd'));
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(findSessionById).not.toHaveBeenCalled();
  });
});
