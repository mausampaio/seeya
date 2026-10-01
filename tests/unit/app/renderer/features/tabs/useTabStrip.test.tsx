// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/preact';
import { createFakeSeeyaApi } from '../../_fake-seeya-api.js';
import { useTabStrip } from '../../../../../../packages/app/src/renderer/features/tabs/useTabStrip.js';
import type {
  ResumeTabOpenedEvent,
  TabDataEvent,
  TabExitEvent,
  TerminalFontConfigResponse,
} from '../../../../../../packages/app/src/ipc/channels.js';
import type { ProjectsPanelData } from '../../../../../../packages/app/src/state/projects-panel.js';

afterEach(cleanup);

const EMPTY_PANEL: ProjectsPanelData = { projects: [], otherSessionsByDirectory: [], ignoredProjects: [] };

/** A named double over the slice of `SeeyaApi` this hook actually drives — captures each
 * registered listener so a test can fire it directly, and hands back the `closeTab`/`removeTab`
 * mocks as plain local values (never read back off `window.seeya`, which
 * `@typescript-eslint/unbound-method` rightly flags for an interface shaped like methods). */
function fakeApiWithCapturedListeners() {
  let onTabData: ((event: TabDataEvent) => void) | undefined;
  let onTabExit: ((event: TabExitEvent) => void) | undefined;
  let onResumeTabOpened: ((event: ResumeTabOpenedEvent) => void) | undefined;
  const closeTab = vi.fn();
  const removeTab = vi.fn();
  window.seeya = createFakeSeeyaApi({
    getTerminalFontConfig: vi.fn(() => Promise.resolve({ fontFamily: 'monospace', fontSize: 14 })),
    getProjectsPanel: vi.fn(() => Promise.resolve(EMPTY_PANEL)),
    onProjectsUpdate: vi.fn(() => () => {}),
    onTabData: vi.fn((listener: (event: TabDataEvent) => void) => (onTabData = listener)),
    onTabExit: vi.fn((listener: (event: TabExitEvent) => void) => (onTabExit = listener)),
    onResumeTabOpened: vi.fn(
      (listener: (event: ResumeTabOpenedEvent) => void) => (onResumeTabOpened = listener),
    ),
    closeTab,
    removeTab,
  });
  return {
    closeTab,
    removeTab,
    fireTabData: (event: TabDataEvent) => onTabData?.(event),
    fireTabExit: (event: TabExitEvent) => onTabExit?.(event),
    fireResumeTabOpened: (event: ResumeTabOpenedEvent) => onResumeTabOpened?.(event),
  };
}

