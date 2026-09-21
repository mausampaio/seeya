/**
 * `seeya project create`/`list`/`show`'s own orchestration (V2-T27, `docs/PLANO-DE-ENTREGA.md` §
 * "Projetos — o recorte"). Same shape `application/schedule-adjustments.ts` already established
 * for a use case that reads a port, decides with a pure `core/` function, and writes back: this
 * module is the one layer both `cli/` and, later, `app/` (D-043) can import, so neither
 * composition root reimplements "resolve the workspace root, then talk to `WorkspaceRepository`"
 * on its own.
 */
import path from 'node:path';
import type { RejectedDiscoveryRecord, Storage, WorkspaceRepository } from '../core/ports.js';
import type { ProjectManifest } from '../core/types.js';
import { isValidProjectId } from '../core/project-id.js';
import { buildProjectSkeleton } from '../core/project-skeleton.js';

export interface WorkspaceCommandDeps {
  readonly storage: Storage;
  readonly workspace: WorkspaceRepository;
  /** `CliHome.seeyaHome` (`packages/cli/src/composition.ts`) — only ever used to build the
   * DEFAULT workspace root (`path.join(seeyaHome, 'workspace')`) the first time this runs on a
   * device; once a root is persisted, `resolveWorkspaceRoot` never looks at this again. */
  readonly seeyaHome: string;
}

/**
 * `docs/PLANO-DE-ENTREGA.md`'s own words: "onde o espaço de trabalho mora, perguntado uma vez e
 * guardado em `~/.seeya/`... Padrão: uma pasta dentro do próprio `~/.seeya/`." This task's minimal
 * reading of "perguntado uma vez" (docs/QUESTOES.md Q-085): resolved and persisted the first time
 * any `seeya project` command needs it, not a live interactive question — a real guided prompt is
 * `seeya init`'s own, explicitly deferred scope (`docs/PLANO-DE-ENTREGA.md` S5-T2: "adiada para a
 * fronteira da v2"). Idempotent: once `Storage.readWorkspaceRoot` returns non-`null`, this never
 * writes again.
 *
 * @example
 * const root = await resolveWorkspaceRoot(storage, seeyaHome); // e.g. "<seeyaHome>/workspace"
 */
export async function resolveWorkspaceRoot(storage: Storage, seeyaHome: string): Promise<string> {
  const saved = await storage.readWorkspaceRoot();
  if (saved !== null) {
    return saved;
  }
  const defaultRoot = path.join(seeyaHome, 'workspace');
  await storage.saveWorkspaceRoot(defaultRoot);
  return defaultRoot;
}

/**
 * D-024: a discriminated union, not a `{ created: boolean; reason?: string }` — the three outcomes
 * `seeya project create` can report are mutually exclusive, and each carries exactly what its own
 * case needs (`root` only when a project was actually written).
 */
export type CreateProjectResult =
  | { readonly kind: 'created'; readonly projectId: string; readonly root: string }
  | { readonly kind: 'invalidId'; readonly projectId: string }
  | { readonly kind: 'alreadyExists'; readonly projectId: string };

/**
 * `seeya project create <id>` (item 2 of the task's spec): validates `projectId`, resolves (and,
 * the first time, initializes) the workspace repository, refuses a duplicate, then writes the
 * skeleton and commits — one commit per project created, `docs/PLANO-DE-ENTREGA.md`'s own
 * acceptance line: "o histórico do espaço de trabalho com um commit por criação".
 */
export async function createProject(
  deps: WorkspaceCommandDeps,
  projectId: string,
): Promise<CreateProjectResult> {
  if (!isValidProjectId(projectId)) {
    return { kind: 'invalidId', projectId };
  }
  const root = await resolveWorkspaceRoot(deps.storage, deps.seeyaHome);
  if (!(await deps.workspace.isInitialized(root))) {
    await deps.workspace.initialize(root);
  }
  if (await deps.workspace.projectExists(root, projectId)) {
    return { kind: 'alreadyExists', projectId };
  }
  const skeleton = buildProjectSkeleton(projectId);
  await deps.workspace.writeProjectSkeleton(root, projectId, skeleton);
  await deps.workspace.commitAll(root, `Create project ${projectId}`);
  return { kind: 'created', projectId, root: path.join(root, projectId) };
}

export interface ListProjectsResult {
  readonly root: string;
  readonly manifests: readonly ProjectManifest[];
  readonly rejected: readonly RejectedDiscoveryRecord[];
}

/** `seeya project list` (item 3): resolves the workspace root, then hands back
 * `WorkspaceRepository.listProjects`'s own D-022 "both sides" result unchanged — `cli/` is the
 * only layer that turns this into text. */
export async function listProjects(deps: WorkspaceCommandDeps): Promise<ListProjectsResult> {
  const root = await resolveWorkspaceRoot(deps.storage, deps.seeyaHome);
  const { manifests, rejected } = await deps.workspace.listProjects(root);
  return { root, manifests, rejected };
}

/** D-024: `seeya project show <id>` has exactly three shapes worth telling apart — never a
 * `ProjectManifest | null` that would collapse "bad id" and "no such project" into the same
 * `null`. */
export type ShowProjectResult =
  | { readonly kind: 'found'; readonly manifest: ProjectManifest; readonly root: string }
  | { readonly kind: 'notFound'; readonly projectId: string }
  | { readonly kind: 'invalidId'; readonly projectId: string };

/**
 * `seeya project show <id>` (item 3). A malformed `seeya.json` is deliberately NOT one of
 * `ShowProjectResult`'s cases — `WorkspaceRepository.readProjectManifest`'s own docstring says
 * this single, explicit lookup throws on that (unlike `listProjects`'s D-022 collection
 * tolerance), and this function lets that propagate rather than inventing a fourth, silent case
 * for it.
 */
export async function showProject(
  deps: WorkspaceCommandDeps,
  projectId: string,
): Promise<ShowProjectResult> {
  if (!isValidProjectId(projectId)) {
    return { kind: 'invalidId', projectId };
  }
  const root = await resolveWorkspaceRoot(deps.storage, deps.seeyaHome);
  const manifest = await deps.workspace.readProjectManifest(root, projectId);
  if (manifest === null) {
    return { kind: 'notFound', projectId };
  }
  return { kind: 'found', manifest, root: path.join(root, projectId) };
}
