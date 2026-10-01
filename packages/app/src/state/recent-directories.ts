/**
 * The New tab popover's own "up to three recent directories" (V2-T64, `docs/INTERFACE.md` § 2) —
 * derived, never a new persisted list (the task's own "sem chave nova em disco sem pergunta").
 *
 * **Source of evidence (D-025).** The `cwd`/`lastActivity` of every discovered session, across
 * every project AND "Other sessions" — the SAME `ProjectPanelSessionRow` evidence
 * `state/sidebar-summary.ts#buildRecentProjectRows` already uses for the lateral's own "Recent"
 * section, never a second read of disk or a new file of its own. A session with no activity
 * evidence (`lastActivity: null`) contributes nothing (D-025: absence of data never becomes a
 * directory the person never actually used recently).
 */
import type { ProjectsPanelData } from './projects-panel.js';

const MAX_RECENT_DIRECTORIES = 3;

interface DirectoryActivity {
  readonly cwd: string;
  readonly lastActivity: Date;
}

function collectDirectoryActivity(data: ProjectsPanelData): readonly DirectoryActivity[] {
  const activity: DirectoryActivity[] = [];
  for (const project of data.projects) {
    for (const session of project.sessions) {
      if (session.lastActivity !== null) {
        activity.push({ cwd: session.cwd, lastActivity: session.lastActivity });
      }
    }
  }
  for (const group of data.otherSessionsByDirectory) {
    for (const session of group.sessions) {
      if (session.lastActivity !== null) {
        activity.push({ cwd: session.cwd, lastActivity: session.lastActivity });
      }
    }
  }
  return activity;
}

/**
 * Up to `max` directories, most recently active first, never repeating one (a project with
 * several sessions in the same directory collapses to a single entry, at its most recent
 * activity).
 *
 * @example
 * buildRecentNewTabDirectories({
 *   projects: [{ ...project, sessions: [{ ...session, cwd: '/code/app', lastActivity: new Date('2026-09-30') }] }],
 *   otherSessionsByDirectory: [],
 *   ignoredProjects: [],
 * });
 * // ['/code/app']
 */
export function buildRecentNewTabDirectories(
  data: ProjectsPanelData,
  max: number = MAX_RECENT_DIRECTORIES,
): readonly string[] {
  const mostRecentByDirectory = new Map<string, Date>();
  for (const entry of collectDirectoryActivity(data)) {
    const existing = mostRecentByDirectory.get(entry.cwd);
    if (existing === undefined || entry.lastActivity > existing) {
      mostRecentByDirectory.set(entry.cwd, entry.lastActivity);
    }
  }
  return [...mostRecentByDirectory.entries()]
    .sort((a, b) => b[1].getTime() - a[1].getTime())
    .slice(0, max)
    .map(([cwd]) => cwd);
}
