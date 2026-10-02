// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/preact';
import { createFakeSeeyaApi } from '../../_fake-seeya-api.js';
import { useSessions } from '../../../../../../packages/app/src/renderer/features/sessions/useSessions.js';
import { registerTabSelector } from '../../../../../../packages/app/src/renderer/features/tabs/tab-select-bridge.js';
import type { ProjectPanelOtherSessionRow } from '../../../../../../packages/app/src/state/projects-panel.js';
import type { ProjectsPanelData } from '../../../../../../packages/app/src/state/projects-panel.js';

const { openAdoptPicker } = vi.hoisted(() => ({ openAdoptPicker: vi.fn() }));
vi.mock('../../../../../../packages/app/src/renderer/legacy/adopt-flow-view.js', () => ({
  openAdoptPicker,
}));

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

  it('onAdopt opens the shared adopt picker with the session id and name', async () => {
    window.seeya = createFakeSeeyaApi({
      getProjectsPanel: vi.fn(() =>
        Promise.resolve(panelWithOtherSessions([otherSession({ sessionId: 'a', name: 'Alpha' })])),
      ),
    });
    const { result } = renderHook(() => useSessions());
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    void act(() => result.current.onAdopt(result.current.rows[0]!));
    expect(openAdoptPicker).toHaveBeenCalledWith('a', 'Alpha');
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
