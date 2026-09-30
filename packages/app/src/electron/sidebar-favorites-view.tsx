/**
 * The lateral's redesigned top (V2-T63, `docs/INTERFACE.md` § 1 items 2/3/4/5/6): the Today card,
 * Favorites, Recent, "All projects" and "Sessions". Independent of `projects-list-view.ts`/
 * `today-panel-view.ts` on purpose (their own first-paint idiom: each region fetches its own copy
 * once at startup, `window.seeya.getProjectsPanel()`/`getTodayPanel()`, then keeps itself current
 * from the matching push) — this module needs BOTH `ProjectsPanelData` and `TodayPanelData`
 * together, so it keeps its own small cache of each rather than reaching into another view
 * module's private state or depending on wiring order.
 */
import { MESSAGES } from '../text/messages.js';
import { buildTodayCardSummary } from '../state/today-panel.js';
import type { TodayPanelData } from '../state/today-panel.js';
import {
  buildFavoriteProjectRows,
  buildRecentProjectRows,
  countRunningSessions,
  type FavoriteProjectRow,
} from '../state/sidebar-summary.js';
import type { ProjectsPanelData } from '../state/projects-panel.js';
import { pageTabId, type PageTabKind } from '../tabs/page-tab.js';
import { CalendarIcon, FolderIcon, StarIcon, mountIcon } from '../ui/icons.js';
import { onActiveTabChanged } from './tabs-view.js';
import { openOrFocusPageTab } from './page-tab-strip.js';
import { triggerFavoriteToggle } from './projects-list-view.js';

let latestProjects: ProjectsPanelData | null = null;
let latestToday: TodayPanelData | null = null;

function todayCardButton(): HTMLButtonElement {
  return document.getElementById('today-card') as HTMLButtonElement;
}

/** Correction (real-window screenshot review, item 5): two lines, built as real DOM instead of a
 * single collapsed string — icon + "Today" + the "N to resume" pill (only when there IS
 * something to resume) on the first, "Plan for `<day>`"/"Nothing to resume" on the second. */
function renderTodayCard(data: TodayPanelData): void {
  const button = todayCardButton();
  const summary = buildTodayCardSummary(data);
  button.textContent = '';

  const row = document.createElement('div');
  row.className = 'today-card-row';
  const icon = document.createElement('span');
  icon.className = 'today-card-icon';
  icon.setAttribute('aria-hidden', 'true');
  // Correction (real-window screenshot review, second round): the real icon set
  // (`ui/icons.tsx`, identity § 6.4) instead of the 📅 emoji — mounted, never a second hand-drawn
  // copy of the same SVG.
  mountIcon(icon, <CalendarIcon />);
  row.appendChild(icon);
  const title = document.createElement('span');
  title.className = 'today-card-title';
  title.textContent = MESSAGES.todayCardHeading;
  row.appendChild(title);
  if (summary.kind === 'pending' && summary.resumableCount > 0) {
    const pill = document.createElement('span');
    pill.className = 'seeya-status-pill seeya-status-pill--info';
    pill.textContent = MESSAGES.todayCardResumeCount(summary.resumableCount);
    row.appendChild(pill);
  }
  button.appendChild(row);

  const subtitle = document.createElement('div');
  subtitle.className = 'today-card-subtitle';
  subtitle.textContent =
    summary.kind === 'pending'
      ? MESSAGES.todayCardPlanFor(summary.dayLabel)
      : MESSAGES.todayCardNothingToResume;
  button.appendChild(subtitle);
}

function renderFavoriteSessionRow(session: FavoriteProjectRow['sessions'][number]): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'sidebar-favorite-session-row';
  item.textContent = MESSAGES.projectSessionRowLabel(
    session.name,
    session.displaySessionId,
    session.stateLabel,
  );
  return item;
}

