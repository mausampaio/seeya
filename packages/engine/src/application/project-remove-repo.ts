/**
 * `seeya project remove-repo <id> <name>`'s own orchestration (V2-T32, item 2). Same
 * read-modify-write-commit shape `application/repository-association.ts#addRepository` already
 * uses for the opposite direction, plus the lock take/release D-047 item 8 asks of every command
 * that writes a project's own `seeya.json` this task adds.
 */
import type {
  Clock,
  ProcessControl,
  ProjectLock,
  Storage,
  WorkspaceRepository,
} from '../core/ports.js';
import type { ProjectLockInfo } from '../core/project-lock.js';
import type { AssociatedRepository, ProjectManifest, RepositoryIdentity } from '../core/types.js';
import { isValidProjectId } from '../core/project-id.js';
import { repositoryIdentitiesEqual } from '../core/repository-identity.js';
import { buildProjectCommitMessage } from '../core/project-commit.js';
import { resolveWorkspaceRoot } from './workspace.js';
import { acquireProjectLock, releaseProjectLock } from './project-lock.js';

export interface RemoveRepositoryDeps {
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

export type RemoveRepositoryResult =
  | { readonly kind: 'invalidId'; readonly projectId: string }
  | { readonly kind: 'projectNotFound'; readonly projectId: string }
  | { readonly kind: 'projectLocked'; readonly projectId: string; readonly heldBy: ProjectLockInfo }
  | { readonly kind: 'repositoryNotFound'; readonly projectId: string; readonly name: string }
  | { readonly kind: 'removed'; readonly projectId: string; readonly name: string };

/**
 * Item 2: "a entrada no mapa do dispositivo só sai se nenhum outro projeto usar a mesma
 * identidade." A repository WITHOUT an identity is keyed by `projectId`+`name` alone
 * (`core/types.ts#RepositoryMapEntryWithoutIdentity`'s own docstring) — nothing else could ever
 * reference that exact pair, so it's dropped unconditionally once this project stops associating
 * it.
 */
async function isIdentityUsedElsewhere(
  deps: RemoveRepositoryDeps,
  root: string,
  projectId: string,
  identity: RepositoryIdentity,
): Promise<boolean> {
  const { manifests } = await deps.workspace.listProjects(root);
  return manifests.some(
    (manifest) =>
      manifest.id !== projectId &&
      manifest.repositories.some(
        (repository) =>
          repository.hasRemote &&
          repository.identity !== null &&
          repositoryIdentitiesEqual(repository.identity, identity),
      ),
  );
}

/** Item 2: a repository WITHOUT a remote is keyed by `projectId`+`name` alone
 * (`core/types.ts#RepositoryMapEntryWithoutIdentity`'s own docstring) — nothing else could ever
 * reference that exact pair, so its map entry is dropped unconditionally once this project stops
 * associating it. */
async function pruneEntryWithoutIdentity(
  deps: RemoveRepositoryDeps,
  projectId: string,
  name: string,
): Promise<void> {
  const map = await deps.storage.readRepositoryMap();
  const kept = map.filter(
    (entry) => !(!entry.hasIdentity && entry.projectId === projectId && entry.name === name),
  );
  if (kept.length !== map.length) {
    await deps.storage.saveRepositoryMap(kept);
  }
}

/** Item 2: "só sai se nenhum outro projeto usar a mesma identidade" — an identity-keyed entry is
 * global (the same remote may back more than one project's association on this device), so it's
 * only dropped once no OTHER project's manifest still references it. */
async function pruneEntryWithIdentity(
  deps: RemoveRepositoryDeps,
  root: string,
  projectId: string,
  identity: RepositoryIdentity,
): Promise<void> {
  if (await isIdentityUsedElsewhere(deps, root, projectId, identity)) {
    return;
  }
  const map = await deps.storage.readRepositoryMap();
  const kept = map.filter(
    (entry) => !(entry.hasIdentity && repositoryIdentitiesEqual(entry.identity, identity)),
  );
  if (kept.length !== map.length) {
    await deps.storage.saveRepositoryMap(kept);
  }
}

async function pruneRepositoryMapEntry(
  deps: RemoveRepositoryDeps,
  root: string,
  projectId: string,
  removed: AssociatedRepository,
): Promise<void> {
  if (!removed.hasRemote) {
    await pruneEntryWithoutIdentity(deps, projectId, removed.name);
    return;
  }
  if (removed.identity === null) {
    // D-025: an identity that was never resolved was never keyed into the map either
    // (`application/repository-association.ts#persistNewRepository`'s own `mapEntry` branch only
    // keys a `hasRemote: true` repository when `identity` is non-null) — nothing to prune.
    return;
  }
  await pruneEntryWithIdentity(deps, root, projectId, removed.identity);
}

async function writeManifestWithoutRepository(
  deps: RemoveRepositoryDeps,
  root: string,
  projectId: string,
  manifest: ProjectManifest,
  name: string,
): Promise<void> {
  const updated: ProjectManifest = {
    ...manifest,
    repositories: manifest.repositories.filter((repository) => repository.name !== name),
  };
  await deps.workspace.writeProjectManifest(root, projectId, updated);
  const message = buildProjectCommitMessage(
    `Remove repository ${name} from project ${projectId}`,
    projectId,
    deps.sessionId,
  );
  // V2-T34 hotfix (PO review, 2026-09-25): same lock-holder authorization `project-remove.ts
  // #finishRemoval` already needs, for the identical reason.
  await deps.workspace.commitAll(root, projectId, message, {
    pid: deps.pid,
    procStart: deps.procStart,
  });
}

/**
 * @example
 * await removeRepository(deps, 'auth-hardening', 'app-api');
 */
export async function removeRepository(
  deps: RemoveRepositoryDeps,
  projectId: string,
  name: string,
): Promise<RemoveRepositoryResult> {
  if (!isValidProjectId(projectId)) {
    return { kind: 'invalidId', projectId };
  }
  const root = await resolveWorkspaceRoot(deps.storage, deps.seeyaHome);
  const manifest = await deps.workspace.readProjectManifest(root, projectId);
  if (manifest === null) {
    return { kind: 'projectNotFound', projectId };
  }
  const target = manifest.repositories.find((repository) => repository.name === name);
  if (target === undefined) {
    return { kind: 'repositoryNotFound', projectId, name };
  }

  const lock = await acquireProjectLock(
    deps,
    root,
    projectId,
    { pid: deps.pid, procStart: deps.procStart, sessionId: deps.sessionId },
    deps.clock.now(),
  );
  if (lock.decision.kind === 'refuse') {
    return { kind: 'projectLocked', projectId, heldBy: lock.decision.heldBy };
  }

  // V2-T34 production defect (PO review, 2026-09-25): same guaranteed-release fix as
  // `application/project-open.ts#openProject`/`project-remove.ts#removeProject` — `commitAll`
  // (inside `writeManifestWithoutRepository`) can throw for the same reason `project-adopt.ts
  // #commitAdoption`'s did. Idempotent alongside the explicit release below
  // (`core/project-lock.ts#decideProjectLockRelease`).
  try {
    await writeManifestWithoutRepository(deps, root, projectId, manifest, name);
    await pruneRepositoryMapEntry(deps, root, projectId, target);
    await releaseProjectLock(deps, root, projectId, deps.pid);
    return { kind: 'removed', projectId, name };
  } finally {
    await releaseProjectLock(deps, root, projectId, deps.pid);
  }
}
