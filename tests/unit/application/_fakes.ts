import type { FallbackConfirmer } from '@seeya-ai/engine/application/start-day.js';
import type {
  Briefing,
  Clock,
  DirectoryExistence,
  DiscoveryResult,
  ForkCleanup,
  ForkCleanupResult,
  GitEvidenceAcrossRepos,
  GitReader,
  GitReadResult,
  HandoffGenerator,
  HarnessLauncher,
  HarnessOpenResult,
  ProcessControl,
  ProjectLock,
  RejectedDiscoveryRecord,
  SessionProvider,
  SessionResumer,
  Storage,
  TranscriptListingInfo,
  TranscriptReader,
  TranscriptReadResult,
  WorkspaceRepository,
} from '@seeya-ai/engine/core/ports.js';
import type { ProjectLockInfo } from '@seeya-ai/engine/core/project-lock.js';
import type {
  AdoptionRecord,
  Config,
  DaemonOwnershipTransitionAnswer,
  DayState,
  DiscoveredSession,
  EarlyWarningState,
  GeneratedUnderstanding,
  Handoff,
  PrimaryResumeAttempt,
  ProjectManifest,
  ProjectSkeleton,
  ProtocolScheme,
  RepositoryMapEntry,
  ResumeFallbackReason,
  ResumeOutcome,
  SessionFacts,
} from '@seeya-ai/engine/core/types.js';
import type { DaemonLockInfo } from '@seeya-ai/engine/core/daemon-lock.js';

/**
 * Named doubles for `application/endDay`'s ports (docs/TESTES.md § Testes: "duplo de I/O é
 * classe/objeto nomeado implementando a porta, não stub inline"). Every fake is deliberately
 * minimal — only the methods `endDay`'s pipeline actually calls are wired to do something useful;
 * the rest reject loudly so a test that exercises an unexpected path fails with a clear message
 * instead of silently returning `undefined`.
 */

export class FakeClock implements Clock {
  constructor(private readonly instant: Date) {}
  now(): Date {
    return this.instant;
  }
  /** No test in this file ever waits on the daemon's poll cadence — resolves immediately. */
  sleep(): Promise<void> {
    return Promise.resolve();
  }
}

export class FakeSessionProvider implements SessionProvider {
  constructor(private readonly result: DiscoveryResult) {}
  list(): Promise<DiscoveryResult> {
    return Promise.resolve(this.result);
  }
}

const EMPTY_TRANSCRIPT_READ_RESULT: TranscriptReadResult = {
  facts: { lastActivity: null, lastPrompts: [], assistantMessages: [], touchedFiles: [] },
  rejected: [],
  unknownEntryTypeCount: 0,
};

const EMPTY_LISTING_INFO: TranscriptListingInfo = { aiTitle: null, lastPrompt: null };

/** Keyed by `sessionId`. A session not in `bySessionId` gets the "no transcript" default — the
 * same graceful behavior the real `TranscriptFileReader` gives a session it can't locate.
 * `listingBySessionId`/`throwListingFor` (D-031) mirror `bySessionId`/`throwFor` for
 * `readListingInfo` — added as trailing, defaulted parameters so every existing call site (which
 * only ever passed the first two) keeps compiling and keeps its original `readFacts`-only
 * behavior unchanged. */
export class FakeTranscriptReader implements TranscriptReader {
  constructor(
    private readonly bySessionId: ReadonlyMap<string, TranscriptReadResult> = new Map(),
    private readonly throwFor: ReadonlySet<string> = new Set(),
    private readonly listingBySessionId: ReadonlyMap<string, TranscriptListingInfo> = new Map(),
    private readonly throwListingFor: ReadonlySet<string> = new Set(),
  ) {}

  readFacts(session: DiscoveredSession): Promise<TranscriptReadResult> {
    if (this.throwFor.has(session.sessionId)) {
      return Promise.reject(
        new Error(`FakeTranscriptReader: forced failure for ${session.sessionId}`),
      );
    }
    return Promise.resolve(this.bySessionId.get(session.sessionId) ?? EMPTY_TRANSCRIPT_READ_RESULT);
  }

  readListingInfo(session: DiscoveredSession): Promise<TranscriptListingInfo> {
    if (this.throwListingFor.has(session.sessionId)) {
      return Promise.reject(
        new Error(`FakeTranscriptReader: forced listing failure for ${session.sessionId}`),
      );
    }
    return Promise.resolve(this.listingBySessionId.get(session.sessionId) ?? EMPTY_LISTING_INFO);
  }
}

const NOT_A_REPO: GitReadResult = { hasGit: false };

