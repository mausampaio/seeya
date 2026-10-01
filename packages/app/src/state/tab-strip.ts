/**
 * The tab strip's own render model (V2-T64, `docs/INTERFACE.md` § 2) — pure, no Preact: a single
 * ordered list is the whole source of truth for "what's in the strip and in what order" (a
 * terminal tab or a page tab, interleaved exactly in the order each was opened — the same order
 * the old DOM-appended buttons rendered in). `renderer/features/tabs/useTabStrip.ts` holds this as
 * component state and calls the functions here on every open/close/exit; `buildTabStripEntries`
 * is what `TabStrip.tsx` actually renders from.
 */
import { isRunning, type Tab } from '../tabs/tab-model.js';
import { pageTabId, type PageTabKind } from '../tabs/page-tab.js';
import {
  resolvePageTabIcon,
  resolveTerminalTabIcon,
  type TabStripIconKind,
  type TerminalTabOrigin,
} from './tab-strip-icon.js';
import { MESSAGES } from '../text/messages.js';

/** Set only for a tab THIS window still has to ask `main/main.ts` to spawn (the New tab popover,
 * `CHANNELS.createTab`) — `null` for one whose pty already exists by the time its `StripTab` is
 * created (a resume/project-open/adopt tab, `CHANNELS.resumeTabOpened`), which `TerminalPane`
 * never calls `createTab` for (`TerminalPane`'s own docstring). */
export interface TerminalSpawnRequest {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
}

export interface TerminalStripTab {
  readonly kind: 'terminal';
  readonly id: string;
  readonly tab: Tab;
  readonly label: string;
  readonly origin: TerminalTabOrigin;
  readonly spawnRequest: TerminalSpawnRequest | null;
}

export interface PageStripTab {
  readonly kind: 'page';
  readonly id: string;
  readonly pageKind: PageTabKind;
}

export type StripTab = TerminalStripTab | PageStripTab;

export interface TabStripEntry {
  readonly id: string;
  readonly label: string;
  readonly icon: TabStripIconKind;
  readonly active: boolean;
  /** Drives the item's own visual treatment — the `· exited` text is already baked into `label`
   * (same wording `MESSAGES.tabExited` always gave), this is for anything else that needs to know
   * without re-parsing the label (e.g. `TabStripItem`'s own dimmed styling). */
  readonly exited: boolean;
}

const PAGE_TAB_LABEL: Record<PageTabKind, string> = {
  today: MESSAGES.pageTabLabelToday,
  projects: MESSAGES.pageTabLabelProjects,
  sessions: MESSAGES.pageTabLabelSessions,
};

function terminalTabLabel(entry: TerminalStripTab): string {
  if (isRunning(entry.tab) || entry.tab.status.kind !== 'exited') {
    return entry.label;
  }
  return `${entry.label} ${MESSAGES.tabExited(entry.tab.status.exitCode)}`;
}

/**
 * @example
 * buildTabStripEntries(
 *   [{ kind: 'page', id: 'page-today', pageKind: 'today' }],
 *   'page-today',
 * );
 * // [{ id: 'page-today', label: 'Today', icon: 'calendar', active: true, exited: false }]
 */
export function buildTabStripEntries(
  tabs: readonly StripTab[],
  activeId: string | null,
): readonly TabStripEntry[] {
  return tabs.map((entry): TabStripEntry => {
    const active = entry.id === activeId;
    if (entry.kind === 'page') {
      return {
        id: entry.id,
        label: PAGE_TAB_LABEL[entry.pageKind],
        icon: resolvePageTabIcon(entry.pageKind),
        active,
        exited: false,
      };
    }
    return {
      id: entry.id,
      label: terminalTabLabel(entry),
      icon: resolveTerminalTabIcon(entry.origin),
      active,
      exited: !isRunning(entry.tab),
    };
  });
}

/** Whichever tab should become active once `removedId` is gone — the next tab after it in order,
 * same "pick whatever remains" rule the old `openTabs.keys().next().value` fallback used (`tabs-
 * view.ts`, V2-T3 review), generalized to a plain ordered array. `null` once the strip is empty. */
export function nextActiveIdAfterRemoval(
  tabs: readonly StripTab[],
  removedId: string,
): string | null {
  return tabs.find((tab) => tab.id !== removedId)?.id ?? null;
}

/** `kind`'s own page tab, if the strip already has one open — `openOrFocusPageTab` never opens a
 * second button for the same page. */
export function findOpenPageTab(
  tabs: readonly StripTab[],
  kind: PageTabKind,
): PageStripTab | undefined {
  const id = pageTabId(kind);
  return tabs.find((tab): tab is PageStripTab => tab.kind === 'page' && tab.id === id);
}
