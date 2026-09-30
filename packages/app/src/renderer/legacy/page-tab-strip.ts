/**
 * The page-tab mechanism (V2-T63, `docs/INTERFACE.md` § 2's own "abas de página") — opens or
 * focuses a Today/Projects/Sessions tab in the SAME strip and content area a terminal tab uses,
 * reusing `electron/tabs-view.ts`'s own pane registry/`showTab` (the generalization that task made
 * to its own `openTabs`-only version). A page tab's own content is a fixed `<div>` already present
 * in `app-shell.tsx` (`#page-<kind>`, hidden by default) — this module only ever shows/hides it
 * and adds/removes the tab-strip button; the DATA inside it is kept current by whichever view
 * module already owns that region (`today-panel-view.ts`, `projects-list-view.ts`,
 * `session-search-view.ts`, `other-sessions-dir-dialog-view.ts`), unchanged by this task — none of
 * them know or care whether their own container is currently visible.
 *
 * Reusable by the V2-T66 redesign of the Today tab: only the CONTENT inside `#page-today` changes
 * then, never this mechanism.
 */
import { pageTabId, type PageTabKind } from '../../tabs/page-tab.js';
import { MESSAGES } from '../../text/messages.js';
import { registerPane, showTab, tabStrip, unregisterPane } from './tabs-view.js';

const PAGE_TAB_LABEL: Record<PageTabKind, string> = {
  today: MESSAGES.pageTabLabelToday,
  projects: MESSAGES.pageTabLabelProjects,
  sessions: MESSAGES.pageTabLabelSessions,
};

/** Kept open across hide/show — `undefined` the two operations below have to check before
 * creating a duplicate button for a page tab that's merely hidden, not closed. */
const openPageTabButtons = new Map<PageTabKind, HTMLElement>();

function pagePane(kind: PageTabKind): HTMLElement {
  return document.getElementById(pageTabId(kind)) as HTMLElement;
}

function closePageTab(kind: PageTabKind): void {
  const id = pageTabId(kind);
  openPageTabButtons.get(kind)?.remove();
  openPageTabButtons.delete(kind);
  unregisterPane(id);
  pagePane(kind).hidden = true;
}

function createPageTabButton(kind: PageTabKind): HTMLElement {
  const id = pageTabId(kind);
  const wrapper = document.createElement('span');

  const button = document.createElement('button');
  button.className = 'tab-button';
  button.type = 'button';
  button.textContent = PAGE_TAB_LABEL[kind];
  button.dataset.tabId = id;
  button.addEventListener('click', () => showTab(id));
  wrapper.appendChild(button);

  const closeButton = document.createElement('button');
  closeButton.className = 'tab-close';
  closeButton.type = 'button';
  closeButton.textContent = '×';
  closeButton.addEventListener('click', () => closePageTab(kind));
  wrapper.appendChild(closeButton);

  return wrapper;
}

/**
 * Opens `kind`'s page tab (creating its button the first time, reusing it every time after) and
 * shows it — the lateral's own Today card/"All projects"/"Sessions" links (`sidebar-favorites-view.ts`)
 * and the tab-strip button itself (once created) both call this.
 *
 * @example
 * openOrFocusPageTab('projects'); // opens (or focuses) the Projects tab
 */
export function openOrFocusPageTab(kind: PageTabKind): void {
  const id = pageTabId(kind);
  if (!openPageTabButtons.has(kind)) {
    const wrapper = createPageTabButton(kind);
    tabStrip().appendChild(wrapper);
    openPageTabButtons.set(kind, wrapper);
    registerPane(id, pagePane(kind));
  }
  // `showTab` (tabs-view.ts) hides every OTHER registered pane and un-hides this one — one place
  // decides visibility, never a second `hidden = false` here racing it.
  showTab(id);
}