/**
 * Keyed by `cwd`. A `cwd` not in `byCwd` gets `{ hasGit: false }` — the same "not a repository"
 * default the real `GitAdapter` gives a `cwd` outside a working tree.
 *
 * **D-032's `readEvidenceAcrossRepos` deliberately ignores `touchedFiles` and only ever asks about
 * `cwd`** — every existing test configuration here is keyed by `cwd` (`byCwd`/`throwFor` above,
 * predating D-032), and this keeps those configurations meaning the same thing ("git responds for
 * this session") without a real filesystem walk. `root` on the synthesized `RepositoryGitFacts` is
 * just `cwd` itself — good enough for tests that only care about `sources`/one repository's facts,
 * never a stand-in for `adapters/git/git-adapter.ts`'s real multi-root discovery, which is covered
 * by its own integration suite (`tests/integration/git/git-adapter.test.ts`) against a real
 * filesystem instead of a fake.
 */
export class FakeGitReader implements GitReader {
  constructor(
    private readonly byCwd: ReadonlyMap<string, GitReadResult> = new Map(),
    private readonly throwFor: ReadonlySet<string> = new Set(),
  ) {}

  readFacts(cwd: string): Promise<GitReadResult> {
    if (this.throwFor.has(cwd)) {
      return Promise.reject(new Error(`FakeGitReader: forced failure for ${cwd}`));
    }
    return Promise.resolve(this.byCwd.get(cwd) ?? NOT_A_REPO);
  }

  async readEvidenceAcrossRepos(cwd: string): Promise<GitEvidenceAcrossRepos> {
    const result = await this.readFacts(cwd);
    if (!result.hasGit) {
      return { repositories: [], filesOutsideRepository: 0, reposNotVisited: 0 };
    }
    return {
      repositories: [{ root: cwd, ...result.facts }],
      filesOutsideRepository: 0,
      reposNotVisited: 0,
    };
  }

  // V2-T28: not exercised by endDay/evidence-gathering — same "reject loudly" convention this
  // fake uses for methods outside its own scope. `FakeGitReaderWithRemote` below is the double
  // for tests that DO care about this method.
  readRemoteUrl(): Promise<string | null> {
    return Promise.reject(new Error('FakeGitReader.readRemoteUrl is not exercised by endDay'));
  }
}

/** `GitReader` double for `application/repository-association.ts#addRepository`'s own tests —
 * `readRemoteUrl` keyed by `cwd`, everything else rejects (`add-repo` never reads facts or
 * cross-repo evidence, only the remote). */
export class FakeGitReaderWithRemote implements GitReader {
  constructor(private readonly remoteByCwd: ReadonlyMap<string, string | null> = new Map()) {}

  readFacts(): Promise<GitReadResult> {
    return Promise.reject(
      new Error('FakeGitReaderWithRemote.readFacts is not exercised by addRepository'),
    );
  }

  readEvidenceAcrossRepos(): Promise<GitEvidenceAcrossRepos> {
    return Promise.reject(
      new Error(
        'FakeGitReaderWithRemote.readEvidenceAcrossRepos is not exercised by addRepository',
      ),
    );
  }

  readRemoteUrl(cwd: string): Promise<string | null> {
    return Promise.resolve(this.remoteByCwd.get(cwd) ?? null);
  }
}

/**
 * A `GitReader` whose `readEvidenceAcrossRepos` returns a fixed `GitEvidenceAcrossRepos` no matter
 * what `cwd`/`touchedFiles` it's called with — for testing `evidence-gathering.ts`'s OWN plumbing
 * (does `gatherEvidence` copy `repositories`/`filesOutsideRepository`/`reposNotVisited` onto
 * `HandoffFacts` correctly, including the multi-repository case) independently of the real
 * root-discovery algorithm, which `adapters/git/git-adapter.ts` owns and
 * `tests/integration/git/git-adapter.test.ts` covers against a real filesystem (D-032).
 */
export class StaticGitReader implements GitReader {
  constructor(private readonly result: GitEvidenceAcrossRepos) {}

  readFacts(): Promise<GitReadResult> {
    return Promise.reject(new Error('StaticGitReader.readFacts is not exercised by this double'));
  }

  readEvidenceAcrossRepos(): Promise<GitEvidenceAcrossRepos> {
    return Promise.resolve(this.result);
  }

  readRemoteUrl(): Promise<string | null> {
    return Promise.reject(
      new Error('StaticGitReader.readRemoteUrl is not exercised by this double'),
    );
  }
}

/** Wraps a plain function so a test can express "this generator succeeds with X" or "this
 * generator always fails with Y" without a bespoke class per scenario. */
export class FakeHandoffGenerator implements HandoffGenerator {
  constructor(
    private readonly impl: (
      session: DiscoveredSession,
      facts: SessionFacts,
    ) => Promise<GeneratedUnderstanding>,
  ) {}

  generate(session: DiscoveredSession, facts: SessionFacts): Promise<GeneratedUnderstanding> {
    return this.impl(session, facts);
  }
}

export function succeedingGenerator(result: GeneratedUnderstanding): FakeHandoffGenerator {
  return new FakeHandoffGenerator(() => Promise.resolve(result));
}

