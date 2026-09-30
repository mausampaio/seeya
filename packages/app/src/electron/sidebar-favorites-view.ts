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
import { openOrFocusPageTab } from './page-tab-strip.js';
import { triggerFavoriteToggle } from './projects-list-view.js';

let latestProjects: ProjectsPanelData | null = null;
let latestToday: TodayPanelData | null = null;

function todayCardButton(): HTMLButtonElement {
  return document.getElementById('today-card') as HTMLButtonElement;
}

function renderTodayCard(data: TodayPanelData): void {
  const button = todayCardButton();
  const summary = buildTodayCardSummary(data);
  button.textContent =
    summary.kind === 'pending' && summary.resumableCount > 0
      ? `${summary.titleText} — ${MESSAGES.todayCardResumeCount(summary.resumableCount)}`
      : summary.titleText;
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
  star.textContent = '★';
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

function renderRecentRow(row: {
  readonly projectId: string;
  readonly name: string;
}): HTMLLIElement {
  const item = document.createElement('li');
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

  (document.getElementById('all-projects-link') as HTMLButtonElement).textContent =
    MESSAGES.sidebarAllProjectsLink(latestProjects.projects.length);
  const runningCount = countRunningSessions(
    latestProjects.projects,
    latestProjects.otherSessionsByDirectory,
  );
  (document.getElementById('sessions-link') as HTMLButtonElement).textContent =
    MESSAGES.sidebarSessionsLink(runningCount);
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
