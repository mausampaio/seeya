/**
 * The lateral's own Favorites/Recent/counts (V2-T63, `docs/INTERFACE.md` § 1 items 3/4/5/6) — pure
 * projections over `ProjectsPanelData` (`state/projects-panel.ts`), the same data the Projects/
 * Sessions page tabs already render, never a second fetch of its own.
 *
 * **"Recent"'s own source of "last activity" (D-025).** A project's last activity here is the
 * MOST RECENT `lastActivity` among its own sessions (`ProjectPanelSessionRow.lastActivity`, the
 * same evidence-based timestamp `sidebar/sidebar-data.ts` already derives from the discovered
 * session's transcript — never a new read of its own). A project with no discovered session
 * evidence at all has no last activity and is simply excluded from "Recent" — never guessed from
 * something this module has no real evidence for, such as the manifest file's own mtime or the
 * workspace's git history (neither of which `ProjectsPanelData` carries today).
 */
import type { ProjectPanelRow } from './projects-panel.js';

/** V2-T63 item 3 — one row per favorited project (`ProjectPanelRow.favorite`). `openHere`/`locked`
 * mirror the lateral's own two lock badges: `openHere` when one of this project's own sessions is
 * matched to a tab in THIS window (`matchedTabId !== null`, the same evidence `sidebar-data.ts`
 * already computed), `locked` when the lock isn't simply "unlocked" and no session here is open,
 * `none` otherwise. The project open in this window ALSO carries its own sessions, indented
 * (`docs/INTERFACE.md`'s own "recuadas") — every other favorite carries an empty list. */
export type FavoriteLockBadge = 'openHere' | 'locked' | 'none';

export interface FavoriteProjectRow {
  readonly projectId: string;
  readonly name: string;
  readonly badge: FavoriteLockBadge;
  readonly sessions: ProjectPanelRow['sessions'];
}

function resolveFavoriteLockBadge(project: ProjectPanelRow): FavoriteLockBadge {
  if (project.sessions.some((session) => session.matchedTabId !== null)) {
    return 'openHere';
  }
  return project.lockText === 'unlocked' ? 'none' : 'locked';
}

/**
 * @example
 * buildFavoriteProjectRows([{ ...project, favorite: true }]);
 * // [{ projectId: 'auth-hardening', name: 'Auth hardening', badge: 'none', sessions: [] }]
 */
export function buildFavoriteProjectRows(
  projects: readonly ProjectPanelRow[],
): readonly FavoriteProjectRow[] {
  return projects
    .filter((project) => project.favorite)
    .map((project) => {
      const badge = resolveFavoriteLockBadge(project);
      return {
        projectId: project.projectId,
        name: project.name,
        badge,
        sessions: badge === 'openHere' ? project.sessions : [],
      };
    });
}

export interface RecentProjectRow {
  readonly projectId: string;
  readonly name: string;
  readonly lastActivity: Date;
}

/** This module's own docstring explains why a project with no session evidence never appears
 * here — `null` is that "no evidence" case, never a fabricated instant. */
function mostRecentSessionActivity(project: ProjectPanelRow): Date | null {
  let latest: Date | null = null;
  for (const session of project.sessions) {
    if (session.lastActivity !== null && (latest === null || session.lastActivity > latest)) {
      latest = session.lastActivity;
    }
  }
  return latest;
}

const MAX_RECENT_PROJECTS = 5;

/**
 * V2-T63 item 4 — up to 5 projects by last activity, never repeating a favorite (principle 2:
 * "a lateral mostra só o atalho" — a favorite already has its own, permanent shortcut).
 *
 * @example
 * buildRecentProjectRows([nonFavoriteWithActivity, favoriteWithActivity]);
 * // only nonFavoriteWithActivity, even if it were less recent
 */
export function buildRecentProjectRows(
  projects: readonly ProjectPanelRow[],
): readonly RecentProjectRow[] {
  const withActivity: RecentProjectRow[] = [];
  for (const project of projects) {
    if (project.favorite) {
      continue;
    }
    const lastActivity = mostRecentSessionActivity(project);
    if (lastActivity !== null) {
      withActivity.push({ projectId: project.projectId, name: project.name, lastActivity });
    }
  }
  return withActivity
    .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime())
    .slice(0, MAX_RECENT_PROJECTS);
}

/** V2-T63 item 6 — "Sessions (N running)": every session across every project plus "Other
 * sessions", counting only the ones with a running process (`alive`/`unknown` is never counted —
 * `unknown` means "no pid to check", never "running", D-016/D-025). */
export function countRunningSessions(
  projects: readonly ProjectPanelRow[],
  otherSessionsByDirectory: readonly { readonly sessions: readonly { readonly state: string }[] }[],
): number {
  let running = 0;
  for (const project of projects) {
    running += project.sessions.filter(
      (session) => session.state === 'alive' || session.state === 'idle',
    ).length;
  }
  for (const group of otherSessionsByDirectory) {
    running += group.sessions.filter(
      (session) => session.state === 'alive' || session.state === 'idle',
    ).length;
  }
  return running;
}
