/**
 * Pure operations over `RepositoryMapEntry[]` (V2-T28, `core/types.ts`) — `repository-map.json`'s
 * in-memory shape, before `Storage.readRepositoryMap`/`saveRepositoryMap` ever touch a disk. Kept
 * separate from `adapters/storage/repository-map-schema.ts` the same way `core/project-id.ts` is
 * kept separate from any adapter: this is the logic every caller of that port shares
 * (`application/repository-association.ts#addRepository`, `application/project-open.ts
 * #openProject`), and it needs no I/O to be correct.
 */
import type { AssociatedRepository, RepositoryMapEntry } from './types.js';
import { repositoryIdentitiesEqual } from './repository-identity.js';

/**
 * Two entries name the same local resolution slot: same identity when both have one, or same
 * `projectId`+`name` when neither does. An entry WITH an identity never matches one WITHOUT — the
 * two live in disjoint key spaces (`RepositoryMapEntry`'s own docstring).
 */
export function repositoryMapEntriesMatch(a: RepositoryMapEntry, b: RepositoryMapEntry): boolean {
  if (a.hasIdentity && b.hasIdentity) {
    return repositoryIdentitiesEqual(a.identity, b.identity);
  }
  if (!a.hasIdentity && !b.hasIdentity) {
    return a.projectId === b.projectId && a.name === b.name;
  }
  return false;
}

/**
 * Replaces whatever entry `entries` already had for `entry`'s own key (per
 * `repositoryMapEntriesMatch`) with `entry` itself, or appends it when there was none — never
 * grows the list with a second entry for the same key.
 *
 * @example
 * upsertRepositoryMapEntry([], { hasIdentity: false, projectId: 'p', name: 'api', path: '/a' })
 * // [{ hasIdentity: false, projectId: 'p', name: 'api', path: '/a' }]
 */
export function upsertRepositoryMapEntry(
  entries: readonly RepositoryMapEntry[],
  entry: RepositoryMapEntry,
): RepositoryMapEntry[] {
  const withoutMatch = entries.filter((existing) => !repositoryMapEntriesMatch(existing, entry));
  return [...withoutMatch, entry];
}

/**
 * Finds `repo`'s local path on this device, if `add-repo` ever recorded one — `null` when it
 * never did (`docs/PLANO-DE-ENTREGA.md` V2-T28 item 4: `open` has to tell those two cases apart,
 * this function is the lookup it's built on). A repository with an `identity` is looked up
 * globally (by identity alone, `projectId` never enters the comparison — the same remote may have
 * been registered from a different project on this device); a repository without one is scoped to
 * `projectId`, its only handle.
 */
export function findRepositoryMapEntry(
  entries: readonly RepositoryMapEntry[],
  projectId: string,
  repo: AssociatedRepository,
): RepositoryMapEntry | null {
  if (repo.hasRemote && repo.identity !== null) {
    const identity = repo.identity;
    return (
      entries.find(
        (entry) => entry.hasIdentity && repositoryIdentitiesEqual(entry.identity, identity),
      ) ?? null
    );
  }
  return (
    entries.find(
      (entry) => !entry.hasIdentity && entry.projectId === projectId && entry.name === repo.name,
    ) ?? null
  );
}
