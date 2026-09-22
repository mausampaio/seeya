/**
 * `seeya project open <id> [--with <harness>]`'s own orchestration (V2-T28,
 * `docs/PLANO-DE-ENTREGA.md` item 3). Resolves which associated repositories are actually
 * reachable on this device, then hands the project's own directory and their local paths to
 * `HarnessLauncher` — the port is the only thing here that touches a real process.
 */
import path from 'node:path';
import type {
  DirectoryExistence,
  HarnessLauncher,
  Storage,
  WorkspaceRepository,
} from '../core/ports.js';
import type { AssociatedRepository, ProjectManifest } from '../core/types.js';
import { isValidProjectId } from '../core/project-id.js';
import { findRepositoryMapEntry } from '../core/repository-map.js';
import { resolveWorkspaceRoot } from './workspace.js';

/** V2-T28 item 5: only `claude` this task — `docs/spikes/N-adocao-de-sessao.md` measured the
 * Codex resume-with-message path, never the `--add-dir` equivalent `open` also needs, so
 * supporting it here would be inventing untested behavior. */
export const SUPPORTED_HARNESS = 'claude';

export interface ProjectOpenDeps {
  readonly storage: Storage;
  readonly workspace: WorkspaceRepository;
  readonly directoryExistence: DirectoryExistence;
  readonly harnessLauncher: HarnessLauncher;
  readonly seeyaHome: string;
}

/** D-024: one repository `open` couldn't attach, and exactly why — never conflated with a
 * repository that WAS attached. */
export type MissingRepositoryRecord =
  | { readonly name: string; readonly reason: 'notInDeviceMap' }
  | { readonly name: string; readonly reason: 'pathMissing'; readonly path: string };

export type OpenProjectResult =
  | { readonly kind: 'invalidId'; readonly projectId: string }
  | { readonly kind: 'notFound'; readonly projectId: string }
  | { readonly kind: 'noHarnessChosen'; readonly projectId: string }
  | { readonly kind: 'unsupportedHarness'; readonly harness: string }
  | { readonly kind: 'failedToStart'; readonly projectId: string; readonly harness: string }
  | {
      readonly kind: 'opened';
      readonly projectId: string;
      readonly harness: string;
      readonly exitCode: number;
      readonly addedDirs: readonly string[];
      readonly missing: readonly MissingRepositoryRecord[];
    };

interface ResolvedDirs {
  readonly addDirs: readonly string[];
  readonly missing: readonly MissingRepositoryRecord[];
}

/** For each associated repository: a local path this device knows about AND that still exists
 * becomes a `--add-dir`; anything else becomes a `MissingRepositoryRecord` (item 4: `open` warns
 * and continues, never aborts over one missing repository, D-025). */
async function resolveRepositoryDirs(
  deps: ProjectOpenDeps,
  projectId: string,
  repositories: readonly AssociatedRepository[],
): Promise<ResolvedDirs> {
  const map = await deps.storage.readRepositoryMap();
  const addDirs: string[] = [];
  const missing: MissingRepositoryRecord[] = [];
  for (const repository of repositories) {
    const entry = findRepositoryMapEntry(map, projectId, repository);
    if (entry === null) {
      missing.push({ name: repository.name, reason: 'notInDeviceMap' });
      continue;
    }
    if (await deps.directoryExistence.exists(entry.path)) {
      addDirs.push(entry.path);
    } else {
      missing.push({ name: repository.name, reason: 'pathMissing', path: entry.path });
    }
  }
  return { addDirs, missing };
}

function resolveHarness(
  manifest: ProjectManifest,
  harnessOverride: string | undefined,
): string | null {
  return harnessOverride ?? manifest.defaultHarness;
}

/**
 * `docs/V2-RUMO.md` § "Abertura das sessões": "`open` só executa o CLI do harness escolhido com o
 * projeto como diretório de trabalho." Never writes anything — `--with` overrides the harness for
 * THIS invocation only, it's never persisted as the project's new `defaultHarness`.
 *
 * `onBeforeLaunch`, when given, fires with the resolved `missing` list right before the harness is
 * actually spawned — `cli/project-command.ts#runProjectOpenCommand` uses it to print "repository X
 * is missing" warnings BEFORE the interactive session takes over the terminal (item 4: the person
 * needs to see this while they can still act on it, not after `claude` has already exited). The
 * final `OpenProjectResult` still carries the same `missing` list, so a caller that doesn't need
 * the early warning (a future test, for instance) can read it from there instead.
 */
export async function openProject(
  deps: ProjectOpenDeps,
  projectId: string,
  harnessOverride?: string,
  onBeforeLaunch?: (missing: readonly MissingRepositoryRecord[]) => void,
): Promise<OpenProjectResult> {
  if (!isValidProjectId(projectId)) {
    return { kind: 'invalidId', projectId };
  }
  const root = await resolveWorkspaceRoot(deps.storage, deps.seeyaHome);
  const manifest = await deps.workspace.readProjectManifest(root, projectId);
  if (manifest === null) {
    return { kind: 'notFound', projectId };
  }

  const harness = resolveHarness(manifest, harnessOverride);
  if (harness === null) {
    return { kind: 'noHarnessChosen', projectId };
  }
  if (harness !== SUPPORTED_HARNESS) {
    return { kind: 'unsupportedHarness', harness };
  }

  const { addDirs, missing } = await resolveRepositoryDirs(deps, projectId, manifest.repositories);
  onBeforeLaunch?.(missing);
  const projectDir = path.join(root, projectId);
  const result = await deps.harnessLauncher.open(projectDir, addDirs);
  if (result.kind === 'failedToStart') {
    return { kind: 'failedToStart', projectId, harness };
  }
  return {
    kind: 'opened',
    projectId,
    harness,
    exitCode: result.exitCode,
    addedDirs: addDirs,
    missing,
  };
}
