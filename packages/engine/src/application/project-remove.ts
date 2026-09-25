/**
 * `seeya project remove <id>`'s own orchestration (V2-T32, item 1). Same shape `application/
 * project-open.ts`/`project-adopt.ts` already established for a command that takes the project
 * lock for the whole of a synchronous operation and releases it before returning (D-047 item 8:
 * "recusam quando outra sessão viva segura o lock; com o lock livre, tomam e soltam no fim, como o
 * open") — the difference here is there is no harness to launch in between: the lock's own holder
 * is this `seeya` invocation's own `pid`/`procStart`, never a generated session id (nothing new is
 * spawned).
 *
 * **Never touches anything outside `root/projectId` itself** (item 4: "nunca apaga repositório
 * associado, sessão ou transcript") — `WorkspaceRepository.removeProjectDirectory` has no path to
 * reach any of those, and this module never calls anything else that could.
 */
import type {
  Clock,
  ProcessControl,
  ProjectLock,
  Storage,
  WorkspaceRepository,
} from '../core/ports.js';
import type { ProjectLockInfo } from '../core/project-lock.js';
import type { AdoptionRecord } from '../core/types.js';
import { isValidProjectId } from '../core/project-id.js';
import { buildProjectCommitMessage } from '../core/project-commit.js';
import { resolveWorkspaceRoot } from './workspace.js';
import { acquireProjectLock, releaseProjectLock } from './project-lock.js';

export interface RemoveProjectDeps {
  readonly storage: Storage;
  readonly workspace: WorkspaceRepository;
  readonly projectLock: ProjectLock;
  readonly processControl: ProcessControl;
  readonly clock: Clock;
  readonly seeyaHome: string;
  /** Same `CLAUDE_CODE_SESSION_ID` source as `application/workspace.ts
   * #WorkspaceCommandDeps.sessionId` — this invocation's own commit trailer AND the project lock's
   * own holder (there is no separate launched session here, unlike `adopt`/`open`). */
  readonly sessionId: string | undefined;
  /** This `seeya project remove` invocation's own process — it runs start to finish inside one
   * synchronous command, so its liveness IS the lock's liveness for the whole operation. */
  readonly pid: number;
  readonly procStart: string | undefined;
}

/** D-025: `unavailable` (no interactive terminal to ask through) is never folded into `decline` —
 * same three-way shape every other confirmation in this package already uses. */
export type ConfirmRemoveProjectAnswer = 'proceed' | 'decline' | 'unavailable';

export type ConfirmRemoveProject = (info: {
  readonly projectId: string;
  readonly name: string;
  readonly fileCount: number;
}) => Promise<ConfirmRemoveProjectAnswer>;

export interface RemoveProjectCallbacks {
  /** `undefined` behaves exactly like `'unavailable'` (D-025: never a silent removal) — every
   * production caller (`cli/project-command.ts`) always supplies one. */
  readonly confirmRemove?: ConfirmRemoveProject;
}

/** V2-T32 item 7: one adoption `remove` dropped from `adoptions.json` — the original session named
 * here is now adoptable again; the fork it names is untouched (item 7's own "não apaga as
 * cópias"). */
export interface RemovedAdoptionSummary {
  readonly originalSessionId: string;
  readonly forkSessionId: string;
}

export type RemoveProjectResult =
  | { readonly kind: 'invalidId'; readonly projectId: string }
  | { readonly kind: 'notFound'; readonly projectId: string }
  | { readonly kind: 'projectLocked'; readonly projectId: string; readonly heldBy: ProjectLockInfo }
  | { readonly kind: 'confirmationDeclined'; readonly projectId: string }
  | { readonly kind: 'confirmationUnavailable'; readonly projectId: string }
  | {
      readonly kind: 'removed';
      readonly projectId: string;
      readonly fileCount: number;
      /** Item 1: "diz em uma linha como recuperar (o commit anterior)" — `null` only in the
       * unreachable-in-practice case of a workspace with zero commits at all (D-025: a project that
       * exists already required at least a creation commit). */
      readonly previousCommit: string | null;
      readonly removedAdoptions: readonly RemovedAdoptionSummary[];
    };

