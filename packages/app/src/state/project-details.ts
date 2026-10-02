/**
 * The "Project details" dialog's own view model (V2-T83, `docs/INTERFACE.md` § 4a). Pure: every
 * port read (the manifest, this device's repository map, whether each mapped directory still
 * exists, `adoptions.json`, the file count, the lock status) already happened by the time this
 * runs — `main/project-details-ipc.ts` does the reading, same "already fetched, this module only
 * decides what to show" split `state/projects-panel.ts` draws. Nothing here is parsed back out of
 * a sentence: every fact the dialog needs is its own typed field.
 */
import { findRepositoryMapEntry } from '@seeya-ai/engine/core/repository-map.js';
import { MESSAGES } from '../text/messages.js';
import type { ProjectRowLock } from './projects-panel.js';
import type { ProjectLockStatus } from '@seeya-ai/engine/application/project-lock.js';
import { computeDisplaySessionIds } from '@seeya-ai/engine/application/session-id-display.js';
import type {
  AdoptionRecord,
  AssociatedRepository,
  ProjectManifest,
  RepositoryMapEntry,
} from '@seeya-ai/engine/core/types.js';

/** D-025: `notOnThisDevice` covers BOTH "the map has no entry" and "the map has one whose
 * directory is gone" — the dialog's own `Not on this device` line (`docs/INTERFACE.md` § 4a) says
 * the same thing for both, and `seeya project open` already treats them as one skipped repository
 * with two different warnings only because it can tell the person how to fix each. */
export type RepositoryLocalPath =
  { readonly kind: 'onThisDevice'; readonly path: string } | { readonly kind: 'notOnThisDevice' };

export interface ProjectDetailsRepositoryRow {
  readonly name: string;
  /** `null` exactly when the repository has no remote (`AssociatedRepository.hasRemote: false`) —
   * the dialog's `No remote` line, never an invented URL (D-025). */
  readonly remote: string | null;
  readonly localPath: RepositoryLocalPath;
}

export interface ProjectDetailsAdoptionRow {
  readonly originalSessionId: string;
  readonly forkSessionId: string;
  /** Short ids scoped to THIS project's adoptions (`computeDisplaySessionIds`, V2-T55 item 5's
   * own convention), never a guess at what the Sessions tab shows for the same session. */
  readonly originalDisplayId: string;
  readonly forkDisplayId: string;
  readonly adoptedAt: Date;
}

/** `blocked` carries the holder's own description (`formatLockText`'s sentence, from the engine)
 * — whether the project is open in THIS window or locked by some other session is the
 * renderer's call, since only the Projects panel row knows about open tabs. */
export type ProjectDetailsWriteAccess =
  { readonly kind: 'open' } | { readonly kind: 'blocked'; readonly heldByText: string };

export type ProjectDetailsData =
  | {
      readonly kind: 'found';
      readonly projectId: string;
      readonly name: string;
      readonly dir: string;
      readonly writeAccess: ProjectDetailsWriteAccess;
      readonly repositories: readonly ProjectDetailsRepositoryRow[];
      readonly adoptions: readonly ProjectDetailsAdoptionRow[];
      readonly fileCount: number;
    }
  | { readonly kind: 'notFound'; readonly projectId: string };

export interface ProjectDetailsInputs {
  readonly manifest: ProjectManifest;
  readonly dir: string;
  readonly lockStatus: ProjectLockStatus;
  /** Rendered holder sentence for `lockStatus` when it's `heldByLiveSession` — computed by the
   * caller with `state/projects-panel.ts#formatLockText`, the one place that wording lives. */
  readonly lockHeldByText: string;
  readonly repositoryMap: readonly RepositoryMapEntry[];
  /** Paths from `repositoryMap` that `DirectoryExistence.exists` confirmed. */
  readonly existingPaths: ReadonlySet<string>;
  readonly adoptions: readonly AdoptionRecord[];
  readonly fileCount: number;
}

