/**
 * The tab strip's own state and IPC wiring (V2-T64, `docs/INTERFACE.md` § 2) — replaces
 * `renderer/legacy/tabs-view.ts`/`renderer/legacy/page-tab-strip.ts` (apagados by this task).
 * Mounted once, as part of `<TabStrip/>`, for the life of the window — exactly like the module-
 * level `openTabs` map the legacy file used to keep, just as component state now.
 *
 * **Why a `Map<string, TerminalHandle>` ref, not React state, for the xterm instances
 * themselves.** A `@xterm/xterm` `Terminal` is an imperative, mutable object with no sensible
 * immutable snapshot — `TerminalPane` owns the instance, this hook only needs a way to reach
 * "write this data", "re-fit", "focus" for a given id, from cross-cutting triggers (incoming pty
 * data, switching the active tab, a window resize) that live above any single pane.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { getSeeyaApi } from '../../ipc/client.js';
import type { TerminalFontConfigResponse, ResumeTabOpenedEvent } from '../../../ipc/channels.js';
import { createTab, isRunning, markExited, withPid } from '../../../tabs/tab-model.js';
import { pageTabId, type PageTabKind } from '../../../tabs/page-tab.js';
import {
  buildTabStripEntries,
  findOpenPageTab,
  nextActiveIdAfterRemoval,
  type StripTab,
  type TabStripEntry,
  type TerminalStripTab,
} from '../../../state/tab-strip.js';
import type { ProjectsPanelData } from '../../../state/projects-panel.js';
import { buildRecentNewTabDirectories } from '../../../state/recent-directories.js';
import { setActiveTabId } from './active-tab-registry.js';
import { registerPageTabOpener } from './page-tab-bridge.js';
import { registerActiveTabFocuser } from './focus-bridge.js';
import { registerTabSelector } from './tab-select-bridge.js';
import type { TerminalHandle } from './TerminalPane/index.js';

export interface TabStripData {
  readonly ready: boolean;
  readonly entries: readonly TabStripEntry[];
  readonly terminalTabs: readonly TerminalStripTab[];
  readonly activeId: string | null;
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly popoverOpen: boolean;
  readonly recentDirectories: readonly string[];
  readonly selectTab: (id: string) => void;
  readonly closeTab: (id: string) => void;
  readonly openPopover: () => void;
  readonly closePopover: () => void;
  readonly openNewTab: (command: string, args: readonly string[], cwd: string) => void;
  readonly registerHandle: (id: string, handle: TerminalHandle) => void;
  readonly unregisterHandle: (id: string) => void;
  readonly onTerminalSpawned: (id: string, pid: number) => void;
  /** Re-fits every open terminal to its (now current) container size — `TabStrip.tsx`'s own
   * `ResizeObserver` on `#terminal-host` calls this, same V2-T30/V2-T48 item 6 reasoning the
   * legacy file's own `fitAllOpenTabs` had (a sidebar collapse/resize reflows the host without
   * ever firing `window`'s own `resize` event). */
  readonly fitAll: () => void;
}

const AWAITING_FIRST_PROJECTS_PANEL: ProjectsPanelData = {
  projects: [],
  otherSessionsByDirectory: [],
  ignoredProjects: [],
};

/** Fetches `TerminalFontConfigResponse` once, at mount — no tab can open before this resolves
 * (the "+" button stays disabled, `TabStrip.tsx`'s own `ready` check), mirroring the ordering
 * `renderer.tsx#main` used to enforce by wiring the command bar only after this same fetch. */
function useTerminalFontConfig(): TerminalFontConfigResponse | null {
  const [config, setConfig] = useState<TerminalFontConfigResponse | null>(null);
  useEffect(() => {
    void getSeeyaApi().getTerminalFontConfig().then(setConfig);
  }, []);
  return config;
}

/** Fetched once and kept current by `onProjectsUpdate` — the same evidence the lateral's own
 * "Recent" section already reads, never a second disk read of its own
 * (`state/recent-directories.ts`'s own docstring). */
function useRecentDirectories(): readonly string[] {
  const [panel, setPanel] = useState<ProjectsPanelData>(AWAITING_FIRST_PROJECTS_PANEL);
  useEffect(() => {
    const api = getSeeyaApi();
    const unsubscribe = api.onProjectsUpdate(setPanel);
    void api.getProjectsPanel().then(setPanel);
    return unsubscribe;
  }, []);
  return buildRecentNewTabDirectories(panel);
}