async function confirmRemove(
  callbacks: RemoveProjectCallbacks | undefined,
  projectId: string,
  name: string,
  fileCount: number,
): Promise<ConfirmRemoveProjectAnswer> {
  if (callbacks?.confirmRemove === undefined) {
    return 'unavailable';
  }
  return callbacks.confirmRemove({ projectId, name, fileCount });
}

/** Item 7: drops every `adoptions.json` entry for `projectId` — the originals they name become
 * adoptable again simply by no longer having a record here (`core/adoption-registry.ts
 * #findAdoptionRecord`'s own lookup). Never touches the promoted copies themselves (item 7's own
 * "não apaga as cópias"; item 4's own "nunca apaga... sessão"). */
async function dropProjectAdoptions(
  storage: Storage,
  projectId: string,
): Promise<readonly RemovedAdoptionSummary[]> {
  const all = await storage.readAdoptions();
  const [removed, kept] = partitionByProject(all, projectId);
  if (removed.length === 0) {
    return [];
  }
  await storage.saveAdoptions(kept);
  return removed.map((record) => ({
    originalSessionId: record.originalSessionId,
    forkSessionId: record.forkSessionId,
  }));
}

function partitionByProject(
  records: readonly AdoptionRecord[],
  projectId: string,
): [AdoptionRecord[], AdoptionRecord[]] {
  const removed: AdoptionRecord[] = [];
  const kept: AdoptionRecord[] = [];
  for (const record of records) {
    (record.projectId === projectId ? removed : kept).push(record);
  }
  return [removed, kept];
}

/** The tail of `removeProject`, after the lock is already acquired and the confirmation already
 * said yes — extracted so `removeProject` itself stays a straight-line sequence (AGENTS.md §
 * "Retorno cedo"). Always releases the lock before returning. */
async function finishRemoval(
  deps: RemoveProjectDeps,
  root: string,
  projectId: string,
  fileCount: number,
): Promise<RemoveProjectResult> {
  const previousCommit = await deps.workspace.currentCommit(root);
  await deps.workspace.removeProjectDirectory(root, projectId);
  const message = buildProjectCommitMessage(
    `Remove project ${projectId}`,
    projectId,
    deps.sessionId,
  );
  await deps.workspace.commitAll(root, projectId, message);
  const removedAdoptions = await dropProjectAdoptions(deps.storage, projectId);
  await releaseProjectLock(deps, root, projectId, deps.pid);
  return { kind: 'removed', projectId, fileCount, previousCommit, removedAdoptions };
}

/**
 * @example
 * const result = await removeProject(deps, 'auth-hardening', {
 *   confirmRemove: ({ name, fileCount }) => askThePerson(name, fileCount),
 * });
 */
export async function removeProject(
  deps: RemoveProjectDeps,
  projectId: string,
  callbacks?: RemoveProjectCallbacks,
): Promise<RemoveProjectResult> {
  if (!isValidProjectId(projectId)) {
    return { kind: 'invalidId', projectId };
  }
  const root = await resolveWorkspaceRoot(deps.storage, deps.seeyaHome);
  const manifest = await deps.workspace.readProjectManifest(root, projectId);
  if (manifest === null) {
    return { kind: 'notFound', projectId };
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

  const fileCount = await deps.workspace.countProjectFiles(root, projectId);
  const answer = await confirmRemove(callbacks, projectId, manifest.name, fileCount);
  if (answer !== 'proceed') {
    await releaseProjectLock(deps, root, projectId, deps.pid);
    return {
      kind: answer === 'decline' ? 'confirmationDeclined' : 'confirmationUnavailable',
      projectId,
    };
  }

  return finishRemoval(deps, root, projectId, fileCount);
}