export function failingGenerator(message: string): FakeHandoffGenerator {
  return new FakeHandoffGenerator(() => Promise.reject(new Error(message)));
}

/** In-memory `Storage`. `savedHandoffs` starts pre-populated with `existingHandoffs` (today's
 * previous captures, for D-026 tests) and grows as `saveHandoff` is called — `readHandoff` reads
 * from the SAME map, so a test can assert "what would a real re-read see" after a save. */
export class FakeStorage implements Storage {
  readonly savedHandoffs = new Map<string, Handoff>();
  /** Keyed by `day`. Grows every time `endDay`'s S2-T4 step calls `saveBriefing` — a test can
   * assert on the exact markdown, or just that a day got one at all. */
  readonly savedBriefings = new Map<string, string>();

  constructor(
    private readonly config: Config,
    existingHandoffs: ReadonlyMap<string, Handoff> = new Map(),
  ) {
    for (const [key, handoff] of existingHandoffs) {
      this.savedHandoffs.set(key, handoff);
    }
  }

  static key(day: string, sessionId: string): string {
    return `${day}:${sessionId}`;
  }

  readConfig(): Promise<Config> {
    return Promise.resolve(this.config);
  }

  // S4-T4: `seeya config` is the only caller (`cli/config-command.ts`), never `endDay` — same
  // "reject loudly" convention this fake already uses below for `readState`/`saveState` etc.
  saveConfig(config: Config): ReturnType<Storage['saveConfig']> {
    void config;
    return Promise.reject(new Error('FakeStorage.saveConfig is not exercised by endDay'));
  }

  readEarlyWarningState(): Promise<EarlyWarningState> {
    return Promise.reject(
      new Error('FakeStorage.readEarlyWarningState is not exercised by endDay'),
    );
  }

  saveEarlyWarningState(): Promise<void> {
    return Promise.reject(
      new Error('FakeStorage.saveEarlyWarningState is not exercised by endDay'),
    );
  }

  saveHandoff(day: string, handoff: Handoff): Promise<void> {
    this.savedHandoffs.set(FakeStorage.key(day, handoff.sessionId), handoff);
    return Promise.resolve();
  }

  readHandoff(day: string, sessionId: string): Promise<Handoff | null> {
    return Promise.resolve(this.savedHandoffs.get(FakeStorage.key(day, sessionId)) ?? null);
  }

