/**
 * `seeya project archive <id> [--note]` / `unarchive <id>`'s own orchestration (V2-T84,
 * `docs/INTERFACE.md` § 4b). Same read-modify-write-commit shape `project-remove-repo.ts` already
 * uses: takes the project lock for the whole operation (D-047 item 8 — an archive is a write to the
 * project's own `seeya.json`), commits with the trailers and the V2-T73 manifest-write mark (the
 * workspace's own `commit-msg` hook refuses a `seeya.json` change without it), and releases the
 * lock in a `finally`.
 *
 * Archiving changes visibility only. Nothing here (or anywhere that reads `lifecycle`) touches
 * session discovery, the End day capture, session↔project grouping or the audit.
 */
import type {
  Clock,
  ProcessControl,
  ProjectLock,
  Storage,
  WorkspaceRepository,
} from '../core/ports.js';
import type { ProjectLockInfo } from '../core/project-lock.js';
import type { ProjectLifecycle, ProjectManifest } from '../core/types.js';
import { isValidProjectId } from '../core/project-id.js';
import { buildProjectCommitMessage } from '../core/project-commit.js';
import { resolveWorkspaceRoot } from './workspace.js';
import { acquireProjectLock, releaseProjectLock } from './project-lock.js';

/** Same dependency bag as `RemoveRepositoryDeps` — the two flows differ only in which field of
 * the manifest they change. */
export interface ArchiveProjectDeps {
  readonly storage: Storage;
  readonly workspace: WorkspaceRepository;
  readonly projectLock: ProjectLock;
  readonly processControl: ProcessControl;
  readonly clock: Clock;
  readonly seeyaHome: string;
  readonly sessionId: string | undefined;
  readonly pid: number;
  readonly procStart: string | undefined;
}

/** D-024: mutually exclusive outcomes. "Already in the state asked for" is said, never committed
 * as an empty change. */
export type ArchiveProjectResult =
  | { readonly kind: 'invalidId'; readonly projectId: string }
  | { readonly kind: 'notFound'; readonly projectId: string }
  | { readonly kind: 'locked'; readonly projectId: string; readonly heldBy: ProjectLockInfo }
  | { readonly kind: 'alreadyArchived'; readonly projectId: string; readonly archivedAt: Date }
  | {
      readonly kind: 'archived';
      readonly projectId: string;
      readonly archivedAt: Date;
      readonly note: string | null;
    };

export type UnarchiveProjectResult =
  | { readonly kind: 'invalidId'; readonly projectId: string }
  | { readonly kind: 'notFound'; readonly projectId: string }
  | { readonly kind: 'locked'; readonly projectId: string; readonly heldBy: ProjectLockInfo }
  | { readonly kind: 'alreadyActive'; readonly projectId: string }
  | { readonly kind: 'unarchived'; readonly projectId: string };

/** An empty or whitespace-only note is no note (`null`), never an archived project with a blank
 * note on disk. */
export function normalizeArchiveNote(note: string | undefined): string | null {
  const trimmed = note?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

async function commitLifecycleChange(
  deps: ArchiveProjectDeps,
  root: string,
  manifest: ProjectManifest,
  lifecycle: ProjectLifecycle,
  subject: string,
): Promise<void> {
  const updated: ProjectManifest = { ...manifest, lifecycle };
  await deps.workspace.writeProjectManifest(root, manifest.id, updated);
  const message = buildProjectCommitMessage(subject, manifest.id, deps.sessionId);
  // V2-T73 item 1: this commit's own write to `seeya.json` is one of seeya's own legitimate
  // manifest writes — without the mark the commit-msg hook refuses it. `lockHolder` lets the hook
  // recognize this process as the one holding the project lock (V2-T34 hotfix).
  await deps.workspace.commitAll(
    root,
    manifest.id,
    message,
    { pid: deps.pid, procStart: deps.procStart },
    true,
  );
}

type LockOutcome =
  { readonly kind: 'held' } | { readonly kind: 'refused'; readonly heldBy: ProjectLockInfo };

async function takeLock(
  deps: ArchiveProjectDeps,
  root: string,
  projectId: string,
): Promise<LockOutcome> {
  const lock = await acquireProjectLock(
    deps,
    root,
    projectId,
    { pid: deps.pid, procStart: deps.procStart, sessionId: deps.sessionId },
    deps.clock.now(),
  );
  return lock.decision.kind === 'refuse'
    ? { kind: 'refused', heldBy: lock.decision.heldBy }
    : { kind: 'held' };
}

/**
 * @example
 * await archiveProject(deps, 'auth-hardening', 'Finished — shipped');
 */
export async function archiveProject(
  deps: ArchiveProjectDeps,
  projectId: string,
  note?: string,
): Promise<ArchiveProjectResult> {
  if (!isValidProjectId(projectId)) {
    return { kind: 'invalidId', projectId };
  }
  const root = await resolveWorkspaceRoot(deps.storage, deps.seeyaHome);
  const manifest = await deps.workspace.readProjectManifest(root, projectId);
  if (manifest === null) {
    return { kind: 'notFound', projectId };
  }
  if (manifest.lifecycle.kind === 'archived') {
    return { kind: 'alreadyArchived', projectId, archivedAt: manifest.lifecycle.archivedAt };
  }
  const lock = await takeLock(deps, root, projectId);
  if (lock.kind === 'refused') {
    return { kind: 'locked', projectId, heldBy: lock.heldBy };
  }
  try {
    const archivedAt = deps.clock.now();
    const normalizedNote = normalizeArchiveNote(note);
    await commitLifecycleChange(
      deps,
      root,
      manifest,
      { kind: 'archived', archivedAt, note: normalizedNote },
      `Archive project ${projectId}`,
    );
    return { kind: 'archived', projectId, archivedAt, note: normalizedNote };
  } finally {
    await releaseProjectLock(deps, root, projectId, deps.pid);
  }
}

/**
 * @example
 * await unarchiveProject(deps, 'auth-hardening');
 */
export async function unarchiveProject(
  deps: ArchiveProjectDeps,
  projectId: string,
): Promise<UnarchiveProjectResult> {
  if (!isValidProjectId(projectId)) {
    return { kind: 'invalidId', projectId };
  }
  const root = await resolveWorkspaceRoot(deps.storage, deps.seeyaHome);
  const manifest = await deps.workspace.readProjectManifest(root, projectId);
  if (manifest === null) {
    return { kind: 'notFound', projectId };
  }
  if (manifest.lifecycle.kind === 'active') {
    return { kind: 'alreadyActive', projectId };
  }
  const lock = await takeLock(deps, root, projectId);
  if (lock.kind === 'refused') {
    return { kind: 'locked', projectId, heldBy: lock.heldBy };
  }
  try {
    await commitLifecycleChange(
      deps,
      root,
      manifest,
      { kind: 'active' },
      `Unarchive project ${projectId}`,
    );
    return { kind: 'unarchived', projectId };
  } finally {
    await releaseProjectLock(deps, root, projectId, deps.pid);
  }
}