function renderFavoriteRow(row: FavoriteProjectRow): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'sidebar-favorite-row';

  const star = document.createElement('button');
  star.type = 'button';
  star.className = 'project-favorite-star';
  star.setAttribute('aria-pressed', 'true');
  star.setAttribute('aria-label', MESSAGES.sidebarFavoriteStarLabel(true, row.name));
  // Correction (real-window screenshot review, second round): a filled, brand-coloured
  // `<StarIcon filled/>` — identity § 6.4's own "a estrela do favorito é da cor da marca, não
  // amarela/laranja" — never the ★ glyph (rendered by the OS/browser's own emoji font, coloured
  // by CSS, but still not this project's own icon language).
  mountIcon(star, <StarIcon filled />);
  star.addEventListener('click', (event) => {
    event.stopPropagation();
    triggerFavoriteToggle(row.projectId, true);
  });
  item.appendChild(star);

  const nameButton = document.createElement('button');
  nameButton.type = 'button';
  nameButton.className = 'sidebar-favorite-name';
  nameButton.textContent = row.name;
  nameButton.dataset.projectId = row.projectId;
  item.appendChild(nameButton);

  if (row.badge !== 'none') {
    const badge = document.createElement('span');
    badge.className = `sidebar-favorite-badge sidebar-favorite-badge--${row.badge}`;
    badge.textContent =
      row.badge === 'openHere' ? MESSAGES.sidebarFavoriteOpenHere : MESSAGES.sidebarFavoriteLocked;
    item.appendChild(badge);
  }

  if (row.sessions.length > 0) {
    const sessions = document.createElement('ul');
    sessions.className = 'sidebar-favorite-sessions';
    for (const session of row.sessions) {
      sessions.appendChild(renderFavoriteSessionRow(session));
    }
    item.appendChild(sessions);
  }

  return item;
}

/** Correction (real-window screenshot review, item 3): a folder icon at the same position the
 * Favorites list's own star occupies (`.sidebar-favorite-star`'s own width/gap, mirrored by
 * `.sidebar-recent-icon` in `index.css`) — outline, tertiary colour (never the project's brand or
 * warning colour: a Recent row isn't a favorite), so the two lists' rows line up. */
function renderRecentRow(row: {
  readonly projectId: string;
  readonly name: string;
}): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'sidebar-recent-row';

  const icon = document.createElement('span');
  icon.className = 'sidebar-recent-icon';
  icon.setAttribute('aria-hidden', 'true');
  mountIcon(icon, <FolderIcon />);
  item.appendChild(icon);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sidebar-recent-name';
  button.textContent = row.name;
  button.dataset.projectId = row.projectId;
  item.appendChild(button);
  return item;
}

function render(): void {
  if (latestToday !== null) {
    renderTodayCard(latestToday);
  }
  if (latestProjects === null) {
    return;
  }

  const favoritesList = document.getElementById('favorites-list') as HTMLElement;
  favoritesList.textContent = '';
  const favorites = buildFavoriteProjectRows(latestProjects.projects);
  if (favorites.length === 0) {
    const empty = document.createElement('li');
    empty.id = 'favorites-empty';
    empty.textContent = MESSAGES.sidebarFavoritesEmpty;
    favoritesList.appendChild(empty);
  } else {
    for (const row of favorites) {
      favoritesList.appendChild(renderFavoriteRow(row));
    }
  }

  const recentList = document.getElementById('recent-list') as HTMLElement;
  recentList.textContent = '';
  const recent = buildRecentProjectRows(latestProjects.projects);
  if (recent.length === 0) {
    const empty = document.createElement('li');
    empty.id = 'recent-empty';
    empty.textContent = MESSAGES.sidebarRecentEmpty;
    recentList.appendChild(empty);
  } else {
    for (const row of recent) {
      recentList.appendChild(renderRecentRow(row));
    }
  }

  renderAllProjectsRow(latestProjects.projects.length);
  renderSessionsRow(
    countRunningSessions(latestProjects.projects, latestProjects.otherSessionsByDirectory),
  );
}

/** Correction (real-window screenshot review, item 6): icon + label + a plain right-aligned
 * total — never the combined "All projects (N)" string the earlier version rendered. The icon
 * itself (`<FolderIcon/>`) is static JSX now (`app-shell.tsx`), never touched here — this only
 * ever updates the label/count next to it. */