describe('useTabStrip (V2-T64)', () => {
  beforeEach(() => {
    window.seeya = createFakeSeeyaApi();
  });

  it('starts not ready, with no entries, nothing active, popover closed', () => {
    window.seeya = createFakeSeeyaApi({
      getTerminalFontConfig: vi.fn(() => new Promise<TerminalFontConfigResponse>(() => {})),
    });
    const { result } = renderHook(() => useTabStrip());
    expect(result.current.ready).toBe(false);
    expect(result.current.entries).toEqual([]);
    expect(result.current.activeId).toBeNull();
    expect(result.current.popoverOpen).toBe(false);
  });

  it('becomes ready once the terminal font config resolves', async () => {
    window.seeya = createFakeSeeyaApi({
      getTerminalFontConfig: vi.fn(() => Promise.resolve({ fontFamily: 'Geist Mono', fontSize: 15 })),
    });
    const { result } = renderHook(() => useTabStrip());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.fontFamily).toBe('Geist Mono');
    expect(result.current.fontSize).toBe(15);
  });

  it('openPopover/closePopover toggle popoverOpen', () => {
    const { result } = renderHook(() => useTabStrip());
    void act(() => result.current.openPopover());
    expect(result.current.popoverOpen).toBe(true);
    void act(() => result.current.closePopover());
    expect(result.current.popoverOpen).toBe(false);
  });

  it('openNewTab adds a terminal entry (the generic "terminal" icon) and makes it active', () => {
    const { result } = renderHook(() => useTabStrip());
    void act(() => result.current.openPopover());
    void act(() => result.current.openNewTab('claude', [], '/code/app'));
    expect(result.current.popoverOpen).toBe(false);
    expect(result.current.entries).toEqual([
      { id: 'tab-1', label: 'claude', icon: 'terminal', active: true, exited: false },
    ]);
    expect(result.current.activeId).toBe('tab-1');
    expect(result.current.terminalTabs[0]?.spawnRequest).toEqual({
      command: 'claude',
      args: [],
      cwd: '/code/app',
    });
  });

  it('an empty command tab is labeled "shell"', () => {
    const { result } = renderHook(() => useTabStrip());
    void act(() => result.current.openNewTab('', [], ''));
    expect(result.current.entries[0]?.label).toBe('shell');
  });

  it('a resumed session arriving over IPC shows the "balloon" icon and becomes active', () => {
    const { fireResumeTabOpened } = fakeApiWithCapturedListeners();
    const { result } = renderHook(() => useTabStrip());
    void act(() =>
      fireResumeTabOpened({ id: 'resume-1', label: 'auth fix', cwd: '/code/app', pid: 123, kind: 'session' }),
    );
    expect(result.current.entries).toEqual([
      { id: 'resume-1', label: 'auth fix', icon: 'balloon', active: true, exited: false },
    ]);
  });

  it('a project-open tab arriving over IPC shows the "folder" icon', () => {
    const { fireResumeTabOpened } = fakeApiWithCapturedListeners();
    const { result } = renderHook(() => useTabStrip());
    void act(() =>
      fireResumeTabOpened({
        id: 'resume-1',
        label: 'auth-hardening',
        cwd: '/seeya/workspace/auth-hardening',
        pid: 123,
        kind: 'project',
      }),
    );
    expect(result.current.entries[0]?.icon).toBe('folder');
  });

  it('a tab exit event marks the entry exited, with the "· exited (code N)" suffix', () => {
    const { fireTabExit } = fakeApiWithCapturedListeners();
    const { result } = renderHook(() => useTabStrip());
    void act(() => result.current.openNewTab('', [], ''));
    void act(() => fireTabExit({ id: 'tab-1', exitCode: 1 }));
    expect(result.current.entries[0]).toEqual(
      expect.objectContaining({ label: 'shell exited (code 1)', exited: true }),
    );
  });

  it('closeTab on a running tab calls closeTab over IPC and keeps the entry', () => {
    const { closeTab, removeTab } = fakeApiWithCapturedListeners();
    const { result } = renderHook(() => useTabStrip());
    void act(() => result.current.openNewTab('', [], ''));
    void act(() => result.current.closeTab('tab-1'));
    expect(closeTab).toHaveBeenCalledWith({ id: 'tab-1' });
    expect(removeTab).not.toHaveBeenCalled();
    expect(result.current.entries).toHaveLength(1);
  });

  it('closeTab on an already-exited tab removes it outright and tells main.ts', () => {
    const { removeTab, fireTabExit } = fakeApiWithCapturedListeners();
    const { result } = renderHook(() => useTabStrip());
    void act(() => result.current.openNewTab('', [], ''));
    void act(() => fireTabExit({ id: 'tab-1', exitCode: 0 }));
    void act(() => result.current.closeTab('tab-1'));
    expect(removeTab).toHaveBeenCalledWith({ id: 'tab-1' });
    expect(result.current.entries).toEqual([]);
    expect(result.current.activeId).toBeNull();
  });

  it('closing the active, already-exited tab switches activeId to the next remaining one', () => {
    const { fireTabExit } = fakeApiWithCapturedListeners();
    const { result } = renderHook(() => useTabStrip());
    void act(() => result.current.openNewTab('claude', [], ''));
    void act(() => result.current.openNewTab('codex', [], ''));
    expect(result.current.activeId).toBe('tab-2');
    void act(() => fireTabExit({ id: 'tab-2', exitCode: 0 }));
    void act(() => result.current.closeTab('tab-2'));
    expect(result.current.activeId).toBe('tab-1');
  });

  it('selectTab changes which entry is active', () => {
    const { result } = renderHook(() => useTabStrip());
    void act(() => result.current.openNewTab('claude', [], ''));
    void act(() => result.current.openNewTab('codex', [], ''));
    void act(() => result.current.selectTab('tab-1'));
    expect(result.current.activeId).toBe('tab-1');
    expect(result.current.entries.find((entry) => entry.id === 'tab-1')?.active).toBe(true);
    expect(result.current.entries.find((entry) => entry.id === 'tab-2')?.active).toBe(false);
  });

  it('incoming pty data is routed to the handle registered for that id', () => {
    const { fireTabData } = fakeApiWithCapturedListeners();
    const { result } = renderHook(() => useTabStrip());
    const write = vi.fn();
    void act(() => result.current.registerHandle('tab-1', { write, fit: vi.fn(), focus: vi.fn() }));
    void act(() => fireTabData({ id: 'tab-1', data: 'hello' }));
    expect(write).toHaveBeenCalledWith('hello');
  });

  it('onTerminalSpawned fills in the pid for the matching entry', () => {
    const { result } = renderHook(() => useTabStrip());
    void act(() => result.current.openNewTab('claude', [], ''));
    void act(() => result.current.onTerminalSpawned('tab-1', 4242));
    expect(result.current.terminalTabs[0]?.tab.pid).toBe(4242);
  });

  it('fitAll calls fit on every registered handle', () => {
    const { result } = renderHook(() => useTabStrip());
    const fitA = vi.fn();
    const fitB = vi.fn();
    void act(() => result.current.registerHandle('a', { write: vi.fn(), fit: fitA, focus: vi.fn() }));
    void act(() => result.current.registerHandle('b', { write: vi.fn(), fit: fitB, focus: vi.fn() }));
    void act(() => result.current.fitAll());
    expect(fitA).toHaveBeenCalledTimes(1);
    expect(fitB).toHaveBeenCalledTimes(1);
  });
});
