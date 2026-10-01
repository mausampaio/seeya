/**
 * The tab strip's own icon-by-type decision (V2-T64, `docs/INTERFACE.md` § 2: "ícone do tipo:
 * projeto (pasta), sessão retomada ou adotada (balão), shell (terminal), página (calendário para
 * Today, pasta para Projects, balão para Sessions)"). Pure — no Preact, no DOM — so
 * `renderer/features/tabs/TabStripItem` only ever reads a value from here, never re-derives the
 * mapping itself.
 */
import type { ResumeTabOpenedKind } from '../ipc/channels.js';
import type { PageTabKind } from '../tabs/page-tab.js';

export type TabStripIconKind = 'folder' | 'balloon' | 'terminal' | 'calendar';

/** A terminal tab's own origin: `'command'` is the New tab popover (`CHANNELS.createTab`, any of
 * claude/codex/Shell/Other… — all the same generic icon); the other two are
 * `ResumeTabOpenedKind` (`ipc/channels.ts`'s own docstring on why "resumed" and "adopted" share
 * one icon). */
export type TerminalTabOrigin = 'command' | ResumeTabOpenedKind;

/**
 * @example
 * resolveTerminalTabIcon('project'); // 'folder'
 * resolveTerminalTabIcon('session'); // 'balloon'
 * resolveTerminalTabIcon('command'); // 'terminal'
 */
export function resolveTerminalTabIcon(origin: TerminalTabOrigin): TabStripIconKind {
  switch (origin) {
    case 'project':
      return 'folder';
    case 'session':
      return 'balloon';
    case 'command':
      return 'terminal';
  }
}

/**
 * @example
 * resolvePageTabIcon('today'); // 'calendar'
 */
export function resolvePageTabIcon(kind: PageTabKind): TabStripIconKind {
  switch (kind) {
    case 'today':
      return 'calendar';
    case 'projects':
      return 'folder';
    case 'sessions':
      return 'balloon';
  }
}
