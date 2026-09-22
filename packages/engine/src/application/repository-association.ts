/**
 * `seeya project add-repo <id> <path>`'s own orchestration (V2-T28, `docs/PLANO-DE-ENTREGA.md`
 * item 1). Same shape `application/workspace.ts` already established for `seeya project`'s other
 * commands: resolve the workspace root, talk to `WorkspaceRepository`/`Storage`, decide with pure
 * `core/` functions in between.
 */
import path from 'node:path';
import type { DirectoryExistence, GitReader, Storage, WorkspaceRepository } from '../core/ports.js';
import type { AssociatedRepository, ProjectManifest } from '../core/types.js';
import { isValidProjectId } from '../core/project-id.js';
import { normalizeRepositoryIdentity } from '../core/repository-identity.js';
import { findAssociatedRepository } from '../core/associated-repository.js';
import { upsertRepositoryMapEntry } from '../core/repository-map.js';
import { buildProjectCommitMessage } from '../core/project-commit.js';
import { resolveWorkspaceRoot } from './workspace.js';

export interface AddRepositoryDeps {
  readonly storage: Storage;
  readonly workspace: WorkspaceRepository;
  readonly gitReader: GitReader;
  readonly directoryExistence: DirectoryExistence;
  readonly seeyaHome: string;
  /** V2-T33: same `CLAUDE_CODE_SESSION_ID` source as `application/workspace.ts
   * #WorkspaceCommandDeps.sessionId` — see that field's own docstring. */
  readonly sessionId: string | undefined;
}

/** D-024: five outcomes worth telling apart, each carrying exactly what its own case needs. */
export type AddRepositoryResult =
  | { readonly kind: 'invalidId'; readonly projectId: string }
  | { readonly kind: 'projectNotFound'; readonly projectId: string }
  | { readonly kind: 'pathNotFound'; readonly path: string }
  | { readonly kind: 'alreadyAssociated'; readonly projectId: string; readonly name: string }
  | {
      readonly kind: 'added';
      readonly projectId: string;
      readonly name: string;
      readonly hasRemote: boolean;
    };

/** Builds the `AssociatedRepository` `add-repo` records — `hasRemote: false` when `readRemoteUrl`
 * found nothing to report (no git repository at all, no `origin`, or the read failed; `GitReader
 * .readRemoteUrl`'s own docstring treats all three the same, D-025). */
function buildAssociatedRepository(name: string, remoteUrl: string | null): AssociatedRepository {
  if (remoteUrl === null) {
    return { hasRemote: false, name };
  }
  return {
    hasRemote: true,
    name,
    remote: remoteUrl,
    identity: normalizeRepositoryIdentity(remoteUrl),
  };
}

/** Persists the new repository into `seeya.json` (write + commit, same read-modify-write-commit
 * shape `application/workspace.ts#createProject` already gives the skeleton) and into this
 * device's `repository-map.json`. */
async function persistNewRepository(
  deps: AddRepositoryDeps,
  root: string,
  projectId: string,
  manifest: ProjectManifest,
  repository: AssociatedRepository,
  localPath: string,
): Promise<void> {
  const updatedManifest: ProjectManifest = {
    ...manifest,
    repositories: [...manifest.repositories, repository],
  };
  await deps.workspace.writeProjectManifest(root, projectId, updatedManifest);
  const message = buildProjectCommitMessage(
    `Add repository ${repository.name} to project ${projectId}`,
    projectId,
    deps.sessionId,
  );
  await deps.workspace.commitAll(root, projectId, message);

  const map = await deps.storage.readRepositoryMap();
  const mapEntry =
    repository.hasRemote && repository.identity !== null
      ? { hasIdentity: true as const, identity: repository.identity, path: localPath }
      : { hasIdentity: false as const, projectId, name: repository.name, path: localPath };
  await deps.storage.saveRepositoryMap(upsertRepositoryMapEntry(map, mapEntry));
}

/**
 * `docs/PLANO-DE-ENTREGA.md` V2-T28 item 1: reads the remote of the clone at `localPath` (the
 * existing git adapter, `GitReader.readRemoteUrl`), records its identity (or `hasRemote: false`)
 * on the project's `seeya.json`, and the local path on this device's `repository-map.json`. A
 * repository already associated — same identity, or same derived name when neither side has one —
 * is reported as `alreadyAssociated` instead of duplicated.
 *
 * `name` is never asked for (`add-repo <id> <path>` takes no third argument,
 * `docs/V2-RUMO.md` § "Abertura das sessões"): it's the local path's own last segment — directly
 * derivable from what was already given, not invented (docs/QUESTOES.md Q-086).
 */
export async function addRepository(
  deps: AddRepositoryDeps,
  projectId: string,
  localPath: string,
): Promise<AddRepositoryResult> {
  if (!isValidProjectId(projectId)) {
    return { kind: 'invalidId', projectId };
  }
  const root = await resolveWorkspaceRoot(deps.storage, deps.seeyaHome);
  const manifest = await deps.workspace.readProjectManifest(root, projectId);
  if (manifest === null) {
    return { kind: 'projectNotFound', projectId };
  }

  const normalizedPath = path.resolve(localPath);
  if (!(await deps.directoryExistence.exists(normalizedPath))) {
    return { kind: 'pathNotFound', path: normalizedPath };
  }

  const name = path.basename(normalizedPath);
  const remoteUrl = await deps.gitReader.readRemoteUrl(normalizedPath);
  const identity = remoteUrl === null ? null : normalizeRepositoryIdentity(remoteUrl);
  const duplicate = findAssociatedRepository(manifest.repositories, name, identity);
  if (duplicate !== null) {
    return { kind: 'alreadyAssociated', projectId, name: duplicate.name };
  }

  const repository = buildAssociatedRepository(name, remoteUrl);
  await persistNewRepository(deps, root, projectId, manifest, repository, normalizedPath);
  return { kind: 'added', projectId, name, hasRemote: repository.hasRemote };
}