  /** Every handoff currently in `savedHandoffs` for `day` — the in-memory equivalent of a real
   * `sessions/` directory listing, with no corruption to report (`rejected` always empty here; see
   * `StorageWithRejectedHandoffs` below for a double that exercises D-022's other side). */
  listHandoffs(day: string): Promise<{ handoffs: Handoff[]; rejected: RejectedDiscoveryRecord[] }> {
    const prefix = `${day}:`;
    const handoffs = [...this.savedHandoffs.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, handoff]) => handoff);
    return Promise.resolve({ handoffs, rejected: [] });
  }

  saveBriefing(day: string, markdown: string): Promise<void> {
    this.savedBriefings.set(day, markdown);
    return Promise.resolve();
  }

  /** Same "no second read path" rule the real `StorageAdapter#readBriefing` follows (S3-T1):
   * built on this fake's own `listHandoffs`, `null` only when there's nothing at all for `day`. */
  async readBriefing(day: string): Promise<Briefing | null> {
    const { handoffs, rejected } = await this.listHandoffs(day);
    if (handoffs.length === 0 && rejected.length === 0) {
      return null;
    }
    return { day, handoffs, rejected };
  }

  /** Keyed by `day`. A day never saved to comes back empty (D-025) — same convention the real
   * `StorageAdapter` follows for a missing `resumed.json` (S3-T3). */
  readonly resumedSessionIdsByDay = new Map<string, Set<string>>();

  readResumedSessionIds(day: string): Promise<ReadonlySet<string>> {
    return Promise.resolve(this.resumedSessionIdsByDay.get(day) ?? new Set());
  }

  saveResumedSessionIds(day: string, sessionIds: ReadonlySet<string>): Promise<void> {
    this.resumedSessionIdsByDay.set(day, new Set(sessionIds));
    return Promise.resolve();
  }

  // S4-T3: `estado.json`/`daemon.lock` are the scheduler's own concern, never touched by
  // `application/endDay`'s pipeline — same "reject loudly" convention this fake already uses above
  // for `readEarlyWarningState`/`saveEarlyWarningState`, which `endDay` also never calls directly.
  readState(): ReturnType<Storage['readState']> {
    return Promise.reject(new Error('FakeStorage.readState is not exercised by endDay'));
  }

  saveState(state: DayState): ReturnType<Storage['saveState']> {
    // Named/typed (not dropped to zero parameters) so a subclass overriding this to spy on the
    // argument has a real parameter to type its override against — same reasoning
    // `FakeForkCleanup#cleanup` above already gives for its own unused parameter.
    void state;
    return Promise.reject(new Error('FakeStorage.saveState is not exercised by endDay'));
  }

  readDaemonLock(): ReturnType<Storage['readDaemonLock']> {
    return Promise.reject(new Error('FakeStorage.readDaemonLock is not exercised by endDay'));
  }

  writeDaemonLock(lock: DaemonLockInfo): ReturnType<Storage['writeDaemonLock']> {
    void lock;
    return Promise.reject(new Error('FakeStorage.writeDaemonLock is not exercised by endDay'));
  }

  readActiveProtocolScheme(): ReturnType<Storage['readActiveProtocolScheme']> {
    return Promise.reject(
      new Error('FakeStorage.readActiveProtocolScheme is not exercised by endDay'),
    );
  }

  saveActiveProtocolScheme(
    scheme: ProtocolScheme,
  ): ReturnType<Storage['saveActiveProtocolScheme']> {
    void scheme;
    return Promise.reject(
      new Error('FakeStorage.saveActiveProtocolScheme is not exercised by endDay'),
    );
  }

  clearDaemonLock(): ReturnType<Storage['clearDaemonLock']> {
    return Promise.reject(new Error('FakeStorage.clearDaemonLock is not exercised by endDay'));
  }

  readDaemonOwnershipTransitionAnswer(): ReturnType<
    Storage['readDaemonOwnershipTransitionAnswer']
  > {
    return Promise.reject(
      new Error('FakeStorage.readDaemonOwnershipTransitionAnswer is not exercised by endDay'),
    );
  }

  saveDaemonOwnershipTransitionAnswer(
    answer: DaemonOwnershipTransitionAnswer,
  ): ReturnType<Storage['saveDaemonOwnershipTransitionAnswer']> {
    void answer;
    return Promise.reject(
      new Error('FakeStorage.saveDaemonOwnershipTransitionAnswer is not exercised by endDay'),
    );
  }

  // V2-T27: `seeya project`'s own workspace root — never touched by `endDay`/`startDay`/the
  // daemon, same "reject loudly" convention this fake already uses above for every other method
  // outside its own scope.
  readWorkspaceRoot(): ReturnType<Storage['readWorkspaceRoot']> {
    return Promise.reject(new Error('FakeStorage.readWorkspaceRoot is not exercised by endDay'));
  }

  saveWorkspaceRoot(root: string): ReturnType<Storage['saveWorkspaceRoot']> {
    void root;
    return Promise.reject(new Error('FakeStorage.saveWorkspaceRoot is not exercised by endDay'));
  }

  // V2-T28: `repository-map.json` — never touched by `endDay`/`startDay`/the daemon, same
  // "reject loudly" convention this fake uses above for every other method outside its own scope.
  readRepositoryMap(): ReturnType<Storage['readRepositoryMap']> {
    return Promise.reject(new Error('FakeStorage.readRepositoryMap is not exercised by endDay'));
  }

  saveRepositoryMap(
    entries: readonly RepositoryMapEntry[],
  ): ReturnType<Storage['saveRepositoryMap']> {
    void entries;
    return Promise.reject(new Error('FakeStorage.saveRepositoryMap is not exercised by endDay'));
  }

  // V2-T29: `adoptions.json` — never touched by `endDay`/`startDay`/the daemon, same "reject
  // loudly" convention this fake uses above for every other method outside its own scope.
  readAdoptions(): ReturnType<Storage['readAdoptions']> {
    return Promise.reject(new Error('FakeStorage.readAdoptions is not exercised by endDay'));
  }

  saveAdoptions(records: readonly AdoptionRecord[]): ReturnType<Storage['saveAdoptions']> {
    void records;
    return Promise.reject(new Error('FakeStorage.saveAdoptions is not exercised by endDay'));
  }
}

/**
 * V2-T27: `application/workspace.ts#resolveWorkspaceRoot`'s own in-memory `Storage` double —
 * `FakeStorage`'s `readWorkspaceRoot`/`saveWorkspaceRoot` reject by default (not exercised by
 * `endDay`), same extension pattern `tests/unit/cli/_fakes.ts#InMemoryScheduleStorage` already
 * uses for `readState`/`saveState`. Shared by `tests/unit/application/workspace.test.ts` and
 * `tests/unit/cli/project-command.test.ts` rather than each defining its own copy.
 */
export class InMemoryWorkspaceStorage extends FakeStorage {
  private root: string | null = null;

  override readWorkspaceRoot(): Promise<string | null> {
    return Promise.resolve(this.root);
  }

  override saveWorkspaceRoot(root: string): Promise<void> {
    this.root = root;
    return Promise.resolve();
  }
}

/**
 * V2-T28: an in-memory `Storage` double for `repository-association.ts#addRepository` and
 * `project-open.ts#openProject` tests — extends `InMemoryWorkspaceStorage` (already in-memory for
 * the workspace root) with an in-memory `repository-map.json`, the other device-local file both
 * use.
 */