export function useTabStrip(): TabStripData {
  const api = getSeeyaApi();
  const fontConfig = useTerminalFontConfig();
  const recentDirectories = useRecentDirectories();
  const [stripTabs, setStripTabs] = useState<readonly StripTab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const handlesRef = useRef(new Map<string, TerminalHandle>());
  const nextCommandTabIdRef = useRef(0);
  const activeIdRef = useRef<string | null>(null);

  // Mirrors the active tab out to `useSidebar.ts` (`active-tab-registry.ts`'s own docstring) —
  // never fired for `null` (no tab ever open yet), same as the legacy `onActiveTabChanged`.
  useEffect(() => {
    activeIdRef.current = activeId;
    if (activeId !== null) {
      setActiveTabId(activeId);
    }
  }, [activeId]);

  // Registered once — `renderer.tsx#main` feeds this to `dialog-focus-return.ts`'s own
  // `registerActiveTerminalFocuser`, so closing any dialog returns focus here. Reads `activeIdRef`
  // (never `activeId` directly), since this effect only runs once and would otherwise always
  // focus whichever tab was active at MOUNT time.
  useEffect(() => {
    registerActiveTabFocuser(() => {
      const id = activeIdRef.current;
      if (id !== null) {
        handlesRef.current.get(id)?.focus();
      }
    });
  }, []);

  // Re-measures and re-focuses whichever tab just became active — the same `showTab`'s own
  // `fitAddon.fit()`/`terminal.focus()` pair the legacy file called on every switch. A page tab
  // has no handle, so this is a no-op for one.
  useEffect(() => {
    if (activeId === null) {
      return;
    }
    const handle = handlesRef.current.get(activeId);
    handle?.fit();
    handle?.focus();
  }, [activeId]);

  useEffect(() => {
    api.onTabData(({ id, data }) => handlesRef.current.get(id)?.write(data));
    api.onTabExit(({ id, exitCode }) => {
      setStripTabs((prev) =>
        prev.map((tab) =>
          tab.kind === 'terminal' && tab.id === id
            ? { ...tab, tab: markExited(tab.tab, exitCode) }
            : tab,
        ),
      );
    });
    api.onResumeTabOpened((event: ResumeTabOpenedEvent) => {
      setStripTabs((prev) => [
        ...prev,
        {
          kind: 'terminal',
          id: event.id,
          tab: withPid(
            createTab({ id: event.id, command: 'claude', args: [], cwd: event.cwd }),
            event.pid,
          ),
          label: event.label,
          origin: event.kind,
          spawnRequest: null,
        },
      ]);
      setActiveId(event.id);
    });
    registerPageTabOpener(openOrFocusPageTab);
    // V2-T67: registered here, once, for the Projects tab's own "Go to tab" row action
    // (`tab-select-bridge.ts`'s own docstring) — `setActiveId` is this hook's own state setter,
    // the exact function `selectTab` (`TabStripData`, below) already exposes to `TabStrip.tsx`.
    registerTabSelector(setActiveId);
    // Mounts once, for the life of the window — same lifetime the legacy module-level listeners
    // had; `window.seeya.onTabData`/`onTabExit`/`onResumeTabOpened` have no unsubscribe of their
    // own (`main/preload.ts`'s own docstring on why only six `onXUpdate` methods do), and this
    // component never unmounts in practice (`<TabStrip/>` is part of `<App/>`'s own root tree).
  }, []);

  function openOrFocusPageTab(kind: PageTabKind): void {
    const id = pageTabId(kind);
    setStripTabs((prev) =>
      findOpenPageTab(prev, kind) ? prev : [...prev, { kind: 'page', id, pageKind: kind }],
    );
    setActiveId(id);
  }

  function removeStripTab(id: string): void {
    const next = stripTabs.filter((tab) => tab.id !== id);
    setStripTabs(next);
    handlesRef.current.delete(id);
    if (activeId === id) {
      setActiveId(nextActiveIdAfterRemoval(stripTabs, id));
    }
  }

  function closeTab(id: string): void {
    const entry = stripTabs.find((tab) => tab.id === id);
    if (entry === undefined) {
      return;
    }
    if (entry.kind === 'page') {
      removeStripTab(id);
      return;
    }
    if (isRunning(entry.tab)) {
      // V2-T2: closing a LIVE tab ends its process; the tab itself stays visible (the exit
      // handler above marks it) until the process really exits.
      api.closeTab({ id });
      return;
    }
    // V2-T3 item 2: the process already exited — × now removes the tab outright. Tells main.ts
    // too (`CHANNELS.removeTab`'s own docstring: otherwise a reused pid could match a stale
    // entry).
    removeStripTab(id);
    api.removeTab({ id });
  }

  /** Called by the New tab popover with the ALREADY-resolved command (`tabs/new-tab-kind.ts
   * #resolveNewTabCommand` — the popover's own job, so it stays the one place that knows about
   * `NewTabKind` at all). `label` mirrors the old command-bar tab's own rule: the literal command,
   * or "shell" for the empty-string default. */
  function openNewTab(command: string, args: readonly string[], cwd: string): void {
    nextCommandTabIdRef.current += 1;
    const id = `tab-${nextCommandTabIdRef.current}`;
    const label = command === '' ? 'shell' : command;
    setStripTabs((prev) => [
      ...prev,
      {
        kind: 'terminal',
        id,
        tab: createTab({ id, command, args, cwd }),
        label,
        origin: 'command',
        spawnRequest: { command, args, cwd },
      },
    ]);
    setActiveId(id);
    setPopoverOpen(false);
  }

  return {
    ready: fontConfig !== null,
    entries: buildTabStripEntries(stripTabs, activeId),
    terminalTabs: stripTabs.filter((tab): tab is TerminalStripTab => tab.kind === 'terminal'),
    activeId,
    fontFamily: fontConfig?.fontFamily ?? '',
    fontSize: fontConfig?.fontSize ?? 14,
    popoverOpen,
    recentDirectories,
    selectTab: setActiveId,
    closeTab,
    openPopover: () => setPopoverOpen(true),
    closePopover: () => setPopoverOpen(false),
    openNewTab,
    registerHandle: (id, handle) => handlesRef.current.set(id, handle),
    unregisterHandle: (id) => handlesRef.current.delete(id),
    onTerminalSpawned: (id, pid) =>
      setStripTabs((prev) =>
        prev.map((tab) =>
          tab.kind === 'terminal' && tab.id === id ? { ...tab, tab: withPid(tab.tab, pid) } : tab,
        ),
      ),
    fitAll: () => {
      for (const handle of handlesRef.current.values()) {
        handle.fit();
      }
    },
  };
}
