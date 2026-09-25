/**
 * Groups the sidebar's discovered sessions by project — the lateral's own "Projects" section
 * (V2-T30 item 1). Pure: takes already-computed `SidebarRow`s (`sidebar-data.ts`, the same rows the
 * flat sidebar already builds every refresh tick) plus already-read `adoptions.json` entries and
 * lock holders, no I/O of its own.
 *
 * **A session belongs to a project only by evidence (D-025), never by associated repository** — a
 * repository can serve more than one project, so it carries no membership signal at all here:
 *
 * - its `cwd` is the project's own directory (compared via `core/cwd-normalization.ts`, so a
 *   different separator/case/trailing slash still matches), or
 * - it is the fork session registered in `adoptions.json` for that project (`AdoptionRecord
 *   .forkSessionId` — never `originalSessionId`: the ORIGINAL never moves into the project, only
 *   its promoted copy does), or
 * - it holds that project's own lock (`ProjectLockInfo.sessionId`, when known — an unidentified
 *   lock holder, D-025, matches nothing here).
 *
 * A session matching none of the above lands in "Other sessions" instead — never guessed into a
 * project it merely happens to share a repository, a name, or a moment in time with.
 */
import {
  normalizeCwdForComparison,
  type PathPlatformHint,
} from '@seeya-ai/engine/core/cwd-normalization.js';
import type { AdoptionRecord, SessionState } from '@seeya-ai/engine/core/types.js';
import type { SidebarRow } from './sidebar-data.js';

export interface ProjectDirectory {
  readonly projectId: string;
  readonly dir: string;
}

/** `AdoptionRecord.forkSessionId`s, grouped by the project they were adopted into — built once per
 * call, reused for every project/session pair `groupSessionsByProject` below checks, rather than
 * re-scanning the whole `adoptions.json` list per session. */
function forkSessionIdsByProject(
  adoptions: readonly AdoptionRecord[],
): ReadonlyMap<string, ReadonlySet<string>> {
  const map = new Map<string, Set<string>>();
  for (const adoption of adoptions) {
    const set = map.get(adoption.projectId) ?? new Set<string>();
    set.add(adoption.forkSessionId);
    map.set(adoption.projectId, set);
  }
  return map;
}

function sessionBelongsToProject(
  row: SidebarRow,
  project: ProjectDirectory,
  forksByProject: ReadonlyMap<string, ReadonlySet<string>>,
  lockSessionIdByProjectId: ReadonlyMap<string, string>,
  platform: PathPlatformHint,
): boolean {
  if (
    normalizeCwdForComparison(row.cwd, platform) ===
    normalizeCwdForComparison(project.dir, platform)
  ) {
    return true;
  }
  if (forksByProject.get(project.projectId)?.has(row.sessionId) === true) {
    return true;
  }
  return lockSessionIdByProjectId.get(project.projectId) === row.sessionId;
}

export interface ProjectSessionGrouping {
  readonly sessionsByProjectId: ReadonlyMap<string, readonly SidebarRow[]>;
  readonly otherSessions: readonly SidebarRow[];
}

/**
 * @example
 * const grouping = groupSessionsByProject(
 *   rows,
 *   [{ projectId: 'auth-hardening', dir: '/seeya/workspace/auth-hardening' }],
 *   adoptions,
 *   new Map([['auth-hardening', '11111111-1111-4111-8111-111111111111']]),
 *   'posix',
 * );
 */
export function groupSessionsByProject(
  rows: readonly SidebarRow[],
  projects: readonly ProjectDirectory[],
  adoptions: readonly AdoptionRecord[],
  lockSessionIdByProjectId: ReadonlyMap<string, string>,
  platform: PathPlatformHint,
): ProjectSessionGrouping {
  const forksByProject = forkSessionIdsByProject(adoptions);
  const sessionsByProjectId = new Map<string, SidebarRow[]>();
  for (const project of projects) {
    sessionsByProjectId.set(project.projectId, []);
  }
  const otherSessions: SidebarRow[] = [];
  for (const row of rows) {
    const matched = projects.find((project) =>
      sessionBelongsToProject(row, project, forksByProject, lockSessionIdByProjectId, platform),
    );
    if (matched === undefined) {
      otherSessions.push(row);
      continue;
    }
    sessionsByProjectId.get(matched.projectId)?.push(row);
  }
  return { sessionsByProjectId, otherSessions };
}

/** D-024: never a boolean — a disabled "Adopt…" always names why (item 5: "sessão viva mostra a
 * ação desabilitada com o motivo"). */
export type AdoptEligibility =
  { readonly kind: 'available' } | { readonly kind: 'unavailable'; readonly reason: string };

/** The two fields `resolveAdoptEligibility` actually reads — a structural subset of `SidebarRow`
 * (never the whole thing: this function has no use for `cwd`/`matchedTabId`/etc.), so a caller
 * with only a bare `DiscoveredSession` plus a freshly classified `state` (V2-T55's own id-search
 * result, `state/session-search.ts`) can call it too, without building a fake `SidebarRow`. */
export interface AdoptEligibilityInput {
  readonly sessionId: string;
  readonly state: SessionState;
}

/**
 * Mirrors `application/project-adopt.ts#checkAdoptionPreconditions`'s two refusals (running right
 * now; already adopted elsewhere) for display purposes only — `adoptSession` itself is still the
 * one that enforces them; this is what lets the list show the reason BEFORE a click would fail.
 */
export function resolveAdoptEligibility(
  row: AdoptEligibilityInput,
  adoptions: readonly AdoptionRecord[],
): AdoptEligibility {
  if (row.state === 'alive' || row.state === 'idle') {
    return {
      kind: 'unavailable',
      reason: 'running right now — resuming it here would open a second copy',
    };
  }
  const existing = adoptions.find((adoption) => adoption.originalSessionId === row.sessionId);
  if (existing !== undefined) {
    return { kind: 'unavailable', reason: `already adopted into project "${existing.projectId}"` };
  }
  return { kind: 'available' };
}

export interface OtherSessionDirectoryGroup {
  readonly dir: string;
  readonly sessionCount: number;
  readonly sessions: readonly SidebarRow[];
}

/**
 * V2-T55 item 2 — groups "Other sessions" by directory instead of one row per session: with many
 * Claude Code sessions on a machine, a flat list of every one became the exact problem the
 * maintainer hit on Ubuntu ("a lista fica confusa"). Grouped by NORMALIZED `cwd` (same criterion
 * `sessionBelongsToProject` above already uses), so a different separator/case/trailing slash still
 * collapses into one directory; the group's own `dir` is the first row's un-normalized spelling
 * (display only — never used for comparison again). Sorted by directory name for a stable listing.
 */
export function groupOtherSessionsByDirectory(
  otherSessions: readonly SidebarRow[],
  platform: PathPlatformHint,
): readonly OtherSessionDirectoryGroup[] {
  const byNormalizedDir = new Map<string, { dir: string; sessions: SidebarRow[] }>();
  for (const row of otherSessions) {
    const key = normalizeCwdForComparison(row.cwd, platform);
    const existing = byNormalizedDir.get(key);
    if (existing === undefined) {
      byNormalizedDir.set(key, { dir: row.cwd, sessions: [row] });
    } else {
      existing.sessions.push(row);
    }
  }
  return [...byNormalizedDir.values()]
    .map((group) => ({
      dir: group.dir,
      sessionCount: group.sessions.length,
      sessions: group.sessions,
    }))
    .sort((a, b) => a.dir.localeCompare(b.dir));
}