export class InMemoryDeviceStorage extends InMemoryWorkspaceStorage {
  private entries: readonly RepositoryMapEntry[] = [];
  private adoptions: readonly AdoptionRecord[] = [];

  override readRepositoryMap(): Promise<readonly RepositoryMapEntry[]> {
    return Promise.resolve(this.entries);
  }

  override saveRepositoryMap(entries: readonly RepositoryMapEntry[]): Promise<void> {
    this.entries = entries;
    return Promise.resolve();
  }

  // V2-T29: `adoptions.json` — real in-memory storage, unlike the base `FakeStorage`'s rejecting
  // stub, for `project-adopt.test.ts`'s own use of this double.
  override readAdoptions(): Promise<readonly AdoptionRecord[]> {
    return Promise.resolve(this.adoptions);
  }

  override saveAdoptions(records: readonly AdoptionRecord[]): Promise<void> {
    this.adoptions = records;
    return Promise.resolve();
  }
}

/**
 * V2-T27: an in-memory `WorkspaceRepository` — a real project map, minus any real filesystem or
 * `git` call (`tests/integration/workspace/fs-workspace-repository.test.ts` is where the real
 * adapter is proven against a real `git` binary). Records every `commitAll` message so a test can
 * assert exactly what `application/workspace.ts#createProject` committed, and how many times.
 */
export class FakeWorkspaceRepository implements WorkspaceRepository {
  private readonly initializedRoots = new Set<string>();
  private readonly projectsByRoot = new Map<string, Map<string, ProjectManifest>>();
  readonly commitMessages: string[] = [];

  private projectsOf(root: string): Map<string, ProjectManifest> {
    let projects = this.projectsByRoot.get(root);
    if (projects === undefined) {
      projects = new Map();
      this.projectsByRoot.set(root, projects);
    }
    return projects;
  }

  isInitialized(root: string): Promise<boolean> {
    return Promise.resolve(this.initializedRoots.has(root));
  }

  initialize(root: string): Promise<void> {
    this.initializedRoots.add(root);
    return Promise.resolve();
  }

  projectExists(root: string, projectId: string): Promise<boolean> {
    return Promise.resolve(this.projectsOf(root).has(projectId));
  }

  writeProjectSkeleton(root: string, projectId: string, skeleton: ProjectSkeleton): Promise<void> {
    this.projectsOf(root).set(projectId, skeleton.manifest);
    return Promise.resolve();
  }

  writeProjectManifest(root: string, projectId: string, manifest: ProjectManifest): Promise<void> {
    this.projectsOf(root).set(projectId, manifest);
    return Promise.resolve();
  }

  commitAll(root: string, projectId: string, message: string): Promise<void> {
    void root;
    void projectId;
    this.commitMessages.push(message);
    return Promise.resolve();
  }

  listProjects(
    root: string,
  ): Promise<{ manifests: ProjectManifest[]; rejected: RejectedDiscoveryRecord[] }> {
    return Promise.resolve({ manifests: [...this.projectsOf(root).values()], rejected: [] });
  }

  readProjectManifest(root: string, projectId: string): Promise<ProjectManifest | null> {
    return Promise.resolve(this.projectsOf(root).get(projectId) ?? null);
  }

  // V2-T29: `project-adopt.test.ts`'s own hook — a test calls `setChangedFiles` to simulate what
  // the interactive fork session wrote before `adoptSession` asks whether to commit; unset (or a
  // project id never configured) reads as "nothing changed" (`[]`), the same default a brand-new
  // project with no writes yet would report for real.
  private readonly changedFilesByProject = new Map<string, readonly string[]>();

  setChangedFiles(projectId: string, files: readonly string[]): void {
    this.changedFilesByProject.set(projectId, files);
  }

  listChangedFiles(root: string, projectId: string): Promise<readonly string[]> {
    void root;
    return Promise.resolve(this.changedFilesByProject.get(projectId) ?? []);
  }
}

/** Named double for `SessionResumer` (S3-T3, docs/TESTES.md: "duplo de I/O é classe/objeto
 * nomeado implementando a porta"). Split into `attemptResume`/`runFallback` in S5-T9, mirroring
 * the real port (`core/ports.ts`); `resumeWithoutPrompt` added in V2-T7. Records every call to
 * each, in order, so a test can assert both the outcome AND the exact sequence
 * `application/start-day.ts#resumeSessions` produced — `fallbackCalls`/`resumeWithoutPromptCalls`
 * stay empty for any test that never reaches that path at all. */
export class FakeSessionResumer implements SessionResumer {
  readonly calls: { readonly sessionId: string; readonly cwd: string; readonly prompt: string }[] =
    [];
  readonly fallbackCalls: {
    readonly sessionId: string;
    readonly cwd: string;
    readonly prompt: string;
    readonly reason: ResumeFallbackReason;
  }[] = [];
  readonly resumeWithoutPromptCalls: { readonly sessionId: string; readonly cwd: string }[] = [];

