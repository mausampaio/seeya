// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/preact';
import { createFakeSeeyaApi } from '../../_fake-seeya-api.js';
import { useProjects } from '../../../../../../packages/app/src/renderer/features/projects/useProjects.js';
import { registerTabSelector } from '../../../../../../packages/app/src/renderer/features/tabs/tab-select-bridge.js';
import type { ProjectPanelRow } from '../../../../../../packages/app/src/state/projects-panel.js';
import type { ResumeTabOpenedEvent } from '../../../../../../packages/app/src/ipc/channels.js';

afterEach(cleanup);

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

describe('useProjects (V2-T67)', () => {
  it('fetches the panel at mount and exposes its projects as rows', async () => {
    window.seeya = createFakeSeeyaApi({
      getProjectsPanel: vi.fn(() =>
        Promise.resolve({
          projects: [project()],
          otherSessionsByDirectory: [],
          ignoredProjects: [],
        }),
      ),
    });
    const { result } = renderHook(() => useProjects());
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
  });

  it('filter/query narrow the rows', async () => {
    window.seeya = createFakeSeeyaApi({
      getProjectsPanel: vi.fn(() =>
        Promise.resolve({
          projects: [
            project({ projectId: 'a', name: 'Alpha' }),
            project({ projectId: 'b', name: 'Beta' }),
          ],
          otherSessionsByDirectory: [],
          ignoredProjects: [],
        }),
      ),
    });
    const { result } = renderHook(() => useProjects());
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    void act(() => result.current.setQuery('alpha'));
    await waitFor(() => expect(result.current.rows.map((row) => row.projectId)).toEqual(['a']));
  });

  it('a "goToTab" row action selects the tab, never calling openProject', () => {
    const selector = vi.fn();
    registerTabSelector(selector);
    const openProject = vi.fn();
    window.seeya = createFakeSeeyaApi({ openProject });
    const { result } = renderHook(() => useProjects());
    const row = project({ lock: { kind: 'openHere', tabId: 'tab-7' } });
    void act(() => result.current.onRowAction(row));
    expect(selector).toHaveBeenCalledWith('tab-7');
    expect(openProject).not.toHaveBeenCalled();
  });

  it('an "open" row action calls openProject and marks it pending until the promise settles', async () => {
    let resolveOpen: (() => void) | undefined;
    const openProject = vi.fn(
      () =>
        new Promise<{ outcomeText: string }>((resolve) => {
          resolveOpen = () => resolve({ outcomeText: '' });
        }),
    );
    window.seeya = createFakeSeeyaApi({ openProject });
    const { result } = renderHook(() => useProjects());
    const row = project({ lock: { kind: 'unlocked' } });
    void act(() => result.current.onRowAction(row));
    expect(openProject).toHaveBeenCalledWith({ projectId: 'auth-hardening' });
    await waitFor(() => expect(result.current.isRowActionPending(row)).toBe(true));
    resolveOpen?.();
    await waitFor(() => expect(result.current.isRowActionPending(row)).toBe(false));
  });

  it('a tab opening for the project clears pending before the openProject promise ever settles', async () => {
    // V2-T77: `useProjects` now registers TWO listeners (its own, plus `useProjectSessionResume`'s)
    // — the tab event reaches every one of them, as the real `ipcRenderer.on` does.
    const listeners: ((event: ResumeTabOpenedEvent) => void)[] = [];
    const onResumeTabOpened = (event: ResumeTabOpenedEvent): void =>
      listeners.forEach((listener) => listener(event));
    const openProject = vi.fn(() => new Promise<{ outcomeText: string }>(() => {}));
    window.seeya = createFakeSeeyaApi({
      openProject,
      onResumeTabOpened: vi.fn((listener: (event: ResumeTabOpenedEvent) => void) => {
        listeners.push(listener);
      }),
    });
    const { result } = renderHook(() => useProjects());
    const row = project({ lock: { kind: 'unlocked' } });
    void act(() => result.current.onRowAction(row));
    await waitFor(() => expect(result.current.isRowActionPending(row)).toBe(true));
    void act(() =>
      onResumeTabOpened?.({
        id: 'tab-1',
        label: row.projectId,
        cwd: '/repo',
        pid: 4242,
        kind: 'project',
      }),
    );
    await waitFor(() => expect(result.current.isRowActionPending(row)).toBe(false));
  });

  it('toggling favorite calls toggleFavoriteProject with the flipped value', () => {
    const toggleFavoriteProject = vi.fn(() => Promise.resolve());
    window.seeya = createFakeSeeyaApi({ toggleFavoriteProject });
    const { result } = renderHook(() => useProjects());
    void act(() => result.current.onToggleFavorite('auth-hardening', true));
    expect(toggleFavoriteProject).toHaveBeenCalledWith({
      projectId: 'auth-hardening',
      favorite: true,
    });
  });
});