function resolveLocalPath(
  projectId: string,
  repository: AssociatedRepository,
  repositoryMap: readonly RepositoryMapEntry[],
  existingPaths: ReadonlySet<string>,
): RepositoryLocalPath {
  const entry = findRepositoryMapEntry(repositoryMap, projectId, repository);
  if (entry === null || !existingPaths.has(entry.path)) {
    return { kind: 'notOnThisDevice' };
  }
  return { kind: 'onThisDevice', path: entry.path };
}

/** Every `repositoryMap` path a project's repositories resolve to — what the caller has to check
 * for existence before calling `buildProjectDetailsData`. Exported so the IPC handler asks the
 * exact same lookup question this module will answer with, never a second implementation. */
export function collectRepositoryPaths(
  projectId: string,
  repositories: readonly AssociatedRepository[],
  repositoryMap: readonly RepositoryMapEntry[],
): readonly string[] {
  const paths: string[] = [];
  for (const repository of repositories) {
    const entry = findRepositoryMapEntry(repositoryMap, projectId, repository);
    if (entry !== null) {
      paths.push(entry.path);
    }
  }
  return paths;
}

function toRepositoryRow(
  projectId: string,
  repository: AssociatedRepository,
  inputs: ProjectDetailsInputs,
): ProjectDetailsRepositoryRow {
  return {
    name: repository.name,
    remote: repository.hasRemote ? repository.remote : null,
    localPath: resolveLocalPath(projectId, repository, inputs.repositoryMap, inputs.existingPaths),
  };
}

function toAdoptionRows(
  projectId: string,
  adoptions: readonly AdoptionRecord[],
): readonly ProjectDetailsAdoptionRow[] {
  const own = adoptions.filter((record) => record.projectId === projectId);
  const displayIds = computeDisplaySessionIds(
    own.flatMap((record) => [record.originalSessionId, record.forkSessionId]),
  );
  return own.map((record) => ({
    originalSessionId: record.originalSessionId,
    forkSessionId: record.forkSessionId,
    originalDisplayId: displayIds.get(record.originalSessionId) ?? record.originalSessionId,
    forkDisplayId: displayIds.get(record.forkSessionId) ?? record.forkSessionId,
    adoptedAt: record.adoptedAt,
  }));
}

/**
 * Only a live holder blocks writes: a stale lock is reclaimed by the engine's own acquire, the same
 * reasoning `state/projects-panel.ts#ProjectRowLock` gives for reading a stale lock as unlocked.
 *
 * @example
 * buildProjectDetailsData({ manifest, dir, lockStatus: { kind: 'unlocked' }, ... }).kind // 'found'
 */
export function buildProjectDetailsData(inputs: ProjectDetailsInputs): ProjectDetailsData {
  const projectId = inputs.manifest.id;
  return {
    kind: 'found',
    projectId,
    name: inputs.manifest.name,
    dir: inputs.dir,
    writeAccess:
      inputs.lockStatus.kind === 'heldByLiveSession'
        ? { kind: 'blocked', heldByText: inputs.lockHeldByText }
        : { kind: 'open' },
    repositories: inputs.manifest.repositories.map((repository) =>
      toRepositoryRow(projectId, repository, inputs),
    ),
    adoptions: toAdoptionRows(projectId, inputs.adoptions),
    fileCount: inputs.fileCount,
  };
}

/**
 * Why the dialog's write buttons are off, or `undefined` when they are on (`docs/INTERFACE.md` §
 * 4a: "ficam desabilitadas com o motivo"). Two different reasons for the same disabled state
 * (D-024): the project's own session is open in a tab of THIS window (`row.lock.kind ===
 * 'openHere'` — the person can fix it by closing that tab), or some other live session holds it.
 * `row` is `null` when the Projects panel does not (yet) have this project: the engine's own lock
 * text is all there is then, so it is the "other session" wording.
 *
 * @example
 * resolveWriteBlockedReason({ kind: 'open' }, null) // undefined
 */
export function resolveWriteBlockedReason(
  writeAccess: ProjectDetailsWriteAccess,
  rowLock: ProjectRowLock | null,
): string | undefined {
  if (writeAccess.kind === 'open') {
    return undefined;
  }
  return rowLock?.kind === 'openHere'
    ? MESSAGES.projectDetailsLockedOpenHere
    : MESSAGES.projectDetailsLockedByOther(writeAccess.heldByText);
}