  constructor(
    private readonly attemptImpl: (
      sessionId: string,
      cwd: string,
      prompt: string,
    ) => Promise<PrimaryResumeAttempt>,
    // Defaults to a loud rejection, not a silently-wrong outcome: a test whose scenario never
    // means to reach the fallback (most of them) gets a clear failure message instead of a
    // fabricated `ResumeOutcome` if `resumeSessions` ever calls this unexpectedly.
    private readonly fallbackImpl: (
      sessionId: string,
      cwd: string,
      prompt: string,
      reason: ResumeFallbackReason,
    ) => Promise<ResumeOutcome> = () =>
      Promise.reject(new Error('FakeSessionResumer.runFallback was not configured for this test')),
    // Same "loud rejection by default" discipline as `fallbackImpl` above — most tests never reach
    // V2-T7's "resume without the plan" path either.
    private readonly resumeWithoutPromptImpl: (
      sessionId: string,
      cwd: string,
    ) => Promise<PrimaryResumeAttempt> = () =>
      Promise.reject(
        new Error('FakeSessionResumer.resumeWithoutPrompt was not configured for this test'),
      ),
  ) {}

  attemptResume(sessionId: string, cwd: string, prompt: string): Promise<PrimaryResumeAttempt> {
    this.calls.push({ sessionId, cwd, prompt });
    return this.attemptImpl(sessionId, cwd, prompt);
  }

  runFallback(
    sessionId: string,
    cwd: string,
    prompt: string,
    reason: ResumeFallbackReason,
  ): Promise<ResumeOutcome> {
    this.fallbackCalls.push({ sessionId, cwd, prompt, reason });
    return this.fallbackImpl(sessionId, cwd, prompt, reason);
  }

  resumeWithoutPrompt(sessionId: string, cwd: string): Promise<PrimaryResumeAttempt> {
    this.resumeWithoutPromptCalls.push({ sessionId, cwd });
    return this.resumeWithoutPromptImpl(sessionId, cwd);
  }
}

/** A `SessionResumer` whose every call attaches cleanly (`kind: 'resumed'`) — never even reaches
 * `runFallback`. */
export function cleanlyResumingResumer(): FakeSessionResumer {
  return new FakeSessionResumer((sessionId, cwd) =>
    Promise.resolve({ kind: 'resumed', outcome: { sessionId, cwd, kind: 'resumed' } }),
  );
}

/** A `SessionResumer` whose `attemptResume` throws outright — the same loop-stopping shape
 * `resumeSessions` also gives a `runFallback` that fails fast (docs/QUESTOES.md Q-027 item 5):
 * either way, one exception from this port stops the batch, reports the exact session it happened
 * on, and never retries the rest. */
export function throwingResumer(message: string): FakeSessionResumer {
  return new FakeSessionResumer(() => Promise.reject(new Error(message)));
}

/** A `SessionResumer` whose `attemptResume` always reports `needsFallback` with `reason`, and
 * whose `runFallback` attaches cleanly (`kind: 'freshSession'`) — for testing the S5-T9
 * ask-before-fallback flow without needing a resumer that ever succeeds on the first try. */
export function fallbackNeedingResumer(reason: ResumeFallbackReason): FakeSessionResumer {
  return new FakeSessionResumer(
    () => Promise.resolve({ kind: 'needsFallback', reason }),
    (sessionId, cwd) => Promise.resolve({ sessionId, cwd, kind: 'freshSession', reason }),
  );
}

/** Same shape as `fallbackNeedingResumer`, but `runFallback` throws — the "fallback also failed
 * fast" case (Q-027 item 5) reached via the S5-T9 ask step instead of directly. */
export function fallbackNeedingThenFailingResumer(
  reason: ResumeFallbackReason,
  message: string,
): FakeSessionResumer {
  return new FakeSessionResumer(
    () => Promise.resolve({ kind: 'needsFallback', reason }),
    () => Promise.reject(new Error(message)),
  );
}

/** A `SessionResumer` whose `attemptResume` always reports `needsFallback` with a `promptTooLarge`
 * `reason`, and whose `resumeWithoutPrompt` attaches cleanly (bare `{ kind: 'resumed' }`) — for
 * testing V2-T7's "resume without the plan" path. */
export function fallbackNeedingThenResumingWithoutPromptResumer(
  reason: ResumeFallbackReason,
): FakeSessionResumer {
  return new FakeSessionResumer(
    () => Promise.resolve({ kind: 'needsFallback', reason }),
    undefined,
    (sessionId, cwd) =>
      Promise.resolve({ kind: 'resumed', outcome: { sessionId, cwd, kind: 'resumed' } }),
  );
}

