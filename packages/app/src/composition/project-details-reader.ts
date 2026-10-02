/**
 * Reads everything the "Project details" dialog shows (V2-T83, `docs/INTERFACE.md` § 4a) from the
 * ports an `AppContext` already holds, and hands it to the pure `state/project-details.ts`. Lives
 * in `composition/` (not in `main/project-details-ipc.ts`) so it can be exercised for real, with
 * no `electron` import in the way — `main/` is the one place that cannot run without a display.
 *
 * Read-only: nothing here writes, takes a lock or spawns anything — the dialog refetches this after
 * every action and on every Projects-panel push, so it has to be cheap and side-effect free.
 */
import path from 'node:path';
import { resolveWorkspaceRoot } from '@seeya-ai/engine/application/workspace.js';
import { describeProjectLockStatus } from '@seeya-ai/engine/application/project-lock.js';
import { formatLockText } from '../state/projects-panel.js';
import {
  buildProjectDetailsData,
  collectRepositoryPaths,
  type ProjectDetailsData,
} from '../state/project-details.js';
import type { AppContext } from './index.js';

/**
 * @example
 * const details = await readProjectDetails(context, 'auth-hardening');
 */
export async function readProjectDetails(
  context: AppContext,
  projectId: string,
): Promise<ProjectDetailsData> {
  const root = await resolveWorkspaceRoot(context.storage, context.home.seeyaHome);
  const manifest = await context.workspace.readProjectManifest(root, projectId);
  if (manifest === null) {
    return { kind: 'notFound', projectId };
  }
  const lockStatus = await describeProjectLockStatus(
    { projectLock: context.projectLock, processControl: context.processControl },
    root,
    projectId,
  );
  const repositoryMap = await context.storage.readRepositoryMap();
  const existingPaths = new Set<string>();
  for (const mappedPath of collectRepositoryPaths(
    projectId,
    manifest.repositories,
    repositoryMap,
  )) {
    if (await context.directoryExistence.exists(mappedPath)) {
      existingPaths.add(mappedPath);
    }
  }
  return buildProjectDetailsData({
    manifest,
    dir: path.join(root, projectId),
    lockStatus,
    lockHeldByText: formatLockText(lockStatus),
    repositoryMap,
    existingPaths,
    adoptions: await context.storage.readAdoptions(),
    fileCount: await context.workspace.countProjectFiles(root, projectId),
  });
}
