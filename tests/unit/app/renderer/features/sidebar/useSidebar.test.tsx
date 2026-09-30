// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/preact';
import { createFakeSeeyaApi } from '../../_fake-seeya-api.js';
import {
  useSidebar,
  isPageTabActive,
} from '../../../../../../packages/app/src/renderer/features/sidebar/useSidebar.js';
import type { ProjectsPanelData } from '../../../../../../packages/app/src/state/projects-panel.js';
import { pageTabId } from '../../../../../../packages/app/src/tabs/page-tab.js';

const FAVORITE_PROJECT: ProjectsPanelData = {
  projects: [
    {
      projectId: 'payments-webhooks',
      name: 'Payments webhooks',
      lockText: 'unlocked',
      sessions: [],
      favorite: true,
    },
  ],
  otherSessionsByDirectory: [],
  ignoredProjects: [],
};

beforeEach(() => {
  cleanup();
});
afterEach(cleanup);

describe('useSidebar (D-052, V2-T75)', () => {
  it('starts with an empty panel before the first push arrives', () => {
    let pushProjects: ((data: ProjectsPanelData) => void) | undefined;
    window.seeya = createFakeSeeyaApi({
      onProjectsUpdate: (listener) => {
        pushProjects = listener;
        return () => {};
      },
    });
    const { result } = renderHook(() => useSidebar());
    expect(result.current.favorites).toEqual([]);
    expect(result.current.allProjectsCount).toBe(0);
    expect(pushProjects).toBeDefined();
  });

  it('derives favorites/recent/counts from the pushed ProjectsPanelData', () => {
    let pushProjects: ((data: ProjectsPanelData) => void) | undefined;
    window.seeya = createFakeSeeyaApi({
      onProjectsUpdate: (listener) => {
        pushProjects = listener;
        return () => {};
      },
    });
    const { result } = renderHook(() => useSidebar());
    void act(() => {
      pushProjects?.(FAVORITE_PROJECT);
    });
    expect(result.current.favorites).toHaveLength(1);
    expect(result.current.favorites[0]?.name).toBe('Payments webhooks');
    expect(result.current.allProjectsCount).toBe(1);
  });

  it('openProject calls the IPC client with the project id', () => {
    const openProject = vi.fn(() => Promise.resolve({ outcomeText: '' }));
    window.seeya = createFakeSeeyaApi({ openProject });
    const { result } = renderHook(() => useSidebar());
    void act(() => {
      result.current.openProject('payments-webhooks');
    });
    expect(openProject).toHaveBeenCalledWith({ projectId: 'payments-webhooks' });
  });

  it('toggleFavorite calls the IPC client with the project id and the new value', () => {
    const toggleFavoriteProject = vi.fn(() => Promise.resolve());
    window.seeya = createFakeSeeyaApi({ toggleFavoriteProject });
    const { result } = renderHook(() => useSidebar());
    void act(() => {
      result.current.toggleFavorite('payments-webhooks', false);
    });
    expect(toggleFavoriteProject).toHaveBeenCalledWith({
      projectId: 'payments-webhooks',
      favorite: false,
    });
  });

  it('fetches the first-paint snapshot once on mount', () => {
    const getProjectsPanel = vi.fn(() =>
      Promise.resolve({ projects: [], otherSessionsByDirectory: [], ignoredProjects: [] }),
    );
    const getTodayPanel = vi.fn(() =>
      Promise.resolve({ kind: 'noBriefing' as const, message: '' }),
    );
    window.seeya = createFakeSeeyaApi({ getProjectsPanel, getTodayPanel });
    renderHook(() => useSidebar());
    expect(getProjectsPanel).toHaveBeenCalledTimes(1);
    expect(getTodayPanel).toHaveBeenCalledTimes(1);
  });
});

describe('isPageTabActive (D-052, V2-T75)', () => {
  it('matches only the active kind', () => {
    expect(isPageTabActive(pageTabId('projects'), 'projects')).toBe(true);
    expect(isPageTabActive(pageTabId('projects'), 'sessions')).toBe(false);
    expect(isPageTabActive(null, 'today')).toBe(false);
  });
});