/** Same shape as `fallbackNeedingThenResumingWithoutPromptResumer`, but `resumeWithoutPrompt`
 * itself fails fast (V2-T7 item 2: "sem segunda pergunta" — reported as skipped, never asked
 * again). */
export function fallbackNeedingThenFailingResumeWithoutPromptResumer(
  reason: ResumeFallbackReason,
  exitCode: number,
): FakeSessionResumer {
  return new FakeSessionResumer(
    () => Promise.resolve({ kind: 'needsFallback', reason }),
    undefined,
    () =>
      Promise.resolve({
        kind: 'needsFallback',
        reason: { kind: 'resumeWithoutPlanFailed', exitCode },
      }),
  );
}

/** Always answers "open" — the S5-T9 ask step's dependency in tests that exercise fallback
 * bookkeeping but aren't themselves about the question (mirrors this file's pre-S5-T9 behavior,
 * where a fallback happened automatically). Dedicated tests for "skip"/"invalid" pass their own
 * `confirmFallback` instead. */
export const alwaysOpenFallback: FallbackConfirmer = () => Promise.resolve({ kind: 'open' });

/** A `Storage` whose `listHandoffs` always reports one extra unreadable entry alongside whatever
 * `FakeStorage` would otherwise return — for the briefing wiring test that checks `endDay`
 * surfaces D-022's rejected side in the generated `summary.md`, not just the accepted one. */
export class StorageWithRejectedHandoffs extends FakeStorage {
  constructor(
    config: Config,
    private readonly rejection: RejectedDiscoveryRecord,
  ) {
    super(config);
  }

  override async listHandoffs(
    day: string,
  ): Promise<{ handoffs: Handoff[]; rejected: RejectedDiscoveryRecord[] }> {
    const { handoffs, rejected } = await super.listHandoffs(day);
    return { handoffs, rejected: [...rejected, this.rejection] };
  }
}

/** A `Storage` whose `saveHandoff` throws — for D-002's "falha na captura aborta o encerramento"
 * tests: a session whose write itself fails must never reach `terminateGracefully`. */
export class FailingSaveStorage extends FakeStorage {
  override saveHandoff(): Promise<void> {
    return Promise.reject(new Error('FailingSaveStorage: saveHandoff always fails'));
  }
}

/** A `Storage` whose `saveHandoff` succeeds but whose `readHandoff` never sees the write — for
 * D-002's verification-gap tests: a handoff that "saved" but can't be read back must also abort
 * termination, not just an outright write failure. */
export class UnverifiableSaveStorage extends FakeStorage {
  override saveHandoff(): Promise<void> {
    return Promise.resolve();
  }

  override readHandoff(): Promise<Handoff | null> {
    return Promise.resolve(null);
  }
}

/** Always reports nothing to clean up unless a test hands it a specific `ForkCleanupResult` —
 * `endDay`'s own tests aren't about D-012, they only need `EndDayDeps` to type-check with a real
 * implementation of every port (S2-T5 added this one). */
export class FakeForkCleanup implements ForkCleanup {
  /** V2-T29: every `sessionId` passed to `deleteFork` — `project-adopt.test.ts`'s own way to
   * assert a declined adoption's fork was actually deleted (never called at all on accept). */
  readonly deletedSessionIds: string[] = [];

  constructor(private readonly result: ForkCleanupResult = { outcomes: [], rejected: [] }) {}

  cleanup(forkCleanupDays: number): Promise<ForkCleanupResult> {
    // Named/typed (not dropped to zero parameters) so a subclass overriding this method to spy on
    // the argument (endDay.test.ts) has a real parameter to type its own override against, matching
    // the real `ForkCleanup` port's signature exactly. This double itself doesn't need the value.
    void forkCleanupDays;
    return Promise.resolve(this.result);
  }

  deleteFork(sessionId: string): ReturnType<ForkCleanup['deleteFork']> {
    this.deletedSessionIds.push(sessionId);
    return Promise.resolve({ sessionId, outcome: 'deleted' });
  }
}

/** A `ForkCleanup` whose `cleanup()` always rejects — for `endDay`'s isolation test: a fork-cleanup
 * failure must never take down captures/briefing that already succeeded in the same run. */
export class FailingForkCleanup implements ForkCleanup {
  cleanup(): Promise<ForkCleanupResult> {
    return Promise.reject(new Error('FailingForkCleanup: cleanup always fails'));
  }

  deleteFork(): ReturnType<ForkCleanup['deleteFork']> {
    return Promise.reject(new Error('FailingForkCleanup: deleteFork always fails'));
  }
}

export class FakeProcessControl implements ProcessControl {
  constructor(
    private readonly terminateResult: (pid: number) => Promise<boolean> | boolean = () => true,
  ) {}

  isAlive(): Promise<boolean> {
    return Promise.reject(new Error('FakeProcessControl.isAlive is not exercised by endDay'));
  }

  async terminateGracefully(pid: number): Promise<boolean> {
    return this.terminateResult(pid);
  }