function renderAllProjectsRow(total: number): void {
  const row = document.getElementById('all-projects-link') as HTMLElement;
  (row.querySelector('.sidebar-nav-label') as HTMLElement).textContent =
    MESSAGES.sidebarAllProjectsLabel;
  (row.querySelector('.sidebar-nav-count') as HTMLElement).textContent = String(total);
}

/** Correction (real-window screenshot review, item 6): icon + label + the green dotted "N
 * running" pill — same `.seeya-status-pill` classes the Today card's own pill uses, tone `success`
 * when something IS running, `neutral` otherwise (never hidden: "how many are running" is the
 * fact this row exists to show, even when the answer is zero). The icon itself
 * (`<ChatBalloonIcon/>`) is static JSX now, same reasoning as `renderAllProjectsRow` above. */
function renderSessionsRow(runningCount: number): void {
  const row = document.getElementById('sessions-link') as HTMLElement;
  (row.querySelector('.sidebar-nav-label') as HTMLElement).textContent =
    MESSAGES.sidebarSessionsLabel;
  const count = row.querySelector('.sidebar-nav-count') as HTMLElement;
  count.textContent = '';
  const pill = document.createElement('span');
  pill.className = `seeya-status-pill seeya-status-pill--${runningCount > 0 ? 'success' : 'neutral'}`;
  pill.textContent = MESSAGES.sidebarSessionsCount(runningCount);
  count.appendChild(pill);
}

/** Correction (real-window screenshot review, item 6): highlights the Today card/nav row whose
 * page tab is the one currently showing — `electron/tabs-view.ts#onActiveTabChanged` is the
 * single place tab visibility changes, so this is the only listener that needs to exist. */
function updateActiveNavState(activeTabId: string): void {
  const rowByKind: Record<PageTabKind, HTMLElement> = {
    today: todayCardButton(),
    projects: document.getElementById('all-projects-link') as HTMLElement,
    sessions: document.getElementById('sessions-link') as HTMLElement,
  };
  for (const [kind, element] of Object.entries(rowByKind) as [PageTabKind, HTMLElement][]) {
    element.setAttribute('aria-current', String(pageTabId(kind) === activeTabId));
  }
}

/** Favorites/Recent rows share one delegated listener (same "one listener per list, not one per
 * button" shape `projects-list-view.ts#wireProjectOpenButtons` already uses) — a name button opens
 * the project exactly like the Projects tab's own "Open" (`triggerProjectOpen`, imported lazily via
 * dynamic import would be overkill; this module imports it directly like the star above). */
function wireFavoritesAndRecentClicks(): void {
  document.getElementById('favorites-list')?.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      '.sidebar-favorite-name',
    );
    const projectId = button?.dataset.projectId;
    if (projectId !== undefined) {
      void window.seeya.openProject({ projectId });
    }
  });
  document.getElementById('recent-list')?.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.sidebar-recent-name');
    const projectId = button?.dataset.projectId;
    if (projectId !== undefined) {
      void window.seeya.openProject({ projectId });
    }
  });
}

/** Wired once, at startup, AFTER `today-panel-view.ts#wireTodayIncomingEvents` and
 * `projects-list-view.ts#wireProjectsListView` (`renderer.ts#main`'s own ordering) — this module
 * fetches its own first-paint copies regardless, so the order only matters for nothing racing it;
 * it's kept this way to match the established idiom every other region here follows. */
export function wireSidebarFavorites(): void {
  onActiveTabChanged(updateActiveNavState);
  todayCardButton().addEventListener('click', () => openOrFocusPageTab('today'));
  document
    .getElementById('all-projects-link')
    ?.addEventListener('click', () => openOrFocusPageTab('projects'));
  document
    .getElementById('sessions-link')
    ?.addEventListener('click', () => openOrFocusPageTab('sessions'));
  wireFavoritesAndRecentClicks();

  window.seeya.onProjectsUpdate((data) => {
    latestProjects = data;
    render();
  });
  window.seeya.onTodayUpdate((data) => {
    latestToday = data;
    render();
  });
  void window.seeya.getProjectsPanel().then((data) => {
    latestProjects = data;
    render();
  });
  void window.seeya.getTodayPanel().then((data) => {
    latestToday = data;
    render();
  });
}
