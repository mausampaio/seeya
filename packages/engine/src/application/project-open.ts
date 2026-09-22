/**
 * `seeya project open <id> [--with <harness>]`'s own orchestration (V2-T28,
 * `docs/PLANO-DE-ENTREGA.md` item 3). Resolves which associated repositories are actually
 * reachable on this device, then hands the project's own directory and their local paths to
 * `HarnessLauncher` — the port is the only thing here that touches a real process.
 */
import path from 'node:path';
import type {
  Clock,
  DirectoryExistence,
  HarnessLauncher,
  ProcessControl,
  ProjectLock,
  Storage,
  WorkspaceRepository,
} from '../core/ports.js';
import type { ProjectLockInfo } from '../core/project-lock.js';
import type { AssociatedRepository, ProjectManifest } from '../core/types.js';
import { isValidProjectId } from '../core/project-id.js';
import { findRepositoryMapEntry } from '../core/repository-map.js';
import { resolveWorkspaceRoot } from './workspace.js';
import { acquireProjectLock, releaseProjectLock } from './project-lock.js';

/** V2-T28 item 5: only `claude` this task — `docs/spikes/N-adocao-de-sessao.md` measured the
 * Codex resume-with-message path, never the `--add-dir` equivalent `open` also needs, so
 * supporting it here would be inventing untested behavior. */
export const SUPPORTED_HARNESS = 'claude';

export interface ProjectOpenDeps {
  readonly storage: Storage;
  readonly workspace: WorkspaceRepository;
  readonly directoryExistence: DirectoryExistence;
  readonly harnessLauncher: HarnessLauncher;
  readonly projectLock: ProjectLock;
  readonly processControl: ProcessControl;
  readonly clock: Clock;
  readonly seeyaHome: string;
  /** Same `CLAUDE_CODE_SESSION_ID` source as `application/workspace.ts
   * #WorkspaceCommandDeps.sessionId` (D-047). */
  readonly sessionId: string | undefined;
  /** This `seeya project open` invocation's OWN process — `open` blocks for the harness's entire
   * interactive lifetime (`core/ports.ts#HarnessLauncher.open`'s `stdio: 'inherit'`), so its
   * liveness IS the lock's liveness (`core/project-lock.ts#ProjectLockInfo`'s own docstring).
   * `packages/cli/src/project-command.ts#runProjectOpenCommand` captures `procStart` the same way
   * `cli/index.ts`'s daemon branch already does for `daemon.lock` — a composition-root-only call. */
  readonly pid: number;
  readonly procStart: string | undefined;
}

/** D-024: one repository `open` couldn't attach, and exactly why — never conflated with a
 * repository that WAS attached. */
export type MissingRepositoryRecord =
  | { readonly name: string; readonly reason: 'notInDeviceMap' }
  | { readonly name: string; readonly reason: 'pathMissing'; readonly path: string };

/**
 * D-047 items 1/4's own outcome for `open`'s lock attempt — never flattened into a boolean
 * (D-024): `acquired` is the normal case (this session now owns the project, `reclaimedStale` set
 * only when a DEAD lock was reclaimed, D-047 item 1's own "aviso"); `readOnly` is item 4's own
 * carve-out — another session's lock is still live, so `open` still runs, but for reading: "a
 * sessão pode trabalhar no código dela, mas é avisada de que não escreve no projeto." Nothing here
 * actually PREVENTS a write in this task (that guard is V2-T34's, per the spec's own "o que não
 * entra") — this is the warning half only.
 */
export type ProjectOpenLockOutcome =
  | { readonly kind: 'acquired'; readonly reclaimedStale: ProjectLockInfo | null }
  | { readonly kind: 'readOnly'; readonly heldBy: ProjectLockInfo };

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
      readonly lock: ProjectOpenLockOutcome;
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

/** D-047 item 4: takes the project lock before opening, releases it after the harness closes —
 * only for a session that actually acquired it (`readOnly` never calls `releaseProjectLock`, there
 * is nothing this process holds to release). */
async function acquireOpenLock(
  deps: ProjectOpenDeps,
  root: string,
  projectId: string,
): Promise<ProjectOpenLockOutcome> {
  const outcome = await acquireProjectLock(
    deps,
    root,
    projectId,
    { pid: deps.pid, procStart: deps.procStart, sessionId: deps.sessionId },
    deps.clock.now(),
  );
  if (outcome.decision.kind === 'refuse') {
    return { kind: 'readOnly', heldBy: outcome.decision.heldBy };
  }
  return { kind: 'acquired', reclaimedStale: outcome.reclaimedStale };
}

/**
 * `docs/V2-RUMO.md` § "Abertura das sessões": "`open` só executa o CLI do harness escolhido com o
 * projeto como diretório de trabalho." Never writes anything to `seeya.json` — `--with` overrides
 * the harness for THIS invocation only, it's never persisted as the project's new `defaultHarness`.
 *
 * `onBeforeLaunch`, when given, fires with the resolved `missing` list and `lock` outcome right
 * before the harness is actually spawned — `cli/project-command.ts#runProjectOpenCommand` uses it
 * to print "repository X is missing"/"read-only" warnings BEFORE the interactive session takes
 * over the terminal (item 4: the person needs to see this while they can still act on it, not
 * after `claude` has already exited). The final `OpenProjectResult` still carries both, so a
 * caller that doesn't need the early warning (a future test, for instance) can read them from
 * there instead.
 */
export async function openProject(
  deps: ProjectOpenDeps,
  projectId: string,
  harnessOverride?: string,
  onBeforeLaunch?: (info: {
    readonly missing: readonly MissingRepositoryRecord[];
    readonly lock: ProjectOpenLockOutcome;
  }) => void,
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
  const lock = await acquireOpenLock(deps, root, projectId);
  onBeforeLaunch?.({ missing, lock });
  const projectDir = path.join(root, projectId);
  const result = await deps.harnessLauncher.open(projectDir, addDirs);
  return finishOpen(deps, root, projectId, { harness, addDirs, missing, lock }, result);
}

/** The tail of `openProject`, after the harness has already closed — releases the lock (only when
 * THIS session actually acquired it) and maps `HarnessOpenResult` onto `OpenProjectResult`.
 * Extracted so `openProject` itself stays a straight-line sequence of early returns (AGENTS.md §
 * "Retorno cedo"). */
async function finishOpen(
  deps: ProjectOpenDeps,
  root: string,
  projectId: string,
  opened: {
    readonly harness: string;
    readonly addDirs: readonly string[];
    readonly missing: readonly MissingRepositoryRecord[];
    readonly lock: ProjectOpenLockOutcome;
  },
  result: Awaited<ReturnType<HarnessLauncher['open']>>,
): Promise<OpenProjectResult> {
  if (opened.lock.kind === 'acquired') {
    // Best-effort release: `open` already has the harness's own `exitCode`/`failedToStart` to
    // report either way, and a release failure here would only ever be "the file was already
    // gone" (D-025, `core/project-lock.ts#decideProjectLockRelease`'s own `notHeld`) — never worth
    // turning a completed session into a reported failure.
    await releaseProjectLock(deps, root, projectId, deps.pid);
  }
  if (result.kind === 'failedToStart') {
    return { kind: 'failedToStart', projectId, harness: opened.harness };
  }
  return {
    kind: 'opened',
    projectId,
    harness: opened.harness,
    exitCode: result.exitCode,
    addedDirs: opened.addDirs,
    missing: opened.missing,
    lock: opened.lock,
  };
}