  terminateAbruptly(): Promise<void> {
    return Promise.reject(
      new Error('FakeProcessControl.terminateAbruptly is not exercised by endDay'),
    );
  }
}

/** `ProcessControl` double (V2-T33) whose `isAlive` is controllable per pid, unlike
 * `FakeProcessControl` above (whose `isAlive` always rejects — accurate for `endDay`, which never
 * calls it, but `application/project-lock.ts` calls it on every lock check). Does NOT replicate
 * the real recycled-pid tie-break (`procStart` is recorded in `isAliveCalls` but ignored when
 * answering) — that logic already has its own real-process coverage
 * (`tests/integration/scheduler/lock.test.ts`, reused for the project lock by
 * `tests/integration/application/project-lock.test.ts`, same technique). What this fake proves is
 * narrower: that the calling code passes `pid`/`procStart` through at all. */
export class ControllableProcessControl implements ProcessControl {
  readonly isAliveCalls: Array<{ pid: number; procStart: string | undefined }> = [];

  constructor(private readonly aliveByPid: ReadonlyMap<number, boolean> = new Map()) {}

  isAlive(pid: number, procStart?: string): Promise<boolean> {
    this.isAliveCalls.push({ pid, procStart });
    return Promise.resolve(this.aliveByPid.get(pid) ?? false);
  }

  terminateGracefully(): Promise<boolean> {
    return Promise.reject(
      new Error('ControllableProcessControl.terminateGracefully is not exercised here'),
    );
  }

  terminateAbruptly(): Promise<void> {
    return Promise.reject(
      new Error('ControllableProcessControl.terminateAbruptly is not exercised here'),
    );
  }
}

/** `ProjectLock` double (V2-T33, D-047 item 1) — an in-memory `.seeya-lock`, keyed by
 * `root`+`projectId` so a test can hold locks for more than one project at once without them
 * colliding. `FsProjectLock` is proven for real against the filesystem by
 * `tests/integration/workspace/project-lock.test.ts`. */
export class FakeProjectLock implements ProjectLock {
  private readonly locks = new Map<string, ProjectLockInfo>();

  private key(root: string, projectId: string): string {
    return `${root}\u0000${projectId}`;
  }

  read(root: string, projectId: string): Promise<ProjectLockInfo | null> {
    return Promise.resolve(this.locks.get(this.key(root, projectId)) ?? null);
  }

  write(root: string, projectId: string, lock: ProjectLockInfo): Promise<void> {
    this.locks.set(this.key(root, projectId), lock);
    return Promise.resolve();
  }

  clear(root: string, projectId: string): Promise<void> {
    this.locks.delete(this.key(root, projectId));
    return Promise.resolve();
  }
}

/** `DirectoryExistence` double (V2-T9 item 1) — a fixed set of directories that "exist", by exact
 * string (tests pass whatever spelling they expect `readCwdHistory` to check, so exactness catches
 * a caller accidentally checking the wrong value instead of silently passing either way). */
export class FakeDirectoryExistence implements DirectoryExistence {
  constructor(private readonly existingCwds: ReadonlySet<string> = new Set()) {}

  exists(cwd: string): Promise<boolean> {
    return Promise.resolve(this.existingCwds.has(cwd));
  }
}

/** `HarnessLauncher` double (V2-T28) — records every call and answers with whatever `result`
 * (or `resultFor`, keyed by `cwd`) the test configured, defaulting to a clean `opened` exit 0. */
export class FakeHarnessLauncher implements HarnessLauncher {
  readonly calls: {
    readonly cwd: string;
    readonly addDirs: readonly string[];
    readonly sessionId: string;
    readonly systemPromptAppend: string | null;
  }[] = [];

  constructor(private readonly result: HarnessOpenResult = { kind: 'opened', exitCode: 0 }) {}

  open(
    cwd: string,
    addDirs: readonly string[],
    sessionId: string,
    systemPromptAppend: string | null,
  ): Promise<HarnessOpenResult> {
    this.calls.push({ cwd, addDirs, sessionId, systemPromptAppend });
    return Promise.resolve(this.result);
  }
}

export const DEFAULT_TEST_CONFIG: Config = {
  endOfDayTime: null,
  leadTimesInMinutes: [30, 15],
  relevanceHours: 12,
  idleMinutes: 45,
  captureModel: 'sonnet',
  budgetPerSessionUsd: 0.25,
  captureConcurrency: 3,
  ignore: [],
  projectPolicy: {},
  forkCleanupDays: 7,
  maxGitRootsToVisit: 8,
  maxCaptureAttemptsPerSessionPerDay: 3,
  maxBriefingScanDays: 30,
  overdueFireThresholdMinutes: 5,
  leadTimeHysteresisMinutes: 3,
  terminalFontFamily: "'FiraCode Nerd Font Mono', 'FiraCode Nerd Font', 'Fira Code', monospace",
  terminalFontSize: 14,
};
